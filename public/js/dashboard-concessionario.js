document.addEventListener("DOMContentLoaded", function () {
 AuthGuard.requireConcessionario();

const concessionarioToken = localStorage.getItem("token");

  let tuttiGliOrdini = [];
  let paginaCorrente = 1;
  const ORDINI_PER_PAGINA = 10;

  function showSection(name, btn) {
    const target = document.getElementById("section-" + name);
    if (!target) return;

    document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));
    target.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(button => button.classList.remove("active"));

    const navTarget = btn && btn.classList && btn.classList.contains("nav-item")
      ? btn
      : document.querySelector('.nav-item[data-section="' + name + '"]');

    if (navTarget) navTarget.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function euro(cents) {
    return "€ " + (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
  }

  function formatKm(value) {
    return Number(value || 0).toLocaleString("it-IT") + " km";
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("it-IT");
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDateOnlyIT(value) {
    if (!value) return "—";
    const d = new Date(value + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("it-IT");
  }

  function getVehicleTypeInline() {
    const selected = document.querySelector('input[name="cmpVehicleType"]:checked');
    return selected ? selected.value : (localStorage.getItem("veicolo_tipo") || "auto");
  }

  function labelTipoVeicolo(tipo) {
    if (tipo === "moto") return "Moto";
    if (tipo === "commerciale") return "Veicolo commerciale";
    if (tipo === "ricreazionale") return "Veicolo ricreazionale";
    return "Auto";
  }

  function resetComparatorVehicleData() {
    ["cmpTargaInput", "cmpModelloInput", "cmpAnnoInput", "cmpKmInput"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const extra = document.getElementById("cmpExtraFields");
    if (extra) extra.classList.remove("open");
    const error = document.getElementById("cmpSearchError");
    if (error) error.textContent = "";
    const results = document.getElementById("cmpInlineResults");
    if (results) { results.classList.remove("open"); results.innerHTML = ""; }
    ["targa", "veicolo_targa", "veicolo_modello", "veicolo_anno", "veicolo_km"].forEach(key => localStorage.removeItem(key));
  }

  function updateComparatorVehicleTypeUI(resetData = false) {
    const tipo = getVehicleTypeInline();
    const modelloLabel = document.getElementById("cmpModelloLabel");
    const modelloInput = document.getElementById("cmpModelloInput");
    const annoInput = document.getElementById("cmpAnnoInput");
    const kmInput = document.getElementById("cmpKmInput");
    const targaInput = document.getElementById("cmpTargaInput");

    if (modelloLabel) {
      modelloLabel.textContent = tipo === "moto" ? "Modello motoveicolo" : tipo === "commerciale" ? "Modello veicolo commerciale" : tipo === "ricreazionale" ? "Modello veicolo ricreazionale" : "Modello autoveicolo";
    }
    if (modelloInput) {
      modelloInput.placeholder = tipo === "moto" ? "Es. Yamaha" : tipo === "commerciale" ? "Es. Fiat Ducato" : tipo === "ricreazionale" ? "Es. Camper / Motorhome" : "Es. Fiat Panda";
    }
    if (annoInput) annoInput.placeholder = "Es. 2019";
    if (kmInput) kmInput.placeholder = "Es. 65000";
    if (targaInput) targaInput.placeholder = tipo === "moto" ? "ES. AA12345" : "ES. AB123CD";

    localStorage.setItem("veicolo_tipo", tipo);
    if (resetData) resetComparatorVehicleData();
  }

  function validaTarga(targa, tipo = "auto") {
    if (tipo === "moto") {
      return /^[A-Z0-9]{5,8}$/.test(targa);
    }
    return /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(targa);
  }

 function logout() {
  AuthGuard.logoutConcessionario();
}

  function apriRicercaDashboard() {
    apriFormVeicolo({
      targaId: "dashTargaInput",
      errorId: "dashSearchError",
      extraFieldsId: "dashExtraFields",
      modelloId: "dashModelloInput"
    });
  }

  function apriFormVeicolo(config) {
    const targaInput = document.getElementById(config.targaId);
    const errorBox = document.getElementById(config.errorId);
    const extraFields = document.getElementById(config.extraFieldsId);
    const modelloInput = document.getElementById(config.modelloId);
    if (!targaInput || !errorBox || !extraFields) return;

    const targa = targaInput.value.trim().toUpperCase();
    errorBox.textContent = "";

    if (!targa) {
      errorBox.textContent = "Inserisci la targa per continuare.";
      return;
    }

    const tipoVeicolo = getVehicleTypeInline();

    if (!validaTarga(targa, tipoVeicolo)) {
      errorBox.textContent = tipoVeicolo === "moto"
        ? "Inserisci una targa moto valida."
        : "Inserisci una targa valida nel formato italiano es. AB123CD.";
      return;
    }

    targaInput.value = targa;
    extraFields.classList.add("open");
    if (modelloInput) modelloInput.focus();
  }

  function salvaVeicoloEVaiAiRisultati(config) {
    const targa = document.getElementById(config.targaId).value.trim().toUpperCase();
    const modello = document.getElementById(config.modelloId).value.trim();
    const anno = document.getElementById(config.annoId).value.trim();
    const km = document.getElementById(config.kmId).value.trim();
    const errorBox = document.getElementById(config.errorId);

    errorBox.textContent = "";

    if (!targa || !modello || !anno || !km) {
      errorBox.textContent = "Compila tutti i campi del veicolo.";
      return;
    }

    const tipoVeicolo = getVehicleTypeInline();

    if (!validaTarga(targa, tipoVeicolo)) {
      errorBox.textContent = tipoVeicolo === "moto"
        ? "Inserisci una targa moto valida."
        : "Inserisci una targa valida nel formato italiano es. AB123CD.";
      return;
    }

    if (Number(anno) < 1980 || Number(anno) > new Date().getFullYear()) {
      errorBox.textContent = "Inserisci un anno di immatricolazione valido.";
      return;
    }

    if (Number(km) < 0) {
      errorBox.textContent = "Inserisci un chilometraggio valido.";
      return;
    }

    localStorage.setItem("targa", targa);
    localStorage.setItem("veicolo_targa", targa);
    localStorage.setItem("veicolo_modello", modello);
    localStorage.setItem("veicolo_anno", anno);
    localStorage.setItem("veicolo_km", km);
    localStorage.setItem("veicolo_tipo", tipoVeicolo);

    mostraRisultatiInline(config);
  }

  function getVeicoloInline() {
    return {
      targa: localStorage.getItem("veicolo_targa") || localStorage.getItem("targa") || "",
      modello: localStorage.getItem("veicolo_modello") || "",
      anno: localStorage.getItem("veicolo_anno") || "",
      km: localStorage.getItem("veicolo_km") || "",
      tipo: localStorage.getItem("veicolo_tipo") || getVehicleTypeInline()
    };
  }

  function garanziaCompatibileInline(g) {
    const v = getVeicoloInline();
    if (String(g.stato || "attiva").toLowerCase() === "sospesa") return false;
    if (Number(g.limiti_attivi || 0) !== 1) return true;
    const kmVeicolo = Number(v.km || 0);
    const annoVeicolo = Number(v.anno || 0);
    if (g.limite_km && kmVeicolo > Number(g.limite_km)) return false;
    if (g.limite_immatricolazione && annoVeicolo < Number(g.limite_immatricolazione)) return false;
    return true;
  }

  function qualityPriceScoreInline(g) {
    const price = Math.max(Number(g.prezzo || 0), 1);
    const durata = Math.max(Number(g.durata || 0), 1);
    const text = String((g.nome || "") + " " + (g.descrizione || "") + " " + (g.copertura || "")).toLowerCase();
    let coverageScore = 1;
    if (/premium|completa|full|plus|top/.test(text)) coverageScore += 1.25;
    if (/motore|cambio/.test(text)) coverageScore += .75;
    if (/elettric|elettronic|impianto|clima|assistenza|stradale/.test(text)) coverageScore += .5;
    return (durata * coverageScore) / price;
  }

  function scegliGaranziaInline(garanzia) {
    localStorage.setItem("garanziaSelezionata", JSON.stringify(garanzia));
    localStorage.setItem("checkoutReturnContext", "concessionario");
    localStorage.setItem("checkoutReturnUrl", "/dashboard-concessionario.html#comparatore");
    localStorage.setItem("restoreComparatorResults", "1");
    window.location.href = "/checkout.html?from=concessionario";
  }


  function garanziaDaTicketPreventivo(t) {
    return {
      id: t.garanzia_id || ("ticket-" + t.id),
      nome: t.garanzia_nome || "Garanzia su preventivo",
      brand: t.garanzia_brand || t.partner_nome || "Partner",
      partner_nome: t.partner_nome || t.garanzia_brand || "Partner",
      partner_id: t.partner_id,
      prezzo: Number(t.prezzo_preventivo || 0),
      durata: t.garanzia_durata || "",
      descrizione: t.risposta || t.garanzia_descrizione || "Preventivo personalizzato approvato dal partner.",
      quote_ticket_id: t.id,
      availability_status: "preventivo_accettato"
    };
  }

  async function aggiornaStatoTicketConcessionario(id, action) {
    const resp = await fetch(`/api/quote-tickets/${id}/action`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Errore aggiornamento ticket");
    return data.ticket;
  }

  async function accettaPreventivoConcessionario(id) {
    const ticket = await aggiornaStatoTicketConcessionario(id, "accettato");
    const garanzia = garanziaDaTicketPreventivo(ticket);
    localStorage.setItem("garanziaSelezionata", JSON.stringify(garanzia));
    localStorage.setItem("targa", ticket.targa || "");
    localStorage.setItem("veicolo_targa", ticket.targa || "");
    localStorage.setItem("veicolo_modello", ticket.modello || "");
    localStorage.setItem("veicolo_anno", ticket.anno || "");
    localStorage.setItem("veicolo_km", ticket.km || "");
    localStorage.setItem("veicolo_tipo", ticket.veicolo_tipo || "auto");
    localStorage.setItem("checkoutReturnContext", "concessionario");
    localStorage.setItem("checkoutReturnUrl", "/dashboard-concessionario.html#tickets");
    localStorage.setItem("restoreComparatorResults", "1");
    window.location.href = "/checkout.html?from=concessionario&ticket=" + encodeURIComponent(id);
  }

  async function rifiutaPreventivoConcessionario(id) {
    await aggiornaStatoTicketConcessionario(id, "rifiutato");
    await caricaTicketsConcessionario();
  }

  async function mostraRisultatiInline(config) {
    const targetId = config.resultsId || "cmpInlineResults";
    const box = document.getElementById(targetId);
    if (!box) return;

    const v = getVeicoloInline();
    box.classList.add("open");
    box.innerHTML = `
      <div class="inline-results-head">
        <div>
          <span class="badge light">Soluzioni compatibili</span>
          <h2>Garanzie disponibili per ${v.targa}</h2>
          <p>${labelTipoVeicolo(v.tipo)} • ${v.modello} • ${v.anno} • ${formatKm(v.km)}</p>
        </div>
        <div class="inline-loader">Caricamento...</div>
      </div>
    `;

    try {
      const res = await fetch(`/api/garanzie?km=${encodeURIComponent(v.km)}&anno=${encodeURIComponent(v.anno)}&richiesta_tipo=concessionario&veicolo_tipo=${encodeURIComponent(v.tipo)}&marca=${encodeURIComponent(v.modello)}&modello=${encodeURIComponent(v.modello)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore caricamento garanzie");
      const compatibili = data.filter(garanziaCompatibileInline).sort((a,b)=>Number(a.prezzo||0)-Number(b.prezzo||0));
      const blockedList = compatibili.filter(g => g.availability_status === "non_attivabile");
      const lista = compatibili.filter(g => g.availability_status !== "non_attivabile");
      const directList = lista.filter(g => g.availability_status !== "preventivo");
      const bestValue = directList.length ? directList.reduce((best, item) => qualityPriceScoreInline(item) > qualityPriceScoreInline(best) ? item : best, directList[0]) : null;
      const bestValueId = bestValue ? String(bestValue.id) : "";

      if (!lista.length && blockedList.length) {
        box.innerHTML = `
          <div class="inline-results-head warning">
            <div><span class="badge light">Attenzione</span><h2>ATTENZIONE: VEICOLO NON ATTIVABILE</h2><p>Il veicolo inserito risulta non attivabile per i partner disponibili. Non è possibile procedere all'acquisto di una garanzia per questo modello.</p></div>
          </div>
        `;
        return;
      }

      if (!lista.length) {
        box.innerHTML = `
          <div class="inline-results-head">
            <div><span class="badge light">0 risultati</span><h2>Nessuna garanzia compatibile</h2><p>Non abbiamo trovato soluzioni compatibili con i dati inseriti. Modifica i dati del veicolo e riprova.</p></div>
          </div>
        `;
        return;
      }

      box.innerHTML = `
        <div class="inline-results-head">
          <div>
            <span class="badge light">${lista.length} risultat${lista.length === 1 ? "o" : "i"}</span>
            <h2>Soluzioni compatibili</h2>
            <p>${labelTipoVeicolo(v.tipo)} • ${v.targa} • ${v.modello} • ${v.anno} • ${formatKm(v.km)}</p>
          </div>
        </div>
        <div class="inline-results-grid">
          ${lista.map(g => {
            const isRecommended = String(g.id) === bestValueId;
            return `
            <article class="inline-warranty-card ${isRecommended ? "recommended" : ""}">
              <div class="warranty-main">
                <div class="warranty-topline"><span class="compatibility">${g.availability_status === "preventivo" ? "◇ Richiede preventivo" : g.availability_status === "non_attivabile" ? "× Non attivabile" : "✓ Compatibile"}</span><span class="brand-pill">${g.brand || g.partner_nome || "Partner"}</span>${isRecommended ? `<span class="value-recommended-badge"><i class="fa-solid fa-star"></i> Consigliata</span>` : ""}</div>
                <h3>${g.nome || "Garanzia"}</h3>
                <p>${g.availability_message || g.descrizione || "Soluzione di garanzia disponibile per il veicolo selezionato."}</p>
                <div class="warranty-mini-grid">
                  <span><small>Durata</small><strong>${g.durata || "—"} mesi</strong></span>
                  <span><small>Stato</small><strong>${g.stato || "attiva"}</strong></span>
                  <span><small>Documento</small><strong>${g.pdf_url ? "PDF" : "N/D"}</strong></span>
                </div>
              </div>
              <aside class="warranty-price-box">
                ${g.availability_status === "preventivo" ? `<small>Preventivo richiesto</small><strong style="font-size:16px;line-height:1.2;">Costo definito dal partner</strong><button class="hero-btn primary btnApriTicketInline" type="button" data-id="${g.id}">Apri ticket preventivo</button>` : `<small>Prezzo base</small><strong>${euro(g.prezzo || 0)}</strong><button class="hero-btn primary btnScegliGaranziaInline" type="button" data-id="${g.id}">Scegli</button>`}
              </aside>
            </article>
          `}).join("")}
        </div>
      `;

      box.querySelectorAll(".btnApriTicketInline").forEach(button => {
        button.addEventListener("click", async () => {
          const garanzia = lista.find(g => Number(g.id) === Number(button.dataset.id));
          if (!garanzia) return;
          button.disabled = true;
          button.textContent = "Invio ticket...";
          try {
            const resp = await fetch("/api/quote-tickets", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ requester_type:"concessionario", partner_id: garanzia.partner_id, garanzia_id: garanzia.id, veicolo_tipo:v.tipo, modello:v.modello, targa:v.targa, anno:v.anno, km:v.km, messaggio:"Richiesta preventivo dal comparatore concessionario" }) });
            const ticketData = await resp.json();
            if (!resp.ok) throw new Error(ticketData.error || "Errore apertura ticket");
            button.textContent = "Ticket aperto";
            caricaTicketsConcessionario();
          } catch(e) { button.disabled = false; button.textContent = e.message || "Riprova"; }
        });
      });

      box.querySelectorAll(".btnScegliGaranziaInline").forEach(button => {
        button.addEventListener("click", () => {
          const garanzia = lista.find(g => Number(g.id) === Number(button.dataset.id));
          if (garanzia) scegliGaranziaInline(garanzia);
        });
      });
      box.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      box.innerHTML = `<div class="empty-state">${error.message || "Errore di connessione al server."}</div>`;
    }
  }

  function vaiAiRisultatiDaDashboard() {
    salvaVeicoloEVaiAiRisultati({
      targaId: "dashTargaInput",
      modelloId: "dashModelloInput",
      annoId: "dashAnnoInput",
      kmId: "dashKmInput",
      errorId: "dashSearchError"
    });
  }

  function apriComparatoreDashboard() {
    apriFormVeicolo({
      targaId: "cmpTargaInput",
      errorId: "cmpSearchError",
      extraFieldsId: "cmpExtraFields",
      modelloId: "cmpModelloInput"
    });
  }

  function vaiAiRisultatiComparatore() {
    salvaVeicoloEVaiAiRisultati({
      targaId: "cmpTargaInput",
      modelloId: "cmpModelloInput",
      annoId: "cmpAnnoInput",
      kmId: "cmpKmInput",
      errorId: "cmpSearchError"
    });
  }

  async function caricaProfilo() {
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: "Bearer " + concessionarioToken }
      });

      const data = await res.json();

      if (!res.ok) {
        document.getElementById("profileList").innerHTML = `
          <div class="profile-row">
            <strong>Errore</strong>
            <span>${data.error || "Impossibile caricare il profilo"}</span>
          </div>
        `;
        return;
      }

      document.getElementById("sidebarUserName").textContent = data.nome || "Concessionario";

      document.getElementById("profileList").innerHTML = `
        <div class="profile-row"><strong>Nome / Ragione sociale</strong><span>${data.nome || "—"}</span></div>
        <div class="profile-row"><strong>Email</strong><span>${data.email || "—"}</span></div>
        <div class="profile-row"><strong>Ruolo</strong><span>${data.ruolo || "concessionario"}</span></div>
        <div class="profile-row"><strong>Account creato il</strong><span>${formatDate(data.created_at)}</span></div>
        <div class="profile-row"><strong>Stato account</strong><span>Attivo</span></div>
      `;
    } catch {
      document.getElementById("profileList").innerHTML = `
        <div class="profile-row">
          <strong>Errore</strong>
          <span>Connessione non disponibile</span>
        </div>
      `;
    }
  }

  function parseSupplementi(value) {
    if (!value) return [];

    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getPrezzoOrdine(o) {
    return Number(o.prezzo_finale || o.prezzo || 0);
  }

  function aggiornaKpi(ordini) {
    const totali = ordini.length;
    const pagati = ordini.filter(o => String(o.stato_pagamento || o.stato || "").toLowerCase() === "pagato").length;
    const attesa = ordini.filter(o => String(o.stato_pagamento || "").toLowerCase() === "in_attesa").length;
    const ultimo = ordini[0];

    document.getElementById("kpiTotali").textContent = totali;
    document.getElementById("kpiPagati").textContent = pagati;
    document.getElementById("kpiAttesa").textContent = attesa;
    document.getElementById("kpiUltima").textContent = ultimo ? formatDate(ultimo.created_at) : "—";
  }

  function getStatusPill(o) {
    const statoPagamento = String(o.stato_pagamento || "").toLowerCase();

    if (statoPagamento === "in_attesa") {
      return `<span class="status-pill pending">In attesa</span>`;
    }

    if (statoPagamento === "pagato" || String(o.stato || "").toLowerCase() === "pagato") {
      return `<span class="status-pill">Pagato</span>`;
    }

    return `<span class="status-pill pending">${o.stato || "creato"}</span>`;
  }

  function renderPaginazione(totale, pagina, onCambiaPagina) {
    let pag = document.getElementById("ordiniPaginazione");
    if (!pag) {
      pag = document.createElement("div");
      pag.id = "ordiniPaginazione";
      pag.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;flex-wrap:wrap;";
      const container = document.getElementById("ordersContainer");
      container.parentNode.insertBefore(pag, container.nextSibling);
    }
    const totPagine = Math.ceil(totale / ORDINI_PER_PAGINA);
    if (totPagine <= 1) { pag.innerHTML = ""; return; }
    let html = "";
    const btnStyle = "min-width:36px;height:36px;border-radius:10px;border:1.5px solid #dfe8f4;background:#fff;color:#071d49;font-weight:900;cursor:pointer;font-size:13px;transition:.18s;padding:0 10px;";
    const btnActiveStyle = "min-width:36px;height:36px;border-radius:10px;border:1.5px solid #18b45a;background:#18b45a;color:#fff;font-weight:900;cursor:pointer;font-size:13px;padding:0 10px;";
    html += `<button style="${pagina===1?"opacity:.4;cursor:not-allowed;"+btnStyle:btnStyle}" data-pg="${pagina-1}" ${pagina===1?"disabled":""}>&#8592;</button>`;
    for (let i = 1; i <= totPagine; i++) {
      if (totPagine > 7 && i > 2 && i < totPagine - 1 && Math.abs(i - pagina) > 1) {
        if (i === 3 || i === totPagine - 2) html += `<span style="color:#94a3b8;">…</span>`;
        continue;
      }
      html += `<button style="${i===pagina?btnActiveStyle:btnStyle}" data-pg="${i}">${i}</button>`;
    }
    html += `<button style="${pagina===totPagine?"opacity:.4;cursor:not-allowed;"+btnStyle:btnStyle}" data-pg="${pagina+1}" ${pagina===totPagine?"disabled":""}>&#8594;</button>`;
    html += `<span style="font-size:12px;color:#64748b;margin-left:8px;">${totale} ordini totali</span>`;
    pag.innerHTML = html;
    pag.querySelectorAll("button[data-pg]").forEach(btn => {
      btn.addEventListener("click", () => onCambiaPagina(Number(btn.dataset.pg)));
    });
  }

  function renderOrdini(ordini) {
    const container = document.getElementById("ordersContainer");

    if (!ordini.length) {
      container.innerHTML = `<div class="empty-state">Non hai ancora creato richieste di garanzia.</div>`;
      const pag = document.getElementById("ordiniPaginazione");
      if (pag) pag.innerHTML = "";
      return;
    }

    const inizio = (paginaCorrente - 1) * ORDINI_PER_PAGINA;
    const paginati = ordini.slice(inizio, inizio + ORDINI_PER_PAGINA);
    renderPaginazione(ordini.length, paginaCorrente, (nuovaPagina) => {
      paginaCorrente = nuovaPagina;
      renderOrdini(ordini);
      document.getElementById("ordersContainer").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    container.innerHTML = paginati.map((o) => {
      const supplementi = parseSupplementi(o.supplementi_json);
      const detailId = `details_${o.id}`;

      return `
        <div class="order-card">
          <div class="order-top">
            <div>
              <div class="order-title">${o.prodotto_nome || "Garanzia"}</div>
              <div class="order-subtitle">Pratica #${o.id} • ${formatDateTime(o.created_at)}</div>
            </div>
            <div>${getStatusPill(o)}</div>
          </div>

          <div class="order-mini-grid">
            <div class="mini-box"><div class="mini-label">Prezzo finale</div><div class="mini-value">${euro(getPrezzoOrdine(o))}</div></div>
            <div class="mini-box"><div class="mini-label">Targa</div><div class="mini-value">${o.veicolo_targa || "—"}</div></div>
            <div class="mini-box"><div class="mini-label">Modello</div><div class="mini-value">${o.veicolo_modello || "—"}</div></div>
            <div class="mini-box"><div class="mini-label">Pagamento</div><div class="mini-value">${o.metodo_pagamento || "—"}</div></div>
          </div>

          <button class="btn btn-outline btnToggleDettagli" type="button" data-detail-id="${detailId}">
            Apri dettagli pratica
          </button>

          <div class="order-details" id="${detailId}">
            <div class="detail-box">
              <h3>Dati veicolo</h3>
              <div class="detail-list">
                <div class="detail-row"><strong>Targa</strong><span>${o.veicolo_targa || "—"}</span></div>
                <div class="detail-row"><strong>Modello</strong><span>${o.veicolo_modello || "—"}</span></div>
                <div class="detail-row"><strong>Anno immatricolazione</strong><span>${o.veicolo_anno || "—"}</span></div>
                <div class="detail-row"><strong>Chilometraggio</strong><span>${o.veicolo_km ? formatKm(o.veicolo_km) : "—"}</span></div>
              </div>
            </div>

            <div class="detail-box">
              <h3>Proprietario</h3>
              <div class="detail-list">
                <div class="detail-row"><strong>Nome e cognome</strong><span>${o.proprietario_nome || "—"} ${o.proprietario_cognome || ""}</span></div>
                <div class="detail-row"><strong>Codice fiscale</strong><span>${o.proprietario_cf || "—"}</span></div>
                <div class="detail-row"><strong>Email</strong><span>${o.proprietario_email || "—"}</span></div>
                <div class="detail-row"><strong>Telefono</strong><span>${o.proprietario_telefono || "—"}</span></div>
                <div class="detail-row">
                  <strong>Indirizzo</strong>
                  <span>
                    ${o.proprietario_indirizzo || "—"}
                    ${o.proprietario_citta ? `<br>${o.proprietario_citta}` : ""}
                    ${o.proprietario_cap ? ` ${o.proprietario_cap}` : ""}
                    ${o.proprietario_provincia ? ` (${o.proprietario_provincia})` : ""}
                  </span>
                </div>
              </div>
            </div>

            <div class="detail-box">
              <h3>Supplementi</h3>
              <div class="detail-list">
                ${
                  supplementi.length
                    ? supplementi.map(s => `
                      <div class="detail-row">
                        <strong>${s.nome || "Supplemento"}</strong>
                        <span>${euro(s.prezzo || 0)}</span>
                      </div>
                    `).join("")
                    : `
                      <div class="detail-row">
                        <strong>Supplementi selezionati</strong>
                        <span>Nessuno</span>
                      </div>
                    `
                }
                <div class="detail-row"><strong>Totale supplementi</strong><span>${euro(o.totale_supplementi || 0)}</span></div>
              </div>
            </div>

            <div class="detail-box">
              <h3>Pagamento e ordine</h3>
              <div class="detail-list">
                <div class="detail-row"><strong>Inizio garanzia</strong><span>${formatDateOnlyIT(o.garanzia_inizio)} ore 00:00</span></div>
                <div class="detail-row"><strong>Fine garanzia</strong><span>${formatDateOnlyIT(o.garanzia_fine)} ore 23:59</span></div>
                <div class="detail-row"><strong>Durata garanzia</strong><span>${o.garanzia_durata_mesi || 12} mesi</span></div>
                <div class="detail-row"><strong>Prezzo garanzia</strong><span>${euro(o.prezzo || 0)}</span></div>
                <div class="detail-row"><strong>Prezzo finale</strong><span>${euro(getPrezzoOrdine(o))}</span></div>
                <div class="detail-row"><strong>Metodo pagamento</strong><span>${o.metodo_pagamento || "—"}</span></div>
                <div class="detail-row"><strong>Stato pagamento</strong><span>${o.stato_pagamento || "—"}</span></div>
                <div class="detail-row"><strong>Data pagamento</strong><span>${formatDateTime(o.paid_at)}</span></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll(".btnToggleDettagli").forEach(button => {
      button.addEventListener("click", function () {
        const id = button.dataset.detailId;
        const el = document.getElementById(id);
        if (el) el.classList.toggle("open");
      });
    });
  }



  function renderPagamenti(ordini) {
    const box = document.getElementById("paymentsContainer");
    if (!box) return;
    const pagati = ordini.filter(o => String(o.stato_pagamento || o.stato || "").toLowerCase() === "pagato").length;
    const attesa = ordini.filter(o => String(o.stato_pagamento || "").toLowerCase() === "in_attesa").length;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("payTotali", ordini.length);
    setText("payPagati", pagati);
    setText("payAttesa", attesa);

    if (!ordini.length) {
      box.innerHTML = `<div class="empty-state">Non ci sono ancora pagamenti da mostrare.</div>`;
      return;
    }

    box.innerHTML = ordini.slice(0, 8).map(o => `
      <div class="data-row-card">
        <div class="data-row-icon"><i class="fa-solid fa-receipt"></i></div>
        <div>
          <h3>Pratica #${o.id} · ${euro(getPrezzoOrdine(o))}</h3>
          <p>${o.prodotto_nome || "Garanzia"} · ${o.veicolo_targa || "Targa non presente"} · ${formatDateTime(o.created_at)}</p>
        </div>
        ${getStatusPill(o)}
      </div>
    `).join("");
  }

  function renderVeicoli(ordini) {
    const box = document.getElementById("vehiclesContainer");
    if (!box) return;
    const seen = new Set();
    const veicoli = ordini.filter(o => {
      const key = String(o.veicolo_targa || "").toUpperCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!veicoli.length) {
      box.innerHTML = `<div class="empty-state">Nessun veicolo ancora collegato alle pratiche. Avvia un confronto dal comparatore.</div>`;
      return;
    }

    box.innerHTML = veicoli.map(o => `
      <div class="data-row-card">
        <div class="data-row-icon"><i class="fa-solid fa-car-side"></i></div>
        <div>
          <h3>${o.veicolo_targa || "—"} · ${o.veicolo_modello || "Modello non indicato"}</h3>
          <p>Anno ${o.veicolo_anno || "—"} · ${o.veicolo_km ? formatKm(o.veicolo_km) : "km non indicati"} · ultima pratica ${formatDate(o.created_at)}</p>
        </div>
        <span class="status-pill">In archivio</span>
      </div>
    `).join("");
  }


  function formatDateOnly(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("it-IT");
  }

  function valoreCert(o, fields, fallback = "—") {
    for (const f of fields) {
      if (o[f] !== undefined && o[f] !== null && String(o[f]).trim() !== "") return o[f];
    }
    return fallback;
  }

  function renderCertificatoDashboard(ordineId) {
    const o = tuttiGliOrdini.find(item => Number(item.id) === Number(ordineId));
    const box = document.getElementById("certificateViewer");
    if (!o || !box) return;

    const numero = o.numero_certificato || `EF-${new Date().getFullYear()}-${String(o.id || 1).padStart(6, "0")}`;
    const nomeCompleto = `${o.proprietario_nome || ""} ${o.proprietario_cognome || ""}`.trim() || "—";
    const prezzo = o.prezzo || 0;
    const supplementi = o.totale_supplementi || 0;
    const totale = o.prezzo_finale || prezzo;
    const linkVerifica = `${window.location.origin}/verifica-certificato.html?certificato=${encodeURIComponent(numero)}`;

    box.innerHTML = `
      <article class="premium-certificate">
        <div class="cert-head">
          <div class="cert-brand">
            <div class="cert-logo">EF</div>
            <div><h2>Estendi<span>Facile</span><small>.it</small></h2><p>Certificato ufficiale di garanzia</p></div>
          </div>
          <div class="cert-active-badge"><i class="fa-solid fa-shield-halved"></i> Garanzia attiva</div>
        </div>

        <div class="cert-meta">
          <div><span class="cert-label">Numero certificato</span><span class="cert-value">${numero}</span></div>
          <div><span class="cert-label">Data emissione</span><span class="cert-value">${formatDateOnly(o.certificato_emesso_at || o.updated_at || o.created_at)}</span></div>
          <div><span class="cert-label">Stato</span><span class="cert-value green">Attivo</span></div>
          <div class="cert-shield"><i class="fa-solid fa-shield-halved"></i></div>
        </div>

        <div class="cert-grid">
          <section class="cert-info-card">
            <h3 class="cert-card-title"><i class="fa-solid fa-shield-halved"></i>Dati garanzia</h3>
            <div class="cert-fields">
              <div class="cert-field"><small>Prodotto</small><strong>${valoreCert(o,["garanzia_nome","prodotto_nome"],"Garanzia")}</strong></div>
              <div class="cert-field"><small>Partner</small><strong>${valoreCert(o,["partner_nome","garanzia_brand"],"—")}</strong></div>
              <div class="cert-field"><small>Durata</small><strong>${valoreCert(o,["garanzia_durata","garanzia_durata_mesi"],12)} mesi</strong></div>
              <div class="cert-field"><small>Copertura</small><strong>${valoreCert(o,["garanzia_copertura"],"Motore, cambio, impianto elettrico, assistenza stradale")}</strong></div>
            </div>
          </section>

          <section class="cert-info-card">
            <h3 class="cert-card-title"><i class="fa-solid fa-car-side"></i>Dati veicolo</h3>
            <div class="cert-fields">
              <div class="cert-field"><small>Targa</small><strong>${valoreCert(o,["veicolo_targa"])}</strong></div>
              <div class="cert-field"><small>Modello</small><strong>${valoreCert(o,["veicolo_modello"])}</strong></div>
              <div class="cert-field"><small>Anno</small><strong>${valoreCert(o,["veicolo_anno"])}</strong></div>
              <div class="cert-field"><small>Chilometri</small><strong>${o.veicolo_km ? formatKm(o.veicolo_km) : "—"}</strong></div>
            </div>
          </section>

          <section class="cert-info-card">
            <h3 class="cert-card-title"><i class="fa-solid fa-user"></i>Proprietario</h3>
            <div class="cert-fields">
              <div class="cert-field"><small>Nome</small><strong>${nomeCompleto}</strong></div>
              <div class="cert-field"><small>Codice fiscale</small><strong>${valoreCert(o,["proprietario_cf"])}</strong></div>
              <div class="cert-field"><small>Contatti</small><strong>${valoreCert(o,["proprietario_email"])}<br>${valoreCert(o,["proprietario_telefono"])}</strong></div>
            </div>
          </section>

          <section class="cert-info-card">
            <h3 class="cert-card-title"><i class="fa-solid fa-euro-sign"></i>Importi</h3>
            <div class="cert-fields">
              <div class="cert-field"><small>Prezzo garanzia</small><strong>${euro(prezzo)}</strong></div>
              <div class="cert-field"><small>Supplementi</small><strong>${euro(supplementi)}</strong></div>
            </div>
            <div class="cert-amount-row"><span class="cert-label">Totale</span><span class="cert-total">${euro(totale)}</span></div>
          </section>

          <section class="cert-info-card cert-validity">
            <div>
              <h3 class="cert-card-title"><i class="fa-solid fa-shield-halved"></i>Validità e verifica autenticità</h3>
              <div class="cert-fields">
                <div class="cert-field"><small>Data inizio</small><strong>${formatDateOnly(o.garanzia_inizio)}</strong></div>
                <div class="cert-field"><small>Data fine</small><strong>${formatDateOnly(o.garanzia_fine)}</strong></div>
                <div class="cert-field" style="grid-column:1 / -1;"><small>Link verifica</small><strong>${linkVerifica}</strong></div>
              </div>
            </div>
            <div class="cert-qr"><div><div class="cert-qr-box"></div><div class="cert-label" style="text-align:center;margin-top:10px;">Verifica QR</div></div></div>
          </section>
        </div>

        <div class="cert-note"><i class="fa-solid fa-shield-halved"></i><span>Il presente documento certifica l'attivazione della garanzia secondo le condizioni contrattuali associate al prodotto acquistato. Documento generato automaticamente dalla piattaforma EstendiFacile.it.</span></div>
        <div class="cert-footer"><strong>EstendiFacile.it</strong> &nbsp;•&nbsp; Certificato digitale verificabile</div>
      </article>
    `;

    showSection("certificate");
  }

  function renderDocumenti(ordini) {
    const box = document.getElementById("documentsContainer");
    if (!box) return;
    const completati = ordini.filter(o => String(o.stato_pagamento || o.stato || "").toLowerCase() === "pagato");
    if (!completati.length) {
      box.innerHTML = `<div class="empty-state">I documenti saranno disponibili quando una pratica risulterà completata o pagata.</div>`;
      return;
    }

    box.innerHTML = completati.slice(0, 8).map(o => `
      <div class="data-row-card">
        <div class="data-row-icon"><i class="fa-solid fa-file-lines"></i></div>
        <div>
          <h3>Certificato pratica #${o.id}</h3>
          <p>${o.prodotto_nome || o.garanzia_nome || "Garanzia"} · ${o.veicolo_targa || "—"} · ${formatDateTime(o.created_at)}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
          ${o.numero_certificato ? `<span class="status-pill">${o.numero_certificato}</span>` : `<span class="status-pill pending">In attesa certificato</span>`}
          <button class="hero-btn primary btnOpenCertificate" type="button" data-id="${o.id}"><i class="fa-solid fa-shield-halved"></i> Visualizza</button>
          ${o.certificato_pdf_url ? `<a class="hero-btn" href="${o.certificato_pdf_url}" target="_blank" rel="noopener"><i class="fa-solid fa-print"></i> Stampa PDF</a>` : ""}
        </div>
      </div>
    `).join("");

    box.querySelectorAll(".btnOpenCertificate").forEach(btn => {
      btn.addEventListener("click", () => renderCertificatoDashboard(btn.dataset.id));
    });
  }

  function filtraOrdini() {
    const query = document.getElementById("ordersSearchInput").value.trim().toLowerCase();

    if (!query) {
      renderOrdini(tuttiGliOrdini);
      return;
    }

    const filtrati = tuttiGliOrdini.filter(o =>
      String(o.prodotto_nome || "").toLowerCase().includes(query) ||
      String(o.veicolo_targa || "").toLowerCase().includes(query) ||
      String(o.veicolo_modello || "").toLowerCase().includes(query) ||
      String(o.proprietario_nome || "").toLowerCase().includes(query) ||
      String(o.proprietario_cognome || "").toLowerCase().includes(query)
    );

    paginaCorrente = 1;
    renderOrdini(filtrati);
  }

  async function caricaOrdini() {
    const container = document.getElementById("ordersContainer");

    try {
      const res = await fetch("/api/miei-ordini", {
        headers: { Authorization: "Bearer " + concessionarioToken }
      });

      const data = await res.json();

      if (!res.ok) {
        container.innerHTML = `
          <div class="empty-state">
            ${data.error || "Errore nel caricamento degli ordini."}
          </div>
        `;
        return;
      }

      tuttiGliOrdini = data;
      aggiornaKpi(data);
      renderOrdini(data);
      renderPagamenti(data);
      renderVeicoli(data);
      renderDocumenti(data);
      caricaTicketsConcessionario();
    } catch {
      container.innerHTML = `
        <div class="empty-state">
          Errore di connessione al server.
        </div>
      `;
    }
  }



  function aggiornaBadgeTicketsConcessionario(lista) {
    const risposti = (Array.isArray(lista) ? lista : []).filter(t => String(t.stato || "").toLowerCase() === "risposto").length;
    const ticketNav = document.querySelector('.nav-item[data-section="tickets"]');
    if (ticketNav) {
      let badge = ticketNav.querySelector('.sidebar-badge.ticket-badge-concessionario');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sidebar-badge ticket-badge-concessionario';
        ticketNav.appendChild(badge);
      }
      badge.textContent = risposti;
      badge.classList.toggle('show', risposti > 0);
    }
    const dot = document.querySelector('.top-icon .dot');
    if (dot) {
      dot.textContent = risposti;
      dot.style.display = risposti > 0 ? 'inline-flex' : 'none';
    }
  }

  async function caricaTicketsConcessionario() {
    const box = document.getElementById("ticketsContainer");
    if (!box) return;
    box.innerHTML = `<div class="empty-state">Caricamento ticket...</div>`;
    try {
      const res = await fetch("/api/quote-tickets?requester_type=concessionario");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore caricamento ticket");
      aggiornaBadgeTicketsConcessionario(data);
      if (!data.length) { box.innerHTML = `<div class="empty-state">Non hai ancora aperto ticket preventivi.</div>`; return; }
      box.innerHTML = data.map(t => {
        const stato = String(t.stato || "aperto").toLowerCase();
        const haPreventivo = Number(t.prezzo_preventivo || 0) > 0 && stato === "risposto";
        return `
        <div class="data-row-card ticket-card-${stato}">
          <div class="data-row-icon"><i class="fa-solid fa-ticket"></i></div>
          <div>
            <h3>Ticket #${t.id} · ${t.partner_nome || t.garanzia_brand || "Partner"}</h3>
            <p>${t.targa || "—"} · ${t.modello || "—"} · ${t.anno || "—"} · ${t.km ? formatKm(t.km) : "—"}</p>
            ${t.risposta ? `<p><strong>Risposta partner:</strong> ${t.risposta}</p>` : ""}
            ${haPreventivo ? `<div class="form-actions-inline" style="margin-top:12px;"><button class="hero-btn primary btnAccettaTicketConc" type="button" data-id="${t.id}">Accetta preventivo e acquista</button><button class="hero-btn secondary btnRifiutaTicketConc" type="button" data-id="${t.id}">Rifiuta e chiudi ticket</button></div>` : ""}
          </div>
          <div style="text-align:right;display:grid;gap:8px;justify-items:end;">
            <span class="status-pill ${stato==="aperto" ? "pending" : ""}">${t.stato || "aperto"}</span>
            ${t.prezzo_preventivo ? `<strong>${euro(t.prezzo_preventivo)}</strong>` : `<span class="mini-label">In attesa preventivo</span>`}
          </div>
        </div>`;
      }).join("");
      box.querySelectorAll(".btnAccettaTicketConc").forEach(btn => btn.addEventListener("click", async () => { btn.disabled = true; try { await accettaPreventivoConcessionario(btn.dataset.id); } catch(e){ btn.disabled = false; alert(e.message || "Errore"); } }));
      box.querySelectorAll(".btnRifiutaTicketConc").forEach(btn => btn.addEventListener("click", async () => { if (!confirm("Rifiutare e chiudere questo ticket?")) return; btn.disabled = true; try { await rifiutaPreventivoConcessionario(btn.dataset.id); } catch(e){ btn.disabled = false; alert(e.message || "Errore"); } }));
    } catch (error) { box.innerHTML = `<div class="empty-state">${error.message || "Errore di connessione."}</div>`; }
  }

  document.querySelectorAll(".sidebar-section-btn").forEach(button => {
    button.addEventListener("click", function () {
      showSection(button.dataset.section, button);
    });
  });

  document.getElementById("btnLogout").addEventListener("click", logout);
  const btnApriRicerca = document.getElementById("btnApriRicercaDashboard");
  const btnRisultatiRicerca = document.getElementById("btnVaiAiRisultatiDashboard");
  if (btnApriRicerca) btnApriRicerca.addEventListener("click", apriRicercaDashboard);
  if (btnRisultatiRicerca) btnRisultatiRicerca.addEventListener("click", vaiAiRisultatiDaDashboard);
  const btnApriComparatore = document.getElementById("btnApriComparatoreDashboard");
  const btnRisultatiComparatore = document.getElementById("btnVaiAiRisultatiComparatore");
  if (btnApriComparatore) btnApriComparatore.addEventListener("click", apriComparatoreDashboard);
  if (btnRisultatiComparatore) btnRisultatiComparatore.addEventListener("click", vaiAiRisultatiComparatore);
  document.getElementById("ordersSearchInput").addEventListener("input", filtraOrdini);
  document.getElementById("btnRefreshTickets")?.addEventListener("click", caricaTicketsConcessionario);
  setInterval(caricaTicketsConcessionario, 15000);

  document.querySelectorAll('input[name="cmpVehicleType"]').forEach(radio => {
    radio.addEventListener("change", () => updateComparatorVehicleTypeUI(true));
  });
  updateComparatorVehicleTypeUI(false);

  if (window.location.hash === "#comparatore" || localStorage.getItem("restoreComparatorResults") === "1") {
    showSection("comparatore");
    const v = getVeicoloInline();
    const targaEl = document.getElementById("cmpTargaInput");
    const modelloEl = document.getElementById("cmpModelloInput");
    const annoEl = document.getElementById("cmpAnnoInput");
    const kmEl = document.getElementById("cmpKmInput");
    const extra = document.getElementById("cmpExtraFields");
    const typeRadio = document.querySelector('input[name="cmpVehicleType"][value="' + (v.tipo || "auto") + '"]');
    if (typeRadio) typeRadio.checked = true;
    updateComparatorVehicleTypeUI(false);
    if (targaEl) targaEl.value = v.targa || "";
    if (modelloEl) modelloEl.value = v.modello || "";
    if (annoEl) annoEl.value = v.anno || "";
    if (kmEl) kmEl.value = v.km || "";
    if (extra && v.targa) extra.classList.add("open");
    if (v.targa && v.modello && v.anno && v.km) {
      localStorage.removeItem("restoreComparatorResults");
      mostraRisultatiInline({ resultsId: "cmpInlineResults" });
    }
  }

  caricaProfilo();
  caricaOrdini();
});