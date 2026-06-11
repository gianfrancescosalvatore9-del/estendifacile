document.addEventListener("DOMContentLoaded", function () {
 AuthGuard.requirePartner();

const partnerToken = localStorage.getItem("partnerToken");

  let editId = null;
  let tutteLeGaranzie = [];
  let tuttiISupplementi = [];
  let tuttiGliOrdini = [];
  let currentPdfUrl = "";
  let supplementoEditId = null;

  function showSection(name, btn) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById("section-" + name).classList.add("active");

    document.querySelectorAll(".partner-section-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
  }

  function apriOrdiniRicevuti() {
    const btn = document.querySelector('.partner-section-btn[data-section="orders"]');
    showSection("orders", btn);
  }

  function euroToCents(value) {
    return Math.round(parseFloat(value || 0) * 100);
  }

  function centsToEuro(value) {
    return (Number(value || 0) / 100).toFixed(2).replace(".", ",") + "€";
  }

  function centsToEuroInput(value) {
    return (Number(value || 0) / 100).toFixed(2);
  }

  function euroInputToCents(value) {
    return Math.round(Number(value || 0) * 100);
  }

  function formatDateIT(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("it-IT");
  }

  function safe(value, fallback = "—") {
    return value || fallback;
  }

  function statoPagamentoLabel(stato) {
    if (stato === "pagato") return `<span class="pill">Pagato</span>`;
    if (stato === "in_attesa") return `<span class="pill warn">In attesa</span>`;
    return `<span class="pill off">${stato || "non pagato"}</span>`;
  }

  function statoOrdineLabel(stato) {
    if (stato === "attivo") return `<span class="pill blue">Attivo</span>`;
    if (stato === "pagato") return `<span class="pill">Pagato</span>`;
    if (stato === "creato") return `<span class="pill off">Creato</span>`;
    return `<span class="pill off">${stato || "—"}</span>`;
  }

  function scrollToForm() {
    const btn = document.querySelector('.partner-section-btn[data-section="form"]');
    showSection("form", btn);
    setTimeout(() => {
      document.getElementById("formSection").scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

 function logoutPartner() {
  AuthGuard.logoutPartner();
}
  function toggleLimitiFields() {
    const checked = document.getElementById("limitiAttivi").checked;
    document.getElementById("limitiFields").style.display = checked ? "grid" : "none";
  }

  function resetForm() {
    editId = null;
    currentPdfUrl = "";

    document.getElementById("formTitle").textContent = "Nuova garanzia";
    document.getElementById("saveBtn").textContent = "Salva garanzia";
    document.getElementById("nome").value = "";
    document.getElementById("brand").value = "";
    document.getElementById("durata").value = "";
    document.getElementById("prezzo").value = "";
    document.getElementById("copertura").value = "";
    document.getElementById("stato").value = "attiva";
    document.getElementById("descrizione").value = "";
    document.getElementById("pdfFile").value = "";
    document.getElementById("limitiAttivi").checked = false;
    document.getElementById("limiteKm").value = "";
    document.getElementById("limiteImmatricolazione").value = "";

    toggleLimitiFields();

    const msg = document.getElementById("partnerMsg");
    msg.textContent = "";
    msg.className = "message";
  }

  async function caricaPartner() {
    try {
      const res = await fetch("/api/partner/me", {
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();

      if (!res.ok) {
        document.getElementById("partnerInfo").textContent = data.error || "Errore caricamento partner";
        return;
      }

      document.getElementById("partnerInfo").textContent = `${data.nome_azienda} • ${data.email}`;
      document.getElementById("sidebarPartnerName").textContent = data.nome_azienda || "Partner";

      document.getElementById("azienda_nome").value = data.nome_azienda || "";
      document.getElementById("azienda_referente").value = data.referente || "";
      document.getElementById("azienda_email").value = data.email || "";
      document.getElementById("azienda_telefono").value = data.telefono || "";
      document.getElementById("azienda_piva").value = data.partita_iva || "";
      document.getElementById("azienda_indirizzo").value = data.indirizzo || "";
      document.getElementById("azienda_citta").value = data.citta || "";
      document.getElementById("azienda_cap").value = data.cap || "";
      document.getElementById("azienda_provincia").value = data.provincia || "";
    } catch {
      document.getElementById("partnerInfo").textContent = "Errore di connessione";
    }
  }

  async function caricaDashboardPartner() {
    try {
      const res = await fetch("/api/partner/dashboard", {
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();
      if (!res.ok) return;

      document.getElementById("kpiOrdini").textContent = data.totale_ordini || 0;
      document.getElementById("kpiVenduto").textContent = centsToEuro(data.totale_venduto || 0);
      document.getElementById("kpiGaranzie").textContent = data.totale_garanzie || 0;
    } catch {}
  }

  async function salvaProfiloPartner() {
    const msg = document.getElementById("partnerProfileMsg");
    msg.textContent = "";
    msg.className = "message";

    const payload = {
      nome_azienda: document.getElementById("azienda_nome").value.trim(),
      referente: document.getElementById("azienda_referente").value.trim(),
      telefono: document.getElementById("azienda_telefono").value.trim(),
      partita_iva: document.getElementById("azienda_piva").value.trim(),
      indirizzo: document.getElementById("azienda_indirizzo").value.trim(),
      citta: document.getElementById("azienda_citta").value.trim(),
      cap: document.getElementById("azienda_cap").value.trim(),
      provincia: document.getElementById("azienda_provincia").value.trim()
    };

    if (!payload.nome_azienda) {
      msg.textContent = "La ragione sociale è obbligatoria.";
      msg.classList.add("error");
      return;
    }

    try {
      const res = await fetch("/api/partner/profilo", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + partnerToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Errore salvataggio profilo partner.";
        msg.classList.add("error");
        return;
      }

      msg.textContent = "Dati aziendali aggiornati con successo.";
      msg.classList.add("success");
      caricaPartner();
    } catch {
      msg.textContent = "Errore di connessione al server.";
      msg.classList.add("error");
    }
  }

  function aggiornaKPI(lista) {
    document.getElementById("kpiGaranzie").textContent = lista.length;
  }

  function aggiornaKpiSupplementi(lista) {
    const attivi = lista.filter(s => Number(s.attivo || 0) === 1).length;
    document.getElementById("kpiSupplementi").textContent = attivi;
  }

  async function caricaOrdiniPartner() {
    const tbody = document.getElementById("ordiniTable");
    const msg = document.getElementById("ordiniMsg");

    msg.textContent = "";
    msg.className = "message";
    tbody.innerHTML = `<tr><td colspan="7" class="empty-table">Caricamento ordini...</td></tr>`;

    try {
      const res = await fetch("/api/partner/ordini", {
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();

      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-table">${data.error || "Errore caricamento ordini."}</td></tr>`;
        return;
      }

      tuttiGliOrdini = data;
      renderOrdini(data);
      aggiornaNotificaOrdini(data);
    } catch {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-table">Errore di connessione al server.</td></tr>`;
    }
  }

function aggiornaNotificaOrdini(ordini) {
  const box = document.getElementById("ordiniNotification");
  const text = document.getElementById("ordiniNotificationText");
  const overview = document.getElementById("overviewOrdiniText");
  const sidebarBadge = document.getElementById("sidebarOrdiniBadge");

  const daGestire = ordini.filter(o => {
    const pagato = String(o.stato_pagamento || "").toLowerCase() === "pagato";
    const senzaCertificato =
      !o.numero_certificato &&
      !o.certificato_pdf_url;

    return pagato && senzaCertificato;
  });

  if (sidebarBadge) {
    sidebarBadge.textContent = daGestire.length;

    if (daGestire.length > 0) {
      sidebarBadge.style.display = "inline-flex";
      sidebarBadge.classList.add("show");
    } else {
      sidebarBadge.style.display = "none";
      sidebarBadge.classList.remove("show");
    }
  }

  if (overview) {
    overview.innerHTML = `
      Hai ricevuto <strong>${ordini.length}</strong> ordini.
      ${
        daGestire.length > 0
          ? `<strong>${daGestire.length}</strong> richiedono emissione certificato.`
          : "Nessun ordine in attesa di certificato."
      }
    `;
  }

  if (box && text) {
    if (daGestire.length > 0) {
      text.textContent = `Hai ${daGestire.length} ordine/i da gestire: emetti il certificato.`;
      box.classList.add("show");
    } else {
      box.classList.remove("show");
    }
  }
}

  function renderOrdini(lista) {
    const tbody = document.getElementById("ordiniTable");

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-table">Nessun ordine ricevuto.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(o => `
      <tr>
        <td>
          <div class="product-title">#${o.id}</div>
          <div class="product-desc">${formatDateIT(o.created_at)}</div>
          ${statoOrdineLabel(o.stato)}
        </td>
        <td>
          <div class="product-title">${safe(o.garanzia_nome || o.prodotto_nome)}</div>
          <div class="product-desc">${safe(o.garanzia_brand)}</div>
        </td>
        <td>
          <strong>${safe(`${o.proprietario_nome || ""} ${o.proprietario_cognome || ""}`.trim())}</strong><br>
          <small>${safe(o.proprietario_email)}</small><br>
          <small>${safe(o.proprietario_telefono)}</small>
        </td>
        <td>
          <strong>${safe(o.veicolo_targa)}</strong><br>
          <small>${safe(o.veicolo_modello)}</small><br>
          <small>${safe(o.veicolo_anno)} • ${safe(o.veicolo_km)} km</small>
        </td>
        <td>
          ${statoPagamentoLabel(o.stato_pagamento)}<br>
          <small>${safe(o.metodo_pagamento)}</small>
        </td>
        <td><strong>${centsToEuro(o.prezzo_finale || o.prezzo || 0)}</strong></td>
        <td>
          <div class="table-actions">
            <button class="mini-btn edit btnDettaglioOrdine" type="button" data-id="${o.id}">Dettaglio</button>
            ${
              o.stato_pagamento === "pagato" && !o.numero_certificato
                ? `<button class="mini-btn success btnEmettiCertificato" type="button" data-id="${o.id}">Emetti certificato</button>`
                : ""
            }
            ${
              o.certificato_pdf_url
                ? `<a class="mini-btn gray" href="${o.certificato_pdf_url}" target="_blank" style="text-decoration:none;display:inline-block;">Apri PDF</a>`
                : ""
            }
          </div>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btnDettaglioOrdine").forEach(btn => {
      btn.addEventListener("click", () => mostraDettaglioOrdine(btn.dataset.id));
    });

    document.querySelectorAll(".btnEmettiCertificato").forEach(btn => {
      btn.addEventListener("click", () => emettiCertificato(btn.dataset.id));
    });
  }

  function filtraOrdini() {
    const query = document.getElementById("searchOrdiniInput").value.trim().toLowerCase();
    const stato = document.getElementById("filtroStatoOrdini").value;

    let filtrati = tuttiGliOrdini.slice();

    if (query) {
      filtrati = filtrati.filter(o =>
        String(o.proprietario_nome || "").toLowerCase().includes(query) ||
        String(o.proprietario_cognome || "").toLowerCase().includes(query) ||
        String(o.proprietario_email || "").toLowerCase().includes(query) ||
        String(o.veicolo_targa || "").toLowerCase().includes(query) ||
        String(o.veicolo_modello || "").toLowerCase().includes(query) ||
        String(o.garanzia_nome || o.prodotto_nome || "").toLowerCase().includes(query)
      );
    }

    if (stato) {
      if (stato === "attivo") filtrati = filtrati.filter(o => o.stato === "attivo");
      else filtrati = filtrati.filter(o => o.stato_pagamento === stato);
    }

    renderOrdini(filtrati);
  }

  async function mostraDettaglioOrdine(id) {
    const box = document.getElementById("ordineDettaglioBox");
    box.classList.add("show");
    box.innerHTML = "Caricamento dettaglio ordine...";

    try {
      const res = await fetch(`/api/partner/ordini/${id}`, {
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const o = await res.json();

      if (!res.ok) {
        box.innerHTML = `<div class="message error">${o.error || "Errore caricamento dettaglio."}</div>`;
        return;
      }

      box.innerHTML = `
        <div class="card-head" style="margin-bottom:14px;">
          <div>
            <h2 style="font-size:24px;">Dettaglio ordine #${o.id}</h2>
            <p class="card-subtitle">Cliente, veicolo, garanzia e validità.</p>
          </div>
          <button class="mini-btn gray" type="button" id="btnChiudiDettaglioOrdine">Chiudi</button>
        </div>

        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Cliente</div><div class="detail-value">${safe(`${o.proprietario_nome || ""} ${o.proprietario_cognome || ""}`.trim())}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${safe(o.proprietario_email)}</div></div>
          <div class="detail-item"><div class="detail-label">Telefono</div><div class="detail-value">${safe(o.proprietario_telefono)}</div></div>
          <div class="detail-item"><div class="detail-label">Codice fiscale</div><div class="detail-value">${safe(o.proprietario_cf)}</div></div>
          <div class="detail-item"><div class="detail-label">Indirizzo</div><div class="detail-value">${safe(o.proprietario_indirizzo)}, ${safe(o.proprietario_citta)} ${safe(o.proprietario_provincia)}</div></div>
          <div class="detail-item"><div class="detail-label">Concessionario</div><div class="detail-value">${safe(o.concessionario_nome)}<br>${safe(o.concessionario_email)}</div></div>
          <div class="detail-item"><div class="detail-label">Veicolo</div><div class="detail-value">${safe(o.veicolo_modello)}<br>${safe(o.veicolo_targa)}</div></div>
          <div class="detail-item"><div class="detail-label">Anno / Km</div><div class="detail-value">${safe(o.veicolo_anno)} • ${safe(o.veicolo_km)} km</div></div>
          <div class="detail-item"><div class="detail-label">Garanzia</div><div class="detail-value">${safe(o.garanzia_nome || o.prodotto_nome)}<br>${safe(o.garanzia_durata || o.garanzia_durata_mesi)} mesi</div></div>
          <div class="detail-item"><div class="detail-label">Validità</div><div class="detail-value">${safe(o.garanzia_inizio)} → ${safe(o.garanzia_fine)}</div></div>
          <div class="detail-item"><div class="detail-label">Totale</div><div class="detail-value">${centsToEuro(o.prezzo_finale || o.prezzo || 0)}</div></div>
          <div class="detail-item"><div class="detail-label">Certificato</div><div class="detail-value">${o.numero_certificato || "Non ancora emesso"}</div></div>
        </div>
      `;

      document.getElementById("btnChiudiDettaglioOrdine").addEventListener("click", () => {
        box.classList.remove("show");
      });
    } catch {
      box.innerHTML = `<div class="message error">Errore di connessione al server.</div>`;
    }
  }

  async function emettiCertificato(id) {
    const conferma = confirm("Vuoi emettere il certificato per questo ordine?");
    if (!conferma) return;

    const msg = document.getElementById("ordiniMsg");
    msg.textContent = "";
    msg.className = "message";

    try {
      const res = await fetch(`/api/partner/ordini/${id}/emetti-certificato`, {
        method: "POST",
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Errore emissione certificato.";
        msg.classList.add("error");
        return;
      }

      msg.textContent = `Certificato emesso: ${data.numero_certificato}`;
      msg.classList.add("success");

      await caricaOrdiniPartner();
      await caricaDashboardPartner();
    } catch {
      msg.textContent = "Errore di connessione al server.";
      msg.classList.add("error");
    }
  }

  async function caricaSupplementi() {
    const tbody = document.getElementById("supplementiTable");
    const msg = document.getElementById("supplementiMsg");

    msg.textContent = "";
    msg.className = "message";
    tbody.innerHTML = `<tr><td colspan="4" class="empty-table">Caricamento supplementi...</td></tr>`;

    try {
      const res = await fetch("/api/partner/supplementi", {
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();

      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-table">${data.error || "Errore caricamento supplementi."}</td></tr>`;
        return;
      }

      tuttiISupplementi = data;
      renderSupplementi(data);
      aggiornaKpiSupplementi(data);
    } catch {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-table">Errore di connessione al server.</td></tr>`;
    }
  }

  function codiceDaNomeSupplemento(nome) {
    return String(nome || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "supplemento";
  }

  function apriEditorSupplemento(supplemento = null) {
    supplementoEditId = supplemento ? supplemento.id : null;
    document.getElementById("supplementFormTitle").textContent = supplemento ? "Modifica supplemento" : "Nuovo supplemento";
    document.getElementById("suppNome").value = supplemento ? (supplemento.nome || "") : "";
    document.getElementById("suppCodice").value = supplemento ? (supplemento.codice || "") : "";
    document.getElementById("suppPrezzoForm").value = supplemento ? centsToEuroInput(supplemento.prezzo || 0) : "";
    document.getElementById("suppAttivoForm").checked = supplemento ? Number(supplemento.attivo || 0) === 1 : true;
    document.getElementById("supplementEditor").style.display = "block";
    document.getElementById("supplementiMsg").textContent = "";
    document.getElementById("supplementiMsg").className = "message";
    setTimeout(() => document.getElementById("supplementEditor").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function chiudiEditorSupplemento() {
    supplementoEditId = null;
    document.getElementById("supplementEditor").style.display = "none";
    document.getElementById("suppNome").value = "";
    document.getElementById("suppCodice").value = "";
    document.getElementById("suppPrezzoForm").value = "";
    document.getElementById("suppAttivoForm").checked = true;
  }

  function renderSupplementi(lista) {
    const tbody = document.getElementById("supplementiTable");

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-table">Nessun supplemento disponibile. Crea il primo supplemento con il pulsante in alto.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map((s) => `
      <tr>
        <td><input id="suppNome_${s.id}" class="supplement-name-input" type="text" value="${String(s.nome || "").replace(/"/g, "&quot;")}" /></td>
        <td><span class="supplement-code">${s.codice || "—"}</span></td>
        <td><input id="suppPrezzo_${s.id}" class="supplement-price-input" type="number" step="0.01" value="${centsToEuroInput(s.prezzo)}" /></td>
        <td>
          <label class="supplement-toggle">
            <input id="suppAttivo_${s.id}" type="checkbox" ${Number(s.attivo || 0) === 1 ? "checked" : ""} />
            <span>${Number(s.attivo || 0) === 1 ? "Attivo" : "Disattivo"}</span>
          </label>
        </td>
        <td>
          <div class="table-actions">
            <button class="mini-btn edit btnSalvaSupplemento" type="button" data-id="${s.id}">Salva</button>
            <button class="mini-btn gray btnModificaSupplemento" type="button" data-id="${s.id}">Modifica</button>
            <button class="mini-btn delete btnEliminaSupplemento" type="button" data-id="${s.id}">Elimina</button>
          </div>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btnSalvaSupplemento").forEach(btn => {
      btn.addEventListener("click", () => salvaSupplemento(btn.dataset.id));
    });

    document.querySelectorAll(".btnModificaSupplemento").forEach(btn => {
      btn.addEventListener("click", () => {
        const supplemento = tuttiISupplementi.find(s => Number(s.id) === Number(btn.dataset.id));
        if (supplemento) apriEditorSupplemento(supplemento);
      });
    });

    document.querySelectorAll(".btnEliminaSupplemento").forEach(btn => {
      btn.addEventListener("click", () => eliminaSupplemento(btn.dataset.id));
    });
  }

  async function salvaSupplemento(id) {
    const msg = document.getElementById("supplementiMsg");
    const prezzoValue = document.getElementById(`suppPrezzo_${id}`).value;
    const nomeValue = document.getElementById(`suppNome_${id}`).value.trim();
    const attivoValue = document.getElementById(`suppAttivo_${id}`).checked ? 1 : 0;
    const prezzoCentesimi = euroInputToCents(prezzoValue);

    msg.textContent = "";
    msg.className = "message";

    if (!nomeValue) {
      msg.textContent = "Il nome del supplemento è obbligatorio.";
      msg.classList.add("error");
      return;
    }

    if (prezzoCentesimi < 0) {
      msg.textContent = "Il prezzo non può essere negativo.";
      msg.classList.add("error");
      return;
    }

    try {
      const res = await fetch(`/api/partner/supplementi/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + partnerToken
        },
        body: JSON.stringify({ nome: nomeValue, prezzo: prezzoCentesimi, attivo: attivoValue })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Errore aggiornamento supplemento.";
        msg.classList.add("error");
        return;
      }

      msg.textContent = "Supplemento aggiornato con successo.";
      msg.classList.add("success");
      caricaSupplementi();
    } catch {
      msg.textContent = "Errore di connessione al server.";
      msg.classList.add("error");
    }
  }

  async function salvaSupplementoDaForm() {
    const msg = document.getElementById("supplementiMsg");
    const nome = document.getElementById("suppNome").value.trim();
    const codice = (document.getElementById("suppCodice").value.trim() || codiceDaNomeSupplemento(nome));
    const prezzo = euroInputToCents(document.getElementById("suppPrezzoForm").value);
    const attivo = document.getElementById("suppAttivoForm").checked ? 1 : 0;

    msg.textContent = "";
    msg.className = "message";

    if (!nome) {
      msg.textContent = "Inserisci il nome del supplemento.";
      msg.classList.add("error");
      return;
    }

    if (prezzo < 0) {
      msg.textContent = "Il prezzo non può essere negativo.";
      msg.classList.add("error");
      return;
    }

    try {
      const url = supplementoEditId ? `/api/partner/supplementi/${supplementoEditId}` : "/api/partner/supplementi";
      const method = supplementoEditId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + partnerToken
        },
        body: JSON.stringify({ nome, codice, prezzo, attivo })
      });
      const data = await res.json();
      if (!res.ok) {
        msg.textContent = data.error || "Errore salvataggio supplemento.";
        msg.classList.add("error");
        return;
      }
      msg.textContent = supplementoEditId ? "Supplemento modificato con successo." : "Supplemento aggiunto con successo.";
      msg.classList.add("success");
      chiudiEditorSupplemento();
      await caricaSupplementi();
    } catch {
      msg.textContent = "Errore di connessione al server.";
      msg.classList.add("error");
    }
  }

  async function eliminaSupplemento(id) {
    const supplemento = tuttiISupplementi.find(s => Number(s.id) === Number(id));
    const conferma = confirm(`Vuoi eliminare il supplemento${supplemento ? " “" + supplemento.nome + "”" : ""}?`);
    if (!conferma) return;

    const msg = document.getElementById("supplementiMsg");
    msg.textContent = "";
    msg.className = "message";

    try {
      const res = await fetch(`/api/partner/supplementi/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + partnerToken }
      });
      const data = await res.json();
      if (!res.ok) {
        msg.textContent = data.error || "Errore eliminazione supplemento.";
        msg.classList.add("error");
        return;
      }
      msg.textContent = "Supplemento eliminato con successo.";
      msg.classList.add("success");
      await caricaSupplementi();
    } catch {
      msg.textContent = "Errore di connessione al server.";
      msg.classList.add("error");
    }
  }

  async function caricaGaranzie() {
    try {
      const res = await fetch("/api/partner/garanzie", {
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();

      if (!res.ok) {
        document.getElementById("garanzieTable").innerHTML = `<tr><td colspan="7" class="empty-table">${data.error || "Errore nel caricamento."}</td></tr>`;
        return;
      }

      tutteLeGaranzie = data;
      renderTabella(data);
      aggiornaKPI(data);
    } catch {
      document.getElementById("garanzieTable").innerHTML = `<tr><td colspan="7" class="empty-table">Errore nel caricamento delle garanzie.</td></tr>`;
    }
  }

  function renderTabella(lista) {
    const tbody = document.getElementById("garanzieTable");

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-table">Nessuna garanzia disponibile.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(g => `
      <tr>
        <td>
          <div class="product-title">${g.nome}</div>
          <div class="product-desc">${g.descrizione || ""}</div>
          ${
            g.pdf_url
              ? `<div style="margin-top:8px;"><a href="${g.pdf_url}" target="_blank" style="color:#0369a1;font-weight:900;">Apri PDF</a></div>`
              : ""
          }
        </td>
        <td>${g.brand || "—"}</td>
        <td>${centsToEuro(g.prezzo || 0)}</td>
        <td>${g.durata || "—"} mesi</td>
        <td>
          ${
            Number(g.limiti_attivi || 0) === 1
              ? `<span class="pill warn">Attivi</span><br><small>${g.limite_km ? `Km max: ${Number(g.limite_km).toLocaleString("it-IT")}<br>` : ""}${g.limite_immatricolazione ? `Anno min: ${g.limite_immatricolazione}` : ""}</small>`
              : `<span class="pill off">Disattivi</span>`
          }
        </td>
        <td><span class="pill">${g.stato || "attiva"}</span></td>
        <td><span class="pill">${g.canale_attivazione || "entrambi"}</span></td>
        <td><span class="pill">${g.tipo_veicolo_attivabile || "AUTOVEICOLO"}</span></td>
        <td><span class="pill ${g.servizio_tipo === "GARANZIA_CONFORMITA" ? "warn" : ""}">${g.servizio_tipo === "GARANZIA_CONFORMITA" ? "Garanzia conformità" : "Garanzia guasti"}</span></td>
        <td>
          <div class="table-actions">
            <button class="mini-btn edit btnModificaGaranzia" type="button" data-id="${g.id}">Modifica</button>
            <button class="mini-btn delete btnEliminaGaranzia" type="button" data-id="${g.id}">Elimina</button>
          </div>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btnModificaGaranzia").forEach(btn => {
      btn.addEventListener("click", function () {
        const garanzia = tutteLeGaranzie.find(g => Number(g.id) === Number(btn.dataset.id));
        if (garanzia) modificaGaranzia(garanzia);
      });
    });

    document.querySelectorAll(".btnEliminaGaranzia").forEach(btn => {
      btn.addEventListener("click", () => eliminaGaranzia(btn.dataset.id));
    });
  }

  function filtraGaranzie() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();

    if (!query) {
      renderTabella(tutteLeGaranzie);
      return;
    }

    renderTabella(tutteLeGaranzie.filter(g =>
      String(g.nome || "").toLowerCase().includes(query) ||
      String(g.brand || "").toLowerCase().includes(query)
    ));
  }

  function modificaGaranzia(garanzia) {
    editId = garanzia.id;
    currentPdfUrl = garanzia.pdf_url || "";

    document.getElementById("formTitle").textContent = "Modifica garanzia";
    document.getElementById("saveBtn").textContent = "Aggiorna garanzia";
    document.getElementById("nome").value = garanzia.nome || "";
    document.getElementById("brand").value = garanzia.brand || "";
    document.getElementById("durata").value = garanzia.durata || "";
    document.getElementById("prezzo").value = ((garanzia.prezzo || 0) / 100).toFixed(2);
    document.getElementById("copertura").value = garanzia.copertura || "";
    document.getElementById("stato").value = garanzia.stato || "attiva";
    document.getElementById("descrizione").value = garanzia.descrizione || "";
    document.getElementById("pdfFile").value = "";
    document.getElementById("limitiAttivi").checked = Number(garanzia.limiti_attivi || 0) === 1;
    document.getElementById("limiteKm").value = garanzia.limite_km || "";
    document.getElementById("limiteImmatricolazione").value = garanzia.limite_immatricolazione || "";
    document.getElementById("canaleAttivazione").value = garanzia.canale_attivazione || "entrambi";
    document.getElementById("tipoVeicoloAttivabile").value = garanzia.tipo_veicolo_attivabile || "AUTOVEICOLO";
    document.getElementById("servizioTipo").value = garanzia.servizio_tipo || "GARANZIA";

    toggleLimitiFields();
    scrollToForm();
  }

  async function uploadPdfSePresente() {
    const fileInput = document.getElementById("pdfFile");
    const file = fileInput.files[0];

    if (!file) return currentPdfUrl || "";

    const formData = new FormData();
    formData.append("pdf", file);

    const res = await fetch("/api/partner/upload-pdf", {
      method: "POST",
      headers: { Authorization: "Bearer " + partnerToken },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Errore upload PDF");

    return data.pdf_url;
  }

  async function salvaGaranzia() {
    const msg = document.getElementById("partnerMsg");
    msg.textContent = "";
    msg.className = "message";

    const nome = document.getElementById("nome").value.trim();
    const brand = document.getElementById("brand").value.trim();
    const durata = document.getElementById("durata").value.trim();
    const prezzo = document.getElementById("prezzo").value.trim();
    const copertura = document.getElementById("copertura").value.trim();
    const stato = document.getElementById("stato").value.trim();
    const descrizione = document.getElementById("descrizione").value.trim();
    const limitiAttivi = document.getElementById("limitiAttivi").checked;
    const limiteKm = document.getElementById("limiteKm").value.trim();
    const limiteImmatricolazione = document.getElementById("limiteImmatricolazione").value.trim();
    const canaleAttivazione = document.getElementById("canaleAttivazione").value;
    const tipoVeicoloAttivabile = document.getElementById("tipoVeicoloAttivabile").value;
    const servizioTipo = document.getElementById("servizioTipo").value;

    if (!nome || !durata || !prezzo || !copertura || !descrizione) {
      msg.textContent = "Compila tutti i campi obbligatori.";
      msg.classList.add("error");
      return;
    }

    if (limitiAttivi && !limiteKm && !limiteImmatricolazione) {
      msg.textContent = "Inserisci almeno un limite tra km massimo e anno minimo.";
      msg.classList.add("error");
      return;
    }

    try {
      const pdfUrl = await uploadPdfSePresente();

      const payload = {
        nome,
        descrizione,
        prezzo: euroToCents(prezzo),
        durata: Number(durata),
        copertura,
        brand,
        stato,
        updated_at: new Date().toISOString(),
        pdf_url: pdfUrl,
        limiti_attivi: limitiAttivi ? 1 : 0,
        limite_km: limitiAttivi && limiteKm ? Number(limiteKm) : null,
        limite_immatricolazione: limitiAttivi && limiteImmatricolazione ? Number(limiteImmatricolazione) : null,
        canale_attivazione: canaleAttivazione,
        tipo_veicolo_attivabile: tipoVeicoloAttivabile,
        servizio_tipo: servizioTipo
      };

      const url = editId ? `/api/partner/garanzie/${editId}` : "/api/partner/garanzie";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + partnerToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Errore nel salvataggio.";
        msg.classList.add("error");
        return;
      }

      msg.textContent = editId ? "Garanzia aggiornata con successo." : "Garanzia creata con successo.";
      msg.classList.add("success");

      resetForm();
      await caricaGaranzie();
      await caricaDashboardPartner();

      const btn = document.querySelector('.partner-section-btn[data-section="catalog"]');
      showSection("catalog", btn);
    } catch (error) {
      msg.textContent = error.message || "Errore di connessione al server.";
      msg.classList.add("error");
    }
  }

  async function eliminaGaranzia(id) {
    const conferma = confirm("Vuoi davvero eliminare questa garanzia?");
    if (!conferma) return;

    try {
      const res = await fetch(`/api/partner/garanzie/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + partnerToken }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Errore eliminazione");
        return;
      }

      await caricaGaranzie();
      await caricaDashboardPartner();
    } catch {
      alert("Errore di connessione al server");
    }
  }


  let editingVehicleRule = { non_attivabile: null, preventivo: null };

  function safeHtml(value) { return String(value || "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch])); }

  async function caricaVehicleRules(status) {
    const tableId = status === "non_attivabile" ? "blockedVehiclesTable" : "quoteVehiclesTable";
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    try {
      const res = await fetch(`/api/partner/vehicle-rules?status=${encodeURIComponent(status)}`, { headers: { Authorization: "Bearer " + partnerToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore caricamento regole");
      if (!data.length) { tbody.innerHTML = `<tr><td colspan="3" class="empty-table">Nessun veicolo inserito.</td></tr>`; return; }
      tbody.innerHTML = data.map(r => `<tr><td>${safeHtml(r.marca)}</td><td>${safeHtml(r.modello)}</td><td><div class="table-actions"><button class="mini-btn edit btnEditVehicleRule" data-status="${status}" data-id="${r.id}" data-marca="${safeHtml(r.marca)}" data-modello="${safeHtml(r.modello)}">Modifica</button><button class="mini-btn delete btnDeleteVehicleRule" data-status="${status}" data-id="${r.id}">Elimina</button></div></td></tr>`).join("");
      tbody.querySelectorAll(".btnEditVehicleRule").forEach(btn => btn.addEventListener("click", () => {
        editingVehicleRule[status] = btn.dataset.id;
        document.getElementById(status === "non_attivabile" ? "blockedMarca" : "quoteMarca").value = btn.dataset.marca || "";
        document.getElementById(status === "non_attivabile" ? "blockedModello" : "quoteModello").value = btn.dataset.modello || "";
      }));
      tbody.querySelectorAll(".btnDeleteVehicleRule").forEach(btn => btn.addEventListener("click", () => eliminaVehicleRule(status, btn.dataset.id)));
    } catch (e) { tbody.innerHTML = `<tr><td colspan="3" class="empty-table">${e.message}</td></tr>`; }
  }

  async function salvaVehicleRule(status) {
    const marcaId = status === "non_attivabile" ? "blockedMarca" : "quoteMarca";
    const modelloId = status === "non_attivabile" ? "blockedModello" : "quoteModello";
    const msgId = status === "non_attivabile" ? "blockedVehiclesMsg" : "quoteVehiclesMsg";
    const marca = document.getElementById(marcaId).value.trim();
    const modello = document.getElementById(modelloId).value.trim();
    const msg = document.getElementById(msgId);
    msg.textContent = ""; msg.className = "message";
    if (!marca || !modello) { msg.textContent = "Inserisci marca e modello."; msg.classList.add("error"); return; }
    const id = editingVehicleRule[status];
    try {
      const res = await fetch(id ? `/api/partner/vehicle-rules/${id}` : "/api/partner/vehicle-rules", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + partnerToken },
        body: JSON.stringify({ status, marca, modello })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore salvataggio");
      document.getElementById(marcaId).value = ""; document.getElementById(modelloId).value = ""; editingVehicleRule[status] = null;
      msg.textContent = status === "non_attivabile" ? "Veicolo non attivabile salvato." : "Veicolo con preventivazione salvato."; msg.classList.add("success");
      await caricaVehicleRules(status);
    } catch (e) { msg.textContent = e.message; msg.classList.add("error"); }
  }

  async function eliminaVehicleRule(status, id) {
    if (!confirm("Eliminare questa voce?")) return;
    await fetch(`/api/partner/vehicle-rules/${id}`, { method: "DELETE", headers: { Authorization: "Bearer " + partnerToken } });
    caricaVehicleRules(status);
  }

  async function caricaQuoteTickets() {
    const tbody = document.getElementById("quoteTicketsTable");
    if (!tbody) return;
    try {
      const res = await fetch("/api/partner/tickets", { headers: { Authorization: "Bearer " + partnerToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore caricamento ticket");
      const badge = document.getElementById("sidebarTicketsBadge");
      const openCount = data.filter(t => String(t.stato || "aperto").toLowerCase() === "aperto").length;
      if (badge) { badge.textContent = openCount; badge.classList.toggle("show", openCount > 0); }
      if (!data.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-table">Nessun ticket preventivo ricevuto.</td></tr>`; return; }
      tbody.innerHTML = data.map(t => `<tr class="${String(t.stato||"").toLowerCase()==="aperto" ? "ticket-new-row" : ""}"><td><strong>#${t.id}</strong><br><small>${safeHtml(t.requester_type)} · ${safeHtml(t.created_at||"")}</small>${String(t.stato||"").toLowerCase()==="aperto" ? `<br><span class="sidebar-badge show" style="margin-top:6px;">Nuovo</span>` : ""}</td><td>${safeHtml(t.targa)}<br><small>${safeHtml(t.marca)} ${safeHtml(t.modello)} · ${safeHtml(t.anno)} · ${Number(t.km||0).toLocaleString("it-IT")} km</small></td><td>${safeHtml(t.garanzia_nome||"Soluzione da preventivare")}</td><td><span class="pill">${safeHtml(t.stato)}</span></td><td><input class="supplement-price-input ticket-price" type="number" step="0.01" placeholder="Prezzo €" value="${t.prezzo_preventivo ? (Number(t.prezzo_preventivo)/100).toFixed(2) : ""}" ${["accettato","rifiutato"].includes(String(t.stato||"").toLowerCase()) ? "disabled" : ""}><textarea class="supplement-name-input ticket-reply" placeholder="Risposta al cliente" ${["accettato","rifiutato"].includes(String(t.stato||"").toLowerCase()) ? "disabled" : ""}>${safeHtml(t.risposta||"")}</textarea></td><td>${["accettato","rifiutato"].includes(String(t.stato||"").toLowerCase()) ? `<span class="mini-label">Ticket chiuso</span>` : `<button class="mini-btn edit btnRispondiTicket" data-id="${t.id}">Invia preventivo</button>`}</td></tr>`).join("");
      tbody.querySelectorAll(".btnRispondiTicket").forEach(btn => btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        const prezzo = Math.round(Number(tr.querySelector(".ticket-price").value || 0) * 100);
        const risposta = tr.querySelector(".ticket-reply").value;
        await fetch(`/api/partner/tickets/${btn.dataset.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " + partnerToken }, body: JSON.stringify({ stato: "risposto", prezzo_preventivo: prezzo, risposta }) });
        caricaQuoteTickets();
      }));
    } catch(e) { tbody.innerHTML = `<tr><td colspan="6" class="empty-table">${e.message}</td></tr>`; }
  }

  document.querySelectorAll(".partner-section-btn").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section, btn));
  });

  const btnPartnerAssistenzaFaq = document.getElementById("btnPartnerAssistenzaFaq");
  if (btnPartnerAssistenzaFaq) {
    btnPartnerAssistenzaFaq.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
      btnPartnerAssistenzaFaq.classList.add("active");
      const panel = document.querySelector(".ef-assistant-panel");
      const assistantButton = document.querySelector(".ef-assistant-button");
      if (panel) {
        panel.classList.add("open");
        const input = panel.querySelector(".ef-assistant-input");
        if (input) setTimeout(() => input.focus(), 80);
      } else if (assistantButton) {
        assistantButton.click();
      }
    });
  }

  document.getElementById("btnLogoutPartner").addEventListener("click", logoutPartner);
  document.getElementById("btnApriOrdiniRicevuti").addEventListener("click", apriOrdiniRicevuti);
  document.getElementById("searchOrdiniInput").addEventListener("input", filtraOrdini);
  document.getElementById("filtroStatoOrdini").addEventListener("change", filtraOrdini);
  document.getElementById("btnAggiornaOrdini").addEventListener("click", caricaOrdiniPartner);
  document.getElementById("btnSalvaProfiloPartner").addEventListener("click", salvaProfiloPartner);
  document.getElementById("btnAggiornaSupplementi").addEventListener("click", caricaSupplementi);
  document.getElementById("btnNuovoSupplemento").addEventListener("click", () => apriEditorSupplemento());
  document.getElementById("btnChiudiSupplemento").addEventListener("click", chiudiEditorSupplemento);
  document.getElementById("btnResetSupplementoForm").addEventListener("click", chiudiEditorSupplemento);
  document.getElementById("btnSalvaSupplementoForm").addEventListener("click", salvaSupplementoDaForm);
  document.getElementById("suppNome").addEventListener("input", () => {
    const codice = document.getElementById("suppCodice");
    if (!supplementoEditId && !codice.dataset.touched) codice.value = codiceDaNomeSupplemento(document.getElementById("suppNome").value);
  });
  document.getElementById("suppCodice").addEventListener("input", (event) => { event.currentTarget.dataset.touched = "1"; });
  document.getElementById("searchInput").addEventListener("input", filtraGaranzie);
  document.getElementById("limitiAttivi").addEventListener("change", toggleLimitiFields);
  document.getElementById("saveBtn").addEventListener("click", salvaGaranzia);
  document.getElementById("btnResetForm").addEventListener("click", resetForm);
  document.getElementById("btnAddBlockedVehicle")?.addEventListener("click", () => salvaVehicleRule("non_attivabile"));
  document.getElementById("btnAddQuoteVehicle")?.addEventListener("click", () => salvaVehicleRule("preventivo"));
  document.getElementById("btnAggiornaTickets")?.addEventListener("click", caricaQuoteTickets);
  setInterval(caricaQuoteTickets, 15000);

  caricaPartner();
  caricaDashboardPartner();
  caricaOrdiniPartner();
  caricaGaranzie();
  caricaSupplementi();
  caricaVehicleRules("non_attivabile");
  caricaVehicleRules("preventivo");
  caricaQuoteTickets();
});