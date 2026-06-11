document.addEventListener("DOMContentLoaded", function () {
  if (window.AuthGuard && typeof AuthGuard.requireBuyer === "function") {
    AuthGuard.requireBuyer();
  }

  const currentRole = localStorage.getItem("tipoUtente") || (localStorage.getItem("privatoToken") ? "privato" : "concessionario");
  const buyerToken = currentRole === "privato" ? (localStorage.getItem("privatoToken") || "") : (localStorage.getItem("token") || localStorage.getItem("privatoToken") || "");
  const checkoutContainer = document.getElementById("checkoutContainer");

  let metodoPagamentoSelezionato = "simulato";
  let supplementiDisponibili = [];
  let supplementiSelezionati = [];
  let checkoutStep = "dati";

  function euro(cents) {
    return "€ " + (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
  }

  function formatKm(value) {
    return Number(value || 0).toLocaleString("it-IT") + " km";
  }

  function todayISO() {
    return new Date().toISOString().split("T")[0];
  }

  function addMonths(dateString, months) {
    const date = new Date((dateString || todayISO()) + "T00:00:00");
    date.setMonth(date.getMonth() + Number(months || 12));
    return date.toISOString().split("T")[0];
  }

  function formatDateIT(dateString) {
    if (!dateString) return "—";
    const d = new Date(dateString + "T00:00:00");
    return d.toLocaleDateString("it-IT");
  }

  function getVeicolo() {
    return {
      targa: localStorage.getItem("veicolo_targa") || localStorage.getItem("targa") || "",
      modello: localStorage.getItem("veicolo_modello") || "",
      anno: localStorage.getItem("veicolo_anno") || "",
      km: localStorage.getItem("veicolo_km") || ""
    };
  }

  function getGaranzia() {
    const raw = localStorage.getItem("garanziaSelezionata");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getTotaleSupplementi() {
    return supplementiSelezionati.reduce((acc, s) => acc + Number(s.prezzo || 0), 0);
  }

  function getPrezzoFinale() {
    const garanzia = getGaranzia();
    return Number(garanzia?.prezzo || 0) + getTotaleSupplementi();
  }

  function getCheckoutReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from") || localStorage.getItem("checkoutReturnContext") || "concessionario";
    return localStorage.getItem("checkoutReturnUrl") || (from === "privato" ? "/profilo.html#comparatore" : "/dashboard-concessionario.html#comparatore");
  }

  function cambiaGaranzia() {
    localStorage.setItem("restoreComparatorResults", "1");
    window.location.href = getCheckoutReturnUrl();
  }

  function renderEmptyState() {
    checkoutContainer.innerHTML = `
      <div class="empty-state">
        Nessuna pratica pronta per il checkout.<br><br>
        Inserisci i dati del veicolo dal comparatore e seleziona una garanzia.
        <br><br>
        <button type="button" class="btn btn-primary" id="emptyBackComparator">Torna al comparatore</button>
      </div>
    `;
    document.getElementById("emptyBackComparator")?.addEventListener("click", cambiaGaranzia);
  }

  function headerHtml(step) {
    const map = { dati: 1, carrello: 2, conferme: 3 };
    const n = map[step] || 1;
    return `
      <div class="checkout-topbar">
        <div class="checkout-title-block">
          <h1>Checkout garanzia</h1>
          <p>Completa la pratica in tre passaggi: dati e supplementi, carrello e pagamento, conferme finali.</p>
        </div>
        <div class="top-status-pill"><i class="fa-solid fa-lock"></i> Pagamento sicuro</div>
      </div>

      <div class="checkout-progress">
        <div class="progress-card ${n === 1 ? "active" : "done"}"><span>${n > 1 ? "✓" : "1"}</span> Dati e supplementi</div>
        <div class="progress-card ${n === 2 ? "active" : n > 2 ? "done" : ""}"><span>${n > 2 ? "✓" : "2"}</span> Carrello e pagamento</div>
        <div class="progress-card ${n === 3 ? "active" : ""}"><span>3</span> Conferme e paga</div>
      </div>
    `;
  }

  function calcolaFineGaranzia() {
    const garanzia = getGaranzia();
    const durata = Number(garanzia?.durata || 12);
    const input = document.getElementById("garanziaInizio");
    const inizio = input?.value || todayISO();
    const fine = addMonths(inizio, durata);
    const fineText = document.getElementById("garanziaFineText");
    if (fineText) fineText.textContent = `${formatDateIT(fine)} ore 23:59`;
    return { inizio, fine, durata };
  }

  function renderSupplementiCheckout() {
    const lista = document.getElementById("supplementiLista");
    const counter = document.getElementById("supplementiCounter");
    if (!lista) return;

    if (!supplementiDisponibili.length) {
      lista.innerHTML = `<div class="card-subtitle" style="margin-top:16px">Nessun supplemento disponibile per questa garanzia.</div>`;
      if (counter) counter.textContent = "Nessun supplemento disponibile";
      return;
    }

    if (counter) counter.textContent = `${supplementiSelezionati.length} supplementi selezionati`;

    lista.innerHTML = supplementiDisponibili.map((s) => {
      const checked = supplementiSelezionati.some((item) => Number(item.id) === Number(s.id)) ? "checked" : "";
      return `
        <label class="supplemento-row">
          <input type="checkbox" class="supplementoCheck" data-id="${s.id}" id="supp_${s.id}" ${checked} />
          <div>
            <div class="supplemento-name">${s.nome}</div>
            <div class="supplemento-code">Codice: ${s.codice || "—"}</div>
          </div>
          <div class="supplemento-price">${euro(s.prezzo)}</div>
        </label>
      `;
    }).join("");

    document.querySelectorAll(".supplementoCheck").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        toggleSupplemento(checkbox.dataset.id);
      });
    });
  }

  async function caricaSupplementiPartner(partnerId) {
    const lista = document.getElementById("supplementiLista");
    if (!partnerId) {
      if (lista) lista.innerHTML = `<div class="card-subtitle" style="margin-top:16px">Nessun partner associato alla garanzia.</div>`;
      return;
    }

    try {
      const res = await fetch(`/api/supplementi/partner/${partnerId}`);
      const data = await res.json();
      if (!res.ok) {
        if (lista) lista.innerHTML = `<div class="card-subtitle" style="margin-top:16px">${data.error || "Errore caricamento supplementi."}</div>`;
        return;
      }
      supplementiDisponibili = Array.isArray(data) ? data : [];
      renderSupplementiCheckout();
    } catch {
      if (lista) lista.innerHTML = `<div class="card-subtitle" style="margin-top:16px">Errore di connessione durante il caricamento supplementi.</div>`;
    }
  }

  function toggleSupplemento(id) {
    const supplemento = supplementiDisponibili.find((s) => Number(s.id) === Number(id));
    const checkbox = document.getElementById(`supp_${id}`);
    if (!supplemento || !checkbox) return;

    if (checkbox.checked) {
      if (!supplementiSelezionati.some((s) => Number(s.id) === Number(id))) supplementiSelezionati.push(supplemento);
    } else {
      supplementiSelezionati = supplementiSelezionati.filter((s) => Number(s.id) !== Number(id));
    }
    aggiornaRiepilogoEconomico();
    renderSupplementiCheckout();
  }

  function aggiornaRiepilogoEconomico() {
    const totaleSupplementi = getTotaleSupplementi();
    const prezzoFinale = getPrezzoFinale();
    const totaleSupplementiText = document.getElementById("totaleSupplementiText");
    const prezzoFinaleText = document.getElementById("prezzoFinaleText");
    const supplementiSelezionatiText = document.getElementById("supplementiSelezionatiText");
    const supplementiCounter = document.getElementById("supplementiCounter");

    if (totaleSupplementiText) totaleSupplementiText.textContent = euro(totaleSupplementi);
    if (prezzoFinaleText) prezzoFinaleText.textContent = euro(prezzoFinale);
    if (supplementiCounter) supplementiCounter.textContent = `${supplementiSelezionati.length} supplementi selezionati`;

    if (supplementiSelezionatiText) {
      supplementiSelezionatiText.innerHTML = supplementiSelezionati.length
        ? supplementiSelezionati.map((s) => `${s.nome} (${euro(s.prezzo)})`).join("<br>")
        : "Nessun supplemento selezionato";
    }
  }

  function prefillOwnerData() {
    const raw = localStorage.getItem("ownerData");
    if (!raw) return;
    try {
      const owner = JSON.parse(raw);
      ["Nome", "Cognome", "Cf", "Email", "Telefono", "Indirizzo", "Citta", "Cap", "Provincia"].forEach((key) => {
        const el = document.getElementById("owner" + key);
        const prop = key === "Cf" ? "cf" : key.toLowerCase();
        if (el) el.value = owner[prop] || "";
      });
    } catch {}
  }

  function getOwnerPayload() {
    return {
      nome: document.getElementById("ownerNome")?.value.trim() || "",
      cognome: document.getElementById("ownerCognome")?.value.trim() || "",
      cf: (document.getElementById("ownerCf")?.value.trim() || "").toUpperCase(),
      email: document.getElementById("ownerEmail")?.value.trim() || "",
      telefono: document.getElementById("ownerTelefono")?.value.trim() || "",
      indirizzo: document.getElementById("ownerIndirizzo")?.value.trim() || "",
      citta: document.getElementById("ownerCitta")?.value.trim() || "",
      cap: document.getElementById("ownerCap")?.value.trim() || "",
      provincia: (document.getElementById("ownerProvincia")?.value.trim() || "").toUpperCase(),
      privacy: document.getElementById("privacyCheck")?.checked || false,
      terms: document.getElementById("termsCheck")?.checked || false,
      marketing: document.getElementById("marketingCheck")?.checked || false,
      confermaDati: document.getElementById("confirmDataCheck")?.checked || false,
      autorizzaPagamento: document.getElementById("authorizePaymentCheck")?.checked || false,
      finalTerms: document.getElementById("finalTermsCheck")?.checked || false
    };
  }


  function getFinalConfirmationsPayload() {
    return {
      privacy: document.getElementById("privacyCheck")?.checked || false,
      terms: document.getElementById("termsCheck")?.checked || false,
      marketing: document.getElementById("marketingCheck")?.checked || false,
      confermaDati: document.getElementById("confirmDataCheck")?.checked || false,
      autorizzaPagamento: document.getElementById("authorizePaymentCheck")?.checked || false
    };
  }

  function validaDatiOwner(owner) {
    if (!owner.nome || !owner.cognome || !owner.cf || !owner.email || !owner.telefono || !owner.indirizzo || !owner.citta || !owner.cap || !owner.provincia) {
      return "Compila tutti i campi obbligatori del proprietario.";
    }
    if (owner.cf.length !== 16) return "Il codice fiscale deve contenere 16 caratteri.";
    if (!owner.email.includes("@")) return "Inserisci un indirizzo email valido.";
    return "";
  }

  function renderSummaryAside() {
    const garanzia = getGaranzia();
    return `
      <aside class="summary-stack">
        <div class="summary-card">
          <div class="summary-pill"><i class="fa-solid fa-shield-halved"></i> Riepilogo pratica</div>
          <h3>${garanzia?.nome || "Garanzia"}</h3>
          <div class="summary-row"><strong>Brand</strong><span>${garanzia?.brand || "—"}</span></div>
          <div class="summary-row"><strong>Durata</strong><span>${garanzia?.durata || 12} mesi</span></div>
          <div class="summary-row"><strong>Garanzia</strong><span>${euro(garanzia?.prezzo || 0)}</span></div>
          <div class="summary-row"><strong>Supplementi</strong><span id="totaleSupplementiText">${euro(getTotaleSupplementi())}</span></div>
          <div class="summary-row"><strong>Selezionati</strong><span id="supplementiSelezionatiText">${supplementiSelezionati.length ? supplementiSelezionati.map(s => s.nome).join("<br>") : "Nessun supplemento selezionato"}</span></div>
        </div>

        <div class="economic-box">
          <h3>Totale ordine</h3>
          <div class="economic-row"><span>Totale da pagare</span><strong class="economic-total" id="prezzoFinaleText">${euro(getPrezzoFinale())}</strong></div>
          <div class="economic-note">Il totale include garanzia selezionata ed eventuali supplementi.</div>
        </div>
      </aside>
    `;
  }

  function renderDatiStep() {
    checkoutStep = "dati";
    const veicolo = getVeicolo();
    const garanzia = getGaranzia();

    if (!veicolo.targa || !veicolo.modello || !veicolo.anno || !veicolo.km || !garanzia) {
      renderEmptyState();
      return;
    }

    if (!garanzia.partner_id) {
      checkoutContainer.innerHTML = `
        ${headerHtml("dati")}
        <div class="empty-state">
          La garanzia selezionata non contiene il partner associato.<br><br>
          <button type="button" class="btn btn-primary" id="invalidBackComparator">Scegli un'altra garanzia</button>
        </div>`;
      document.getElementById("invalidBackComparator")?.addEventListener("click", cambiaGaranzia);
      return;
    }

    checkoutContainer.innerHTML = `
      ${headerHtml("dati")}
      <div class="checkout-layout">
        <div>
          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-car-side"></i> Dati pratica</div><h2>Veicolo e garanzia</h2><p class="card-subtitle">Controlla la pratica prima di confermare il carrello.</p></div>
              <div class="section-icon"><i class="fa-solid fa-shield-halved"></i></div>
            </div>
            <div class="info-grid">
              <div class="info-box"><div class="info-label">Targa</div><div class="info-value">${veicolo.targa}</div></div>
              <div class="info-box"><div class="info-label">Modello</div><div class="info-value">${veicolo.modello}</div></div>
              <div class="info-box"><div class="info-label">Anno immatricolazione</div><div class="info-value">${veicolo.anno}</div></div>
              <div class="info-box"><div class="info-label">Chilometraggio</div><div class="info-value">${formatKm(veicolo.km)}</div></div>
              <div class="info-box"><div class="info-label">Garanzia</div><div class="info-value">${garanzia.nome || "—"}</div></div>
              <div class="info-box"><div class="info-label">Brand</div><div class="info-value">${garanzia.brand || "—"}</div></div>
              <div class="info-box"><div class="info-label">Inizio garanzia</div><div class="info-value"><input id="garanziaInizio" class="date-input" type="date" /></div></div>
              <div class="info-box"><div class="info-label">Fine garanzia</div><div class="info-value" id="garanziaFineText">—</div></div>
            </div>
          </section>

          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-user-check"></i> Intestatario</div><h2>Dati proprietario</h2><p class="card-subtitle">Inserisci i dati obbligatori dell’intestatario del veicolo.</p></div>
              <div class="section-icon"><i class="fa-solid fa-id-card"></i></div>
            </div>
            <div class="form-grid">
              <div class="form-row">
                <div class="form-group"><label for="ownerNome">Nome *</label><input id="ownerNome" type="text" placeholder="Mario" /></div>
                <div class="form-group"><label for="ownerCognome">Cognome *</label><input id="ownerCognome" type="text" placeholder="Rossi" /></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label for="ownerCf">Codice fiscale *</label><input id="ownerCf" type="text" placeholder="RSSMRA80A01F205X" maxlength="16" /></div>
                <div class="form-group"><label for="ownerEmail">Email *</label><input id="ownerEmail" type="email" placeholder="mario.rossi@email.it" /></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label for="ownerTelefono">Telefono *</label><input id="ownerTelefono" type="text" placeholder="+39 333 0000000" /></div>
                <div class="form-group"><label for="ownerProvincia">Provincia *</label><input id="ownerProvincia" type="text" placeholder="MI" maxlength="2" /></div>
              </div>
              <div class="form-group full"><label for="ownerIndirizzo">Indirizzo *</label><input id="ownerIndirizzo" type="text" placeholder="Via Roma 10" /></div>
              <div class="form-row">
                <div class="form-group"><label for="ownerCitta">Città *</label><input id="ownerCitta" type="text" placeholder="Milano" /></div>
                <div class="form-group"><label for="ownerCap">CAP *</label><input id="ownerCap" type="text" placeholder="20100" /></div>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-sliders"></i> Supplementi</div><h2>Opzioni aggiuntive</h2><p class="card-subtitle">Il menù è a scomparsa per mantenere il checkout più pulito. Aprilo solo se vuoi aggiungere extra.</p></div>
              <div class="section-icon"><i class="fa-solid fa-plus"></i></div>
            </div>
            <details class="accordion-panel">
              <summary><span><i class="fa-solid fa-layer-group"></i> Gestisci supplementi</span><small id="supplementiCounter">Caricamento...</small></summary>
              <div class="accordion-body">
                <div id="supplementiLista" class="supplementi-grid"><div class="card-subtitle" style="margin-top:16px">Caricamento supplementi...</div></div>
              </div>
            </details>
            <div class="checkout-actions">
              <button type="button" class="btn btn-secondary-premium" id="btnCambiaGaranziaInline"><i class="fa-solid fa-arrow-left"></i> Scegli altra garanzia</button>
              <button type="button" class="btn btn-primary" id="btnAddToCart"><i class="fa-solid fa-cart-plus"></i> Conferma e aggiungi al carrello</button>
            </div>
            <div id="checkoutMsg" class="message"></div>
          </section>
        </div>
        ${renderSummaryAside()}
      </div>
    `;

    prefillOwnerData();
    const start = document.getElementById("garanziaInizio");
    if (start) {
      start.value = localStorage.getItem("garanzia_inizio") || todayISO();
      start.addEventListener("change", calcolaFineGaranzia);
    }
    calcolaFineGaranzia();
    caricaSupplementiPartner(garanzia.partner_id);
    document.getElementById("btnCambiaGaranziaInline")?.addEventListener("click", cambiaGaranzia);
    document.getElementById("btnAddToCart")?.addEventListener("click", addToCart);
  }

  function addToCart() {
    const msg = document.getElementById("checkoutMsg");
    const owner = getOwnerPayload();
    const errore = validaDatiOwner(owner);
    if (msg) { msg.textContent = ""; msg.className = "message"; }
    if (errore) {
      if (msg) { msg.textContent = errore; msg.classList.add("error"); }
      return;
    }
    const dateGaranzia = calcolaFineGaranzia();
    localStorage.setItem("ownerData", JSON.stringify(owner));
    localStorage.setItem("garanzia_inizio", dateGaranzia.inizio);
    localStorage.setItem("garanzia_fine", dateGaranzia.fine);
    localStorage.setItem("garanzia_durata_mesi", dateGaranzia.durata);
    renderCartStep();
  }

  function renderCartStep() {
    checkoutStep = "carrello";
    const veicolo = getVeicolo();
    const garanzia = getGaranzia();
    const owner = JSON.parse(localStorage.getItem("ownerData") || "{}");
    const dateGaranzia = {
      inizio: localStorage.getItem("garanzia_inizio") || todayISO(),
      fine: localStorage.getItem("garanzia_fine") || addMonths(todayISO(), garanzia?.durata || 12)
    };

    checkoutContainer.innerHTML = `
      ${headerHtml("carrello")}
      <div class="cart-layout">
        <div>
          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-cart-shopping"></i> Carrello</div><h2>Riepilogo dati e prodotto</h2><p class="card-subtitle">Controlla il carrello prima di scegliere il metodo di pagamento.</p></div>
              <div class="section-icon"><i class="fa-solid fa-receipt"></i></div>
            </div>
            <div class="cart-product">
              <div class="cart-product-row"><div><strong>${garanzia?.nome || "Garanzia"}</strong><br><span>${garanzia?.brand || "—"} · durata ${garanzia?.durata || 12} mesi</span></div><strong>${euro(garanzia?.prezzo || 0)}</strong></div>
              ${supplementiSelezionati.map(s => `<div class="cart-product-row"><div><strong>${s.nome}</strong><br><span>Supplemento · codice ${s.codice || "—"}</span></div><strong>${euro(s.prezzo)}</strong></div>`).join("") || `<div class="cart-product-row"><div><strong>Nessun supplemento selezionato</strong><br><span>Puoi tornare indietro per aggiungerli.</span></div><strong>${euro(0)}</strong></div>`}
            </div>
          </section>

          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-credit-card"></i> Pagamento</div><h2>Scegli metodo di pagamento</h2><p class="card-subtitle">Seleziona come vuoi completare l’ordine.</p></div>
              <div class="section-icon"><i class="fa-solid fa-lock"></i></div>
            </div>
            <div class="payment-options">
              <div class="payment-option active" id="paySimulato"><i class="fa-solid fa-bolt"></i><h4>Pagamento simulato</h4><p>Per test e demo. Registra subito la pratica come pagata.</p></div>
              <div class="payment-option" id="payCarta"><i class="fa-solid fa-credit-card"></i><h4>Carta</h4><p>Pagamento sicuro tramite Stripe quando configurato.</p></div>
              <div class="payment-option" id="payBonifico"><i class="fa-solid fa-building-columns"></i><h4>Bonifico</h4><p>Pratica creata in attesa di verifica pagamento.</p></div>
            </div>
            <div class="checkout-actions">
              <button type="button" class="btn btn-secondary-premium" id="btnBackData"><i class="fa-solid fa-arrow-left"></i> Modifica dati</button>
              <button type="button" class="btn btn-primary" id="btnGoFinal"><i class="fa-solid fa-arrow-right"></i> Continua alle conferme</button>
            </div>
          </section>
        </div>

        <aside class="summary-stack">
          <div class="summary-card">
            <div class="summary-pill"><i class="fa-solid fa-user-shield"></i> Dati pratica</div>
            <div class="summary-row"><strong>Cliente</strong><span>${owner.nome || "—"} ${owner.cognome || ""}</span></div>
            <div class="summary-row"><strong>Email</strong><span>${owner.email || "—"}</span></div>
            <div class="summary-row"><strong>Targa</strong><span>${veicolo.targa}</span></div>
            <div class="summary-row"><strong>Veicolo</strong><span>${veicolo.modello} · ${veicolo.anno}</span></div>
            <div class="summary-row"><strong>Validità</strong><span>${formatDateIT(dateGaranzia.inizio)} - ${formatDateIT(dateGaranzia.fine)}</span></div>
          </div>
          <div class="economic-box">
            <h3>Totale carrello</h3>
            <div class="economic-row"><span>Garanzia</span><strong>${euro(garanzia?.prezzo || 0)}</strong></div>
            <div class="economic-row"><span>Supplementi</span><strong>${euro(getTotaleSupplementi())}</strong></div>
            <div class="economic-row"><span>Totale</span><strong class="economic-total">${euro(getPrezzoFinale())}</strong></div>
          </div>
        </aside>
      </div>
    `;

    document.getElementById("paySimulato")?.addEventListener("click", () => selezionaPagamento("simulato"));
    document.getElementById("payCarta")?.addEventListener("click", () => selezionaPagamento("carta"));
    document.getElementById("payBonifico")?.addEventListener("click", () => selezionaPagamento("bonifico"));
    document.getElementById("btnBackData")?.addEventListener("click", renderDatiStep);
    document.getElementById("btnGoFinal")?.addEventListener("click", renderFinalStep);
    selezionaPagamento(metodoPagamentoSelezionato);
  }

  function selezionaPagamento(metodo) {
    metodoPagamentoSelezionato = metodo;
    ["paySimulato", "payCarta", "payBonifico"].forEach((id) => document.getElementById(id)?.classList.remove("active"));
    if (metodo === "simulato") document.getElementById("paySimulato")?.classList.add("active");
    if (metodo === "carta") document.getElementById("payCarta")?.classList.add("active");
    if (metodo === "bonifico") document.getElementById("payBonifico")?.classList.add("active");
  }

  function renderFinalStep() {
    checkoutStep = "conferme";
    const garanzia = getGaranzia();
    const owner = JSON.parse(localStorage.getItem("ownerData") || "{}");

    checkoutContainer.innerHTML = `
      ${headerHtml("conferme")}
      <div class="cart-layout">
        <div>
          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-clipboard-check"></i> Conferme finali</div><h2>Autorizzazioni e pagamento</h2><p class="card-subtitle">Ultimo controllo prima di procedere con la creazione dell’ordine.</p></div>
              <div class="section-icon"><i class="fa-solid fa-check-double"></i></div>
            </div>
            <div class="final-confirm-box">
              <label class="check-row"><input id="privacyCheck" type="checkbox" /> <span>Confermo di aver letto l’informativa privacy e autorizzo il trattamento dei dati necessari alla gestione della pratica.</span></label>
              <label class="check-row"><input id="termsCheck" type="checkbox" /> <span>Accetto condizioni contrattuali, termini del servizio e documentazione relativa alla garanzia selezionata.</span></label>
              <label class="check-row"><input id="confirmDataCheck" type="checkbox" /> <span>Confermo che dati proprietario, veicolo, garanzia e supplementi sono corretti.</span></label>
              <label class="check-row"><input id="authorizePaymentCheck" type="checkbox" /> <span>Autorizzo la creazione dell’ordine e il pagamento con il metodo selezionato.</span></label>
              <label class="check-row"><input id="marketingCheck" type="checkbox" /> <span>Autorizzo comunicazioni di servizio e aggiornamenti sulla pratica. Opzionale.</span></label>
            </div>
            <div class="checkout-actions">
              <button type="button" class="btn btn-secondary-premium" id="btnBackCart"><i class="fa-solid fa-arrow-left"></i> Torna al carrello</button>
              <button type="button" class="btn btn-primary" id="btnConfermaOrdine"><i class="fa-solid fa-lock"></i> Paga ora</button>
            </div>
            <div id="checkoutMsg" class="message"></div>
          </section>
        </div>

        <aside class="summary-stack">
          <div class="summary-card">
            <div class="summary-pill"><i class="fa-solid fa-lock"></i> Pronto al pagamento</div>
            <h3>${garanzia?.nome || "Garanzia"}</h3>
            <div class="summary-row"><strong>Cliente</strong><span>${owner.nome || "—"} ${owner.cognome || ""}</span></div>
            <div class="summary-row"><strong>Metodo</strong><span>${metodoPagamentoSelezionato === "carta" ? "Carta" : metodoPagamentoSelezionato === "bonifico" ? "Bonifico" : "Simulato"}</span></div>
            <div class="summary-row"><strong>Supplementi</strong><span>${supplementiSelezionati.length ? supplementiSelezionati.map(s => s.nome).join("<br>") : "Nessuno"}</span></div>
          </div>
          <div class="economic-box">
            <h3>Importo finale</h3>
            <div class="economic-row"><span>Totale da pagare</span><strong class="economic-total">${euro(getPrezzoFinale())}</strong></div>
            <div class="economic-note">Dopo il pagamento la pratica verrà salvata e resa disponibile nella dashboard.</div>
          </div>
        </aside>
      </div>
    `;

    document.getElementById("btnBackCart")?.addEventListener("click", renderCartStep);
    document.getElementById("btnConfermaOrdine")?.addEventListener("click", confermaOrdine);
  }

  function resetPaymentSteps() {
    ["payStep1", "payStep2", "payStep3", "payStep4"].forEach((id, index) => {
      const el = document.getElementById(id);
      if (!el) return;
      const dot = el.querySelector(".payment-step-dot");
      el.classList.remove("active", "done");
      if (dot) dot.textContent = index + 1;
    });
    document.getElementById("paymentLoader").style.display = "block";
    document.getElementById("paymentCheck").style.display = "none";
  }

  function setPaymentStep(stepNumber, title, text) {
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById("payStep" + i);
      if (!el) continue;
      const dot = el.querySelector(".payment-step-dot");
      el.classList.remove("active");
      if (i < stepNumber) { el.classList.add("done"); if (dot) dot.textContent = "✓"; }
      else if (i === stepNumber) { el.classList.add("active"); if (dot) dot.textContent = i; }
      else { el.classList.remove("done"); if (dot) dot.textContent = i; }
    }
    document.getElementById("paymentModalTitle").textContent = title;
    document.getElementById("paymentModalText").textContent = text;
  }

  function mostraPagamentoInCorso() {
    resetPaymentSteps();
    document.getElementById("paymentModal").classList.add("open");
    setPaymentStep(1, "Verifica dati in corso...", "Stiamo controllando autorizzazioni, proprietario e veicolo.");
    setTimeout(() => setPaymentStep(2, metodoPagamentoSelezionato === "bonifico" ? "Preparazione bonifico..." : "Autorizzazione pagamento...", metodoPagamentoSelezionato === "carta" ? "Stiamo preparando il pagamento sicuro con Stripe." : "Stiamo preparando la registrazione della pratica."), 700);
    setTimeout(() => setPaymentStep(3, "Registrazione pratica...", "Stiamo salvando ordine, supplementi e dati di garanzia."), 1400);
  }

  function mostraPagamentoCompletato() {
    setPaymentStep(4, metodoPagamentoSelezionato === "bonifico" ? "Ordine registrato" : "Pagamento completato", metodoPagamentoSelezionato === "bonifico" ? "La pratica è in attesa di pagamento tramite bonifico." : "La pratica è stata registrata correttamente.");
    const step4 = document.getElementById("payStep4");
    step4?.classList.add("done");
    step4?.querySelector(".payment-step-dot") && (step4.querySelector(".payment-step-dot").textContent = "✓");
    document.getElementById("paymentLoader").style.display = "none";
    document.getElementById("paymentCheck").style.display = "flex";
  }

  function validaConferme(owner) {
    if (!owner.privacy || !owner.terms || !owner.confermaDati || !owner.autorizzaPagamento) {
      return "Devi confermare privacy, termini, correttezza dati e autorizzazione al pagamento.";
    }
    return "";
  }

  async function confermaOrdine() {
    const msg = document.getElementById("checkoutMsg");
    const storedOwner = JSON.parse(localStorage.getItem("ownerData") || "{}");
    const owner = { ...storedOwner, ...getFinalConfirmationsPayload() };
    const garanzia = getGaranzia();
    const veicolo = getVeicolo();
    if (msg) { msg.textContent = ""; msg.className = "message"; }

    if (!garanzia || !garanzia.id || !garanzia.partner_id) {
      if (msg) { msg.textContent = "Garanzia non valida: torna al comparatore e seleziona nuovamente una garanzia."; msg.classList.add("error"); }
      return;
    }

    const erroreDati = validaDatiOwner(owner);
    const erroreConferme = validaConferme(owner);
    if (erroreDati || erroreConferme) {
      if (msg) { msg.textContent = erroreDati || erroreConferme; msg.classList.add("error"); }
      return;
    }

    try {
      localStorage.setItem("ownerData", JSON.stringify({ ...storedOwner, ...getFinalConfirmationsPayload() }));
      mostraPagamentoInCorso();

      const totaleSupplementi = getTotaleSupplementi();
      const prezzoFinale = getPrezzoFinale();
      const dateGaranzia = {
        inizio: localStorage.getItem("garanzia_inizio") || todayISO(),
        fine: localStorage.getItem("garanzia_fine") || addMonths(todayISO(), garanzia.durata || 12),
        durata: Number(localStorage.getItem("garanzia_durata_mesi") || garanzia.durata || 12)
      };
      const statoPagamentoRichiesto = metodoPagamentoSelezionato === "bonifico" ? "in_attesa" : metodoPagamentoSelezionato === "carta" ? "non_pagato" : "pagato";

      const res = await fetch("/api/ordini", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + buyerToken },
        body: JSON.stringify({
          prodotto_nome: garanzia.nome,
          prezzo: garanzia.prezzo,
          garanzia_id: Number.isFinite(Number(garanzia.id)) ? Number(garanzia.id) : null,
          quote_ticket_id: garanzia.quote_ticket_id || null,
          partner_id: garanzia.partner_id,
          proprietario_nome: owner.nome,
          proprietario_cognome: owner.cognome,
          proprietario_cf: owner.cf,
          proprietario_email: owner.email,
          proprietario_telefono: owner.telefono,
          proprietario_indirizzo: owner.indirizzo,
          proprietario_citta: owner.citta,
          proprietario_cap: owner.cap,
          proprietario_provincia: owner.provincia,
          veicolo_targa: veicolo.targa,
          veicolo_modello: veicolo.modello,
          veicolo_anno: veicolo.anno,
          veicolo_km: veicolo.km,
          garanzia_inizio: dateGaranzia.inizio,
          garanzia_fine: dateGaranzia.fine,
          garanzia_durata_mesi: dateGaranzia.durata,
          metodo_pagamento: metodoPagamentoSelezionato,
          stato_pagamento: statoPagamentoRichiesto,
          supplementi_json: JSON.stringify(supplementiSelezionati),
          totale_supplementi: totaleSupplementi,
          prezzo_finale: prezzoFinale
        })
      });
      const data = await res.json();

      if (!res.ok) {
        document.getElementById("paymentModal").classList.remove("open");
        if (msg) { msg.textContent = data.error || "Errore nella creazione dell'ordine."; msg.classList.add("error"); }
        return;
      }

      localStorage.setItem("ultimoOrdine", JSON.stringify({
        ordineId: data.ordineId,
        veicolo,
        garanzia,
        proprietario: owner,
        supplementi: supplementiSelezionati,
        validita: { inizio: dateGaranzia.inizio, fine: dateGaranzia.fine, durata_mesi: dateGaranzia.durata },
        pagamento: { metodo: data.metodo_pagamento, stato: data.stato_pagamento, paid_at: data.paid_at, totale_supplementi: totaleSupplementi, prezzo_finale: prezzoFinale }
      }));

      if (metodoPagamentoSelezionato === "carta") {
        setPaymentStep(4, "Apertura pagamento sicuro...", "Stiamo reindirizzando alla pagina di pagamento Stripe.");
        const checkoutRes = await fetch(`/api/ordini/${data.ordineId}/checkout`, { method: "POST", headers: { Authorization: "Bearer " + buyerToken } });
        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok || !checkoutData.checkout_url) {
          document.getElementById("paymentModal").classList.remove("open");
          if (msg) { msg.textContent = checkoutData.error || "Pagamento con carta non disponibile: configura Stripe prima della messa online."; msg.classList.add("error"); }
          return;
        }
        window.location.href = checkoutData.checkout_url;
        return;
      }

      mostraPagamentoCompletato();
      setTimeout(() => { window.location.href = "/success.html"; }, 1400);
    } catch (error) {
      console.error(error);
      document.getElementById("paymentModal").classList.remove("open");
      if (msg) { msg.textContent = "Errore di connessione al server."; msg.classList.add("error"); }
    }
  }

  document.getElementById("btnCambiaGaranziaCheckout")?.addEventListener("click", function(e) {
    e.preventDefault();
    cambiaGaranzia();
  });

  renderDatiStep();
});
