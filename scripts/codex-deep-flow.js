const base = process.env.BASE_URL || "http://localhost:3100";
const stamp = Date.now();
const results = [];

function mark(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

async function req(path, options = {}) {
  const res = await fetch(base + path, options);
  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { res, data };
}

function auth(token) {
  return { Authorization: "Bearer " + token };
}

function jsonHeaders(token) {
  return { "Content-Type": "application/json", ...(token ? auth(token) : {}) };
}

function findById(list, id) {
  return Array.isArray(list) ? list.find((item) => Number(item.id) === Number(id)) : null;
}

function orderPayload({ warranty, email, targa, modello, anno = "2020", km = "65000", quoteTicketId }) {
  return {
    prodotto_nome: warranty.nome,
    prezzo: Number(warranty.prezzo),
    garanzia_id: warranty.id,
    partner_id: warranty.partner_id,
    quote_ticket_id: quoteTicketId || null,
    proprietario_nome: "Cliente",
    proprietario_cognome: "Collaudo",
    proprietario_cf: "CLLCLT80A01F205A",
    proprietario_email: email,
    proprietario_telefono: "3331234567",
    proprietario_indirizzo: "Via Test 10",
    proprietario_citta: "Milano",
    proprietario_cap: "20100",
    proprietario_provincia: "MI",
    veicolo_targa: targa,
    veicolo_modello: modello,
    veicolo_anno: anno,
    veicolo_km: km,
    metodo_pagamento: "simulato",
    stato_pagamento: "pagato",
    supplementi_json: "[]",
    totale_supplementi: 0,
    prezzo_finale: Number(warranty.prezzo),
    garanzia_inizio: "2026-05-26",
    garanzia_fine: "2028-05-26",
    garanzia_durata_mesi: 24
  };
}

async function createTicketFlow({ requesterType, token, partnerToken, partnerId, warrantyId, targa, modello, prezzo }) {
  let r = await req("/api/quote-tickets", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      requester_type: requesterType,
      partner_id: partnerId,
      garanzia_id: warrantyId,
      veicolo_tipo: "auto",
      marca: modello.split(" ")[0],
      modello,
      targa,
      anno: 2021,
      km: 72000,
      messaggio: `Richiesta preventivo ${requesterType}`
    })
  });
  mark(`Apertura ticket preventivo ${requesterType}`, r.res.status === 201 && Boolean(r.data.id), r.data.message || r.data.error);
  const ticketId = r.data.id;

  r = await req("/api/partner/tickets", { headers: auth(partnerToken) });
  const partnerSeesTicket = findById(r.data, ticketId);
  mark(`Ticket visibile al partner (${requesterType})`, r.res.ok && Boolean(partnerSeesTicket), `ticket ${ticketId}`);

  r = await req(`/api/partner/tickets/${ticketId}`, {
    method: "PUT",
    headers: jsonHeaders(partnerToken),
    body: JSON.stringify({
      stato: "risposto",
      prezzo_preventivo: prezzo,
      risposta: "Preventivo approvabile per il veicolo indicato."
    })
  });
  mark(`Risposta partner al preventivo ${requesterType}`, r.res.ok, r.data.message || r.data.error);

  r = await req(`/api/quote-tickets?requester_type=${encodeURIComponent(requesterType)}`);
  const answered = findById(r.data, ticketId);
  mark(`Preventivo ricevuto in area ${requesterType}`, r.res.ok && answered?.stato === "risposto" && Number(answered?.prezzo_preventivo) === prezzo, answered?.stato || "non trovato");

  r = await req(`/api/quote-tickets/${ticketId}/action`, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify({ action: "accettato" })
  });
  mark(`Accettazione preventivo ${requesterType}`, r.res.ok && r.data.ticket?.stato === "accettato", r.data.message || r.data.error);

  return { ticketId, ticket: r.data.ticket };
}

async function main() {
  let r = await req("/api/partner/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ nome_azienda: `Partner Deep ${stamp}`, email: `deep.partner.${stamp}@test.it`, password: "Test1234" })
  });
  mark("Registrazione partner deep test", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const partnerToken = r.data.token;
  const partnerId = r.data.partner.id;

  r = await req("/api/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ nome: `Dealer Deep ${stamp}`, email: `deep.dealer.${stamp}@test.it`, password: "Test1234" })
  });
  mark("Registrazione concessionario deep test", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const dealerToken = r.data.token;

  r = await req("/api/privati/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ nome: `Privato Deep ${stamp}`, email: `deep.privato.${stamp}@test.it`, password: "Test1234" })
  });
  mark("Registrazione privato deep test", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const privatoToken = r.data.token;

  const pdf = new Blob(["%PDF-1.4\n% deep test\n%%EOF"], { type: "application/pdf" });
  const form = new FormData();
  form.append("pdf", pdf, "condizioni-deep-test.pdf");
  r = await req("/api/partner/upload-pdf", { method: "POST", headers: auth(partnerToken), body: form });
  mark("Caricamento soluzione di garanzia con PDF", r.res.ok && Boolean(r.data.pdf_url), r.data.message || r.data.error);
  const pdfUrl = r.data.pdf_url || "";

  r = await req("/api/partner/garanzie", {
    method: "POST",
    headers: jsonHeaders(partnerToken),
    body: JSON.stringify({
      nome: "Garanzia Deep Premium",
      descrizione: "Copertura completa per collaudo regole veicolo.",
      prezzo: 69900,
      durata: 24,
      copertura: "Motore, cambio, elettronica, assistenza",
      brand: "Deep Partner",
      stato: "attiva",
      pdf_url: pdfUrl,
      limiti_attivi: 1,
      limite_km: 180000,
      limite_immatricolazione: 2015,
      canale_attivazione: "entrambi",
      tipo_veicolo_attivabile: "AUTOVEICOLO",
      servizio_tipo: "GARANZIA"
    })
  });
  mark("Creazione garanzia partner completa", r.res.ok && Boolean(r.data.id), r.data.message || r.data.error);
  const warrantyId = r.data.id;
  const warranty = {
    id: warrantyId,
    partner_id: partnerId,
    nome: "Garanzia Deep Premium",
    prezzo: 69900
  };

  for (const rule of [
    { status: "non_attivabile", marca: "Lancia", modello: "Thesis" },
    { status: "preventivo", marca: "Maserati", modello: "Ghibli" }
  ]) {
    r = await req("/api/partner/vehicle-rules", {
      method: "POST",
      headers: jsonHeaders(partnerToken),
      body: JSON.stringify(rule)
    });
    mark(`Impostazione veicolo ${rule.status}`, r.res.status === 201 && Boolean(r.data.id), r.data.error || `regola ${r.data.id}`);
  }

  r = await req(`/api/partner/vehicle-rules?status=non_attivabile`, { headers: auth(partnerToken) });
  mark("Elenco veicoli non attivabili caricato", r.res.ok && r.data.some((item) => item.modello === "Thesis"), `${Array.isArray(r.data) ? r.data.length : 0} regole`);

  r = await req(`/api/partner/vehicle-rules?status=preventivo`, { headers: auth(partnerToken) });
  mark("Elenco veicoli attivabili con preventivazione caricato", r.res.ok && r.data.some((item) => item.modello === "Ghibli"), `${Array.isArray(r.data) ? r.data.length : 0} regole`);

  r = await req(`/api/garanzie?partner_id=${partnerId}&km=65000&anno=2021&richiesta_tipo=concessionario&veicolo_tipo=auto&marca=Audi&modello=A3`);
  mark("Comparatore modello attivabile normalmente", r.res.ok && findById(r.data, warrantyId)?.availability_status === "standard", findById(r.data, warrantyId)?.availability_status || "non trovato");

  r = await req(`/api/garanzie?partner_id=${partnerId}&km=72000&anno=2021&richiesta_tipo=concessionario&veicolo_tipo=auto&marca=Maserati&modello=Ghibli`);
  mark("Comparatore modello attivabile con preventivazione", r.res.ok && findById(r.data, warrantyId)?.availability_status === "preventivo", findById(r.data, warrantyId)?.availability_status || "non trovato");

  r = await req(`/api/garanzie?partner_id=${partnerId}&km=72000&anno=2021&richiesta_tipo=privato&veicolo_tipo=auto&marca=Maserati&modello=Ghibli`);
  mark("Comparatore privato modello con preventivazione", r.res.ok && findById(r.data, warrantyId)?.availability_status === "preventivo", findById(r.data, warrantyId)?.availability_status || "non trovato");

  r = await req(`/api/garanzie?partner_id=${partnerId}&km=80000&anno=2019&richiesta_tipo=concessionario&veicolo_tipo=auto&marca=Lancia&modello=Thesis`);
  mark("Comparatore modello non attivabile", r.res.ok && findById(r.data, warrantyId)?.availability_status === "non_attivabile", findById(r.data, warrantyId)?.availability_status || "non trovato");

  r = await req("/api/ordini", {
    method: "POST",
    headers: jsonHeaders(dealerToken),
    body: JSON.stringify(orderPayload({
      warranty,
      email: `cliente.standard.${stamp}@test.it`,
      targa: "AA111AA",
      modello: "Audi A3"
    }))
  });
  mark("Acquisto diretto concessionario su modello standard", r.res.ok && r.data.stato_pagamento === "pagato", r.data.message || r.data.error);
  const standardOrderId = r.data.ordineId;

  r = await req("/api/partner/ordini", { headers: auth(partnerToken) });
  mark("Ordine standard ricevuto lato partner", r.res.ok && r.data.some((item) => Number(item.id) === Number(standardOrderId)), `${Array.isArray(r.data) ? r.data.length : 0} ordini`);

  const dealerQuote = await createTicketFlow({
    requesterType: "concessionario",
    token: dealerToken,
    partnerToken,
    partnerId,
    warrantyId,
    targa: "BB222BB",
    modello: "Maserati Ghibli",
    prezzo: 84900
  });
  const dealerQuoteWarranty = { ...warranty, prezzo: 84900 };

  r = await req("/api/ordini", {
    method: "POST",
    headers: jsonHeaders(dealerToken),
    body: JSON.stringify(orderPayload({
      warranty: dealerQuoteWarranty,
      email: `cliente.quote.dealer.${stamp}@test.it`,
      targa: "BB222BB",
      modello: "Maserati Ghibli",
      anno: "2021",
      km: "72000",
      quoteTicketId: dealerQuote.ticketId
    }))
  });
  mark("Acquisto concessionario dopo preventivo accettato", r.res.ok && r.data.stato_pagamento === "pagato", r.data.message || r.data.error);
  const quoteOrderId = r.data.ordineId;

  r = await req(`/api/partner/ordini/${quoteOrderId}/emetti-certificato`, { method: "POST", headers: auth(partnerToken) });
  mark("Emissione certificato ordine da preventivo", r.res.ok && Boolean(r.data.numero_certificato) && Boolean(r.data.certificato_pdf_url), r.data.message || r.data.error);
  const certNumber = r.data.numero_certificato;

  r = await req(`/api/verifica-certificato/${encodeURIComponent(certNumber)}`);
  mark("Verifica pubblica certificato da preventivo", r.res.ok && r.data.valido === true, r.data.error || certNumber);

  const privQuote = await createTicketFlow({
    requesterType: "privato",
    token: privatoToken,
    partnerToken,
    partnerId,
    warrantyId,
    targa: "CC333CC",
    modello: "Maserati Ghibli",
    prezzo: 82900
  });
  const privQuoteWarranty = { ...warranty, prezzo: 82900 };

  r = await req("/api/ordini", {
    method: "POST",
    headers: jsonHeaders(privatoToken),
    body: JSON.stringify(orderPayload({
      warranty: privQuoteWarranty,
      email: `cliente.quote.privato.${stamp}@test.it`,
      targa: "CC333CC",
      modello: "Maserati Ghibli",
      anno: "2021",
      km: "72000",
      quoteTicketId: privQuote.ticketId
    }))
  });
  mark("Acquisto privato dopo preventivo accettato", r.res.ok && r.data.stato_pagamento === "pagato", r.data.message || r.data.error);

  r = await req("/api/ordini", {
    method: "POST",
    headers: jsonHeaders(dealerToken),
    body: JSON.stringify(orderPayload({
      warranty,
      email: `cliente.blocked.${stamp}@test.it`,
      targa: "DD444DD",
      modello: "Lancia Thesis",
      anno: "2019",
      km: "80000"
    }))
  });
  mark("Blocco server acquisto veicolo non attivabile", r.res.status === 400, `status ${r.res.status}: ${r.data.error || r.data.message || ""}`);

  r = await req("/api/ordini", {
    method: "POST",
    headers: jsonHeaders(dealerToken),
    body: JSON.stringify(orderPayload({
      warranty,
      email: `cliente.preventivo.no-ticket.${stamp}@test.it`,
      targa: "EE555EE",
      modello: "Maserati Ghibli",
      anno: "2021",
      km: "72000"
    }))
  });
  mark("Blocco server acquisto preventivo senza ticket accettato", r.res.status === 400, `status ${r.res.status}: ${r.data.error || r.data.message || ""}`);

  r = await req("/api/admin/dashboard", { headers: auth((await (await req("/api/admin/login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email: "admin@estendifacile.it", password: "admin123" })
  })).data).token) });
  mark("Dashboard admin coerente dopo flussi deep", r.res.ok && Boolean(r.data.kpi) && Boolean(r.data.liste), r.res.ok ? `ordini ${r.data.flussi?.totale_ordini}` : r.data.error);
}

main()
  .catch((error) => {
    mark("Errore test deep flow", false, error.message);
  })
  .finally(() => {
    const passed = results.filter((item) => item.ok).length;
    console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
    if (passed !== results.length) process.exitCode = 1;
  });
