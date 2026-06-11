const base = process.env.BASE_URL || "http://localhost:3100";
const stamp = Date.now();
const results = [];

function mark(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

async function req(path, options = {}) {
  const res = await fetch(base + path, options);
  let data = null;

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

async function main() {
  const privEmail = `privato.${stamp}@test.it`;
  const dealerEmail = `dealer.${stamp}@test.it`;
  const partnerEmail = `partner.${stamp}@test.it`;
  const pass = "Test1234";

  let r = await req("/api/privati/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Mario Privato", email: privEmail, password: pass })
  });
  mark("Registrazione privato", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const privatoToken = r.data.token;

  r = await req("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Dealer Test Srl", email: dealerEmail, password: pass })
  });
  mark("Registrazione concessionario", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const dealerToken = r.data.token;

  r = await req("/api/partner/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome_azienda: "Partner Test Spa", email: partnerEmail, password: pass })
  });
  mark("Registrazione partner", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const partnerToken = r.data.token;
  const partnerId = r.data.partner && r.data.partner.id;

  r = await req("/api/privati/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: privEmail, password: pass })
  });
  mark("Login privato", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);

  r = await req("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: dealerEmail, password: pass })
  });
  mark("Login concessionario", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);

  r = await req("/api/partner/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: partnerEmail, password: pass })
  });
  mark("Login partner", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);

  r = await req("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: privEmail, password: pass })
  });
  mark("Blocco login privato su area concessionario", r.res.status === 401, `status ${r.res.status}`);

  const pdf = new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"], { type: "application/pdf" });
  const form = new FormData();
  form.append("pdf", pdf, "condizioni-test.pdf");
  r = await req("/api/partner/upload-pdf", {
    method: "POST",
    headers: auth(partnerToken),
    body: form
  });
  mark("Upload PDF garanzia partner", r.res.ok && Boolean(r.data.pdf_url), r.data.message || r.data.error);
  const pdfUrl = r.data.pdf_url || "";

  r = await req("/api/partner/garanzie", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(partnerToken) },
    body: JSON.stringify({
      nome: "Garanzia Test Premium",
      descrizione: "Copertura test per flusso end-to-end",
      prezzo: 45900,
      durata: 24,
      copertura: "Motore, cambio, elettronica",
      brand: "Partner Test",
      stato: "attiva",
      pdf_url: pdfUrl,
      limiti_attivi: 1,
      limite_km: 180000,
      limite_immatricolazione: 2015
    })
  });
  mark("Creazione garanzia partner", r.res.ok && Boolean(r.data.id), r.data.message || r.data.error);
  const warrantyId = r.data.id;

  r = await req(`/api/garanzie?partner_id=${partnerId}&km=80000&anno=2020`);
  const foundWarranty = Array.isArray(r.data) && r.data.some((g) => Number(g.id) === Number(warrantyId));
  mark("Comparatore garanzie compatibili", r.res.ok && foundWarranty, `${Array.isArray(r.data) ? r.data.length : 0} garanzie trovate`);

  r = await req("/api/partner/supplementi", { headers: auth(partnerToken) });
  mark("Caricamento supplementi partner", r.res.ok && Array.isArray(r.data) && r.data.length >= 1, `${Array.isArray(r.data) ? r.data.length : 0} supplementi`);

  const orderPayload = {
    prodotto_nome: "Garanzia Test Premium",
    prezzo: 45900,
    garanzia_id: warrantyId,
    partner_id: partnerId,
    proprietario_nome: "Luca",
    proprietario_cognome: "Rossi",
    proprietario_cf: "RSSLCU80A01H501U",
    proprietario_email: `cliente.${stamp}@test.it`,
    proprietario_telefono: "3331234567",
    proprietario_indirizzo: "Via Roma 1",
    proprietario_citta: "Milano",
    proprietario_cap: "20100",
    proprietario_provincia: "MI",
    veicolo_targa: "AB123CD",
    veicolo_modello: "Audi A3",
    veicolo_anno: "2020",
    veicolo_km: "80000",
    metodo_pagamento: "simulato",
    stato_pagamento: "pagato",
    supplementi_json: "[]",
    totale_supplementi: 0,
    prezzo_finale: 45900,
    garanzia_inizio: "2026-05-21",
    garanzia_fine: "2028-05-21",
    garanzia_durata_mesi: 24
  };

  r = await req("/api/ordini", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(dealerToken) },
    body: JSON.stringify(orderPayload)
  });
  mark("Acquisto simulato concessionario", r.res.ok && r.data.stato_pagamento === "pagato", r.data.message || r.data.error);
  const ordineId = r.data.ordineId;

  r = await req("/api/partner/ordini", { headers: auth(partnerToken) });
  const partnerSawOrder = Array.isArray(r.data) && r.data.some((o) => Number(o.id) === Number(ordineId));
  mark("Ricezione ordine in dashboard partner", r.res.ok && partnerSawOrder, `${Array.isArray(r.data) ? r.data.length : 0} ordini partner`);

  r = await req(`/api/partner/ordini/${ordineId}/emetti-certificato`, {
    method: "POST",
    headers: auth(partnerToken)
  });
  mark("Generazione certificato garanzia", r.res.ok && Boolean(r.data.numero_certificato) && Boolean(r.data.certificato_pdf_url), r.data.message || r.data.error);
  const numero = r.data.numero_certificato;

  r = await req(`/api/verifica-certificato/${encodeURIComponent(numero)}`);
  mark("Verifica certificato pubblico", r.res.ok && r.data.valido === true, r.data.error || numero);

  const privateOrderPayload = {
    ...orderPayload,
    proprietario_nome: "Mario",
    proprietario_cognome: "Privato",
    proprietario_email: `cliente.privato.${stamp}@test.it`,
    veicolo_targa: "PR123VT",
    veicolo_modello: "BMW Serie 1"
  };
  r = await req("/api/ordini", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(privatoToken) },
    body: JSON.stringify(privateOrderPayload)
  });
  mark("Scelta/acquisto simulato da privato", r.res.ok && r.data.stato_pagamento === "pagato", r.data.message || r.data.error);

  r = await req("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@estendifacile.it", password: "admin123" })
  });
  mark("Login amministratore", r.res.ok && Boolean(r.data.token), r.data.message || r.data.error);
  const adminToken = r.data.token;

  r = await req("/api/admin/dashboard", { headers: auth(adminToken) });
  mark(
    "Dashboard admin KPI e grafici",
    r.res.ok && Boolean(r.data.kpi) && Boolean(r.data.charts) && Boolean(r.data.liste),
    r.res.ok ? `fatturato ${r.data.kpi.fatturato_complessivo}, garanzie ${r.data.kpi.garanzie_caricate}` : r.data.error
  );
}

main()
  .catch((error) => {
    mark("Errore test runner", false, error.message);
  })
  .finally(() => {
    const passed = results.filter((item) => item.ok).length;
    console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
    if (passed !== results.length) process.exitCode = 1;
  });
