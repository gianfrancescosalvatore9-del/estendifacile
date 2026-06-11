document.addEventListener("DOMContentLoaded", function () {
  const concessionarioToken = localStorage.getItem("token");
  const tipoUtente = localStorage.getItem("tipoUtente");
  const privatoToken = localStorage.getItem("privatoToken");
  const partnerToken = localStorage.getItem("partnerToken");
  const utenteAutenticato = Boolean(concessionarioToken || privatoToken || partnerToken);
  const buyerAutenticato =
    (tipoUtente === "concessionario" && Boolean(concessionarioToken)) ||
    (tipoUtente === "privato" && Boolean(privatoToken));

  let tutteLeGaranzie = [];
  let garanzieCompatibili = [];

  function euro(cents) {
    return "€ " + (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
  }

  function formatKm(value) {
    return Number(value || 0).toLocaleString("it-IT") + " km";
  }

  function getVeicolo() {
    return {
      targa: localStorage.getItem("veicolo_targa") || localStorage.getItem("targa") || "",
      modello: localStorage.getItem("veicolo_modello") || "",
      anno: localStorage.getItem("veicolo_anno") || "",
      km: localStorage.getItem("veicolo_km") || ""
    };
  }

  function renderNav() {
    const nav = document.getElementById("navActions");

    if (buyerAutenticato) {
      nav.innerHTML = `
        <a href="${tipoUtente === "privato" ? "/profilo.html" : "/dashboard-concessionario.html"}" class="btn btn-outline">Dashboard</a>
        <a href="/checkout.html" class="btn btn-primary">Checkout</a>
      `;
    } else {
      nav.innerHTML = `
        <a href="/login.html" class="btn btn-outline">Accedi</a>
        <a href="/register.html" class="btn btn-primary">Registrati</a>
      `;
    }
  }

  function renderVehicle() {
    const veicolo = getVeicolo();

    document.getElementById("vehicleTarga").textContent = veicolo.targa || "—";
    document.getElementById("vehicleModello").textContent = veicolo.modello || "—";
    document.getElementById("vehicleAnno").textContent = veicolo.anno || "—";
    document.getElementById("vehicleKm").textContent = veicolo.km ? formatKm(veicolo.km) : "—";
  }

  function veicoloCompleto() {
    const v = getVeicolo();
    return Boolean(v.targa && v.modello && v.anno && v.km);
  }

  function garanziaCompatibile(g) {
    const v = getVeicolo();

    if (String(g.stato || "attiva").toLowerCase() === "sospesa") {
      return false;
    }

    if (Number(g.limiti_attivi || 0) !== 1) {
      return true;
    }

    const kmVeicolo = Number(v.km || 0);
    const annoVeicolo = Number(v.anno || 0);

    if (g.limite_km && kmVeicolo > Number(g.limite_km)) {
      return false;
    }

    if (g.limite_immatricolazione && annoVeicolo < Number(g.limite_immatricolazione)) {
      return false;
    }

    return true;
  }

  async function caricaGaranzie() {
    const container = document.getElementById("resultsContainer");

    if (!veicoloCompleto()) {
      container.innerHTML = `
        <div class="empty-state">
          <h2>Dati veicolo mancanti</h2>
          Per visualizzare le garanzie compatibili devi prima inserire targa, modello, anno e km.
          <br><br>
          <a href="/index.html" class="btn btn-primary">Inserisci veicolo</a>
        </div>
      `;
      document.getElementById("resultsSubtitle").textContent = "Completa i dati veicolo per continuare.";
      document.getElementById("resultsCount").textContent = "0 risultati";
      return;
    }

    try {
      const res = await fetch("/api/garanzie");
      const data = await res.json();

      if (!res.ok) {
        container.innerHTML = `
          <div class="empty-state">
            ${data.error || "Errore nel caricamento delle garanzie."}
          </div>
        `;
        return;
      }

      tutteLeGaranzie = data;
      garanzieCompatibili = data.filter(garanziaCompatibile);
      applicaFiltri();
    } catch (error) {
      console.error(error);
      container.innerHTML = `
        <div class="empty-state">
          Errore di connessione al server.
        </div>
      `;
    }
  }

  function applicaFiltri() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const sort = document.getElementById("sortSelect").value;
    const durataMin = document.getElementById("durataSelect").value;

    let lista = [...garanzieCompatibili];

    if (query) {
      lista = lista.filter(g =>
        String(g.nome || "").toLowerCase().includes(query) ||
        String(g.brand || "").toLowerCase().includes(query) ||
        String(g.descrizione || "").toLowerCase().includes(query) ||
        String(g.copertura || "").toLowerCase().includes(query)
      );
    }

    if (durataMin) {
      lista = lista.filter(g => Number(g.durata || 0) >= Number(durataMin));
    }

    if (sort === "prezzo_asc") {
      lista.sort((a, b) => Number(a.prezzo || 0) - Number(b.prezzo || 0));
    }

    if (sort === "prezzo_desc") {
      lista.sort((a, b) => Number(b.prezzo || 0) - Number(a.prezzo || 0));
    }

    if (sort === "durata_desc") {
      lista.sort((a, b) => Number(b.durata || 0) - Number(a.durata || 0));
    }

    if (sort === "durata_asc") {
      lista.sort((a, b) => Number(a.durata || 0) - Number(b.durata || 0));
    }

    renderRisultati(lista);
  }

  function resetFiltri() {
    document.getElementById("searchInput").value = "";
    document.getElementById("sortSelect").value = "prezzo_asc";
    document.getElementById("durataSelect").value = "";
    applicaFiltri();
  }

  function getLimitText(g) {
    if (Number(g.limiti_attivi || 0) !== 1) {
      return "Nessun limite specifico impostato dal partner.";
    }

    const parts = [];

    if (g.limite_km) {
      parts.push(`Km massimo: ${Number(g.limite_km).toLocaleString("it-IT")}`);
    }

    if (g.limite_immatricolazione) {
      parts.push(`Anno minimo: ${g.limite_immatricolazione}`);
    }

    return parts.length ? parts.join(" • ") : "Limiti attivi ma non specificati.";
  }

  function renderRisultati(lista) {
    const container = document.getElementById("resultsContainer");
    const count = document.getElementById("resultsCount");
    const subtitle = document.getElementById("resultsSubtitle");

    count.textContent = `${lista.length} risultat${lista.length === 1 ? "o" : "i"}`;

    subtitle.textContent = lista.length
      ? (utenteAutenticato
        ? "Abbiamo trovato le soluzioni compatibili con i dati veicolo inseriti."
        : "Abbiamo trovato soluzioni compatibili. Accedi o registrati per sbloccare prezzo, copertura e condizioni.")
      : "Nessuna garanzia compatibile con i dati o filtri selezionati.";

    if (!lista.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h2>Nessuna garanzia disponibile</h2>
          Non abbiamo trovato soluzioni compatibili con il veicolo o con i filtri applicati.
          <br><br>
          <button class="btn btn-outline" type="button" id="btnResetEmpty">Reset filtri</button>
          <a href="/index.html" class="btn btn-primary">Modifica veicolo</a>
        </div>
      `;

      document.getElementById("btnResetEmpty").addEventListener("click", resetFiltri);
      return;
    }

    container.innerHTML = lista.map(g => `
      <article class="warranty-card">
        <div>
          <div class="warranty-top">
            <div>
              <h3 class="warranty-title ${utenteAutenticato ? "" : "locked-title"}">${utenteAutenticato ? (g.nome || "Garanzia") : "Garanzia disponibile"}</h3>
              <span class="compatibility">✓ Compatibile</span>
            </div>
            <span class="brand-pill">${g.brand || "Partner"}</span>
          </div>

          ${utenteAutenticato ? `
          <p class="warranty-desc">${g.descrizione || "Soluzione di garanzia disponibile per il veicolo selezionato."}</p>

          <div class="features">
            <div class="feature-box">
              <div class="feature-label">Durata</div>
              <div class="feature-value">${g.durata || "—"} mesi</div>
            </div>

            <div class="feature-box">
              <div class="feature-label">Stato</div>
              <div class="feature-value">${g.stato || "attiva"}</div>
            </div>

            <div class="feature-box">
              <div class="feature-label">Documento</div>
              <div class="feature-value">${g.pdf_url ? "PDF disponibile" : "Non allegato"}</div>
            </div>
          </div>

          <div class="coverage-box">
            <strong>Copertura inclusa</strong>
            ${g.copertura || "Copertura non specificata."}
          </div>
          ` : `
          <div class="locked-preview" aria-label="Dettagli garanzia riservati">
            <p class="warranty-desc locked-intro">
              Abbiamo trovato una soluzione compatibile proposta da questo partner.
              Per visualizzare nome garanzia, prezzo, durata, coperture e condizioni è necessario accedere o registrarsi.
            </p>

            <div class="features locked-features">
              <div class="feature-box blurred-detail">
                <div class="feature-label">Garanzia</div>
                <div class="feature-value">Dettaglio riservato</div>
              </div>

              <div class="feature-box blurred-detail">
                <div class="feature-label">Durata</div>
                <div class="feature-value">Accesso richiesto</div>
              </div>

              <div class="feature-box blurred-detail">
                <div class="feature-label">Copertura</div>
                <div class="feature-value">Riservata</div>
              </div>
            </div>

            <div class="coverage-box locked-coverage">
              <strong>Dettagli offuscati</strong>
              Prezzo, condizioni, PDF e coperture complete saranno disponibili dopo l'accesso.
            </div>
          </div>
          `}
        </div>

        <aside class="price-panel ${utenteAutenticato ? "" : "locked-price-panel"}">
          ${utenteAutenticato ? `
          <div>
            <div class="price-label">Prezzo garanzia base</div>
            <div class="price">${euro(g.prezzo || 0)}</div>
            <div class="price-note">
              I supplementi applicabili potranno essere selezionati nel checkout.
            </div>
          </div>

          <div class="limit-note">
            ${getLimitText(g)}
          </div>

          <div class="card-actions">
            ${g.pdf_url ? `<a href="${g.pdf_url}" target="_blank" class="btn btn-outline" style="text-align:center;">Apri PDF</a>` : ""}
            <button class="btn btn-primary btnScegliGaranzia" type="button" data-garanzia-id="${g.id}">
              Scegli questa garanzia
            </button>
          </div>
          ` : `
          <div>
            <div class="price-label">Prezzo garanzia base</div>
            <div class="price locked-price">€ •••,••</div>
            <div class="price-note">
              Prezzo e dettagli completi sono riservati agli utenti registrati.
            </div>
          </div>

          <div class="limit-note locked-limit">
            Condizioni, limiti, durata e documenti sono visibili dopo accesso o registrazione.
          </div>

          <div class="card-actions">
            <a href="/login.html" class="btn btn-primary" style="text-align:center;">Accedi per vedere i dettagli</a>
            <a href="/register.html" class="btn btn-outline" style="text-align:center;">Registrati gratis</a>
          </div>
          `}
        </aside>
      </article>
    `).join("");

    document.querySelectorAll(".btnScegliGaranzia").forEach(function (button) {
      button.addEventListener("click", function () {
        const garanziaId = Number(button.dataset.garanziaId);
        const garanzia = lista.find(g => Number(g.id) === garanziaId);

        if (garanzia) {
          selezionaGaranzia(garanzia);
        }
      });
    });
  }

  function selezionaGaranzia(garanzia) {
    if (!utenteAutenticato) {
      localStorage.setItem("garanziaSelezionata", JSON.stringify(garanzia));
      window.location.href = "/login.html";
      return;
    }

    if (!buyerAutenticato) {
      localStorage.setItem("garanziaSelezionata", JSON.stringify(garanzia));
      alert("Per acquistare online devi accedere come privato o concessionario.");
      return;
    }

    localStorage.setItem("garanziaSelezionata", JSON.stringify(garanzia));
    window.location.href = "/checkout.html";
  }

  document.getElementById("searchInput").addEventListener("input", applicaFiltri);
  document.getElementById("sortSelect").addEventListener("change", applicaFiltri);
  document.getElementById("durataSelect").addEventListener("change", applicaFiltri);
  document.getElementById("btnResetFiltri").addEventListener("click", resetFiltri);

  const aiBtn = document.getElementById("btnAiRecommend");
  if (aiBtn) {
    aiBtn.addEventListener("click", function () {
      const assistantBtn = document.querySelector(".ef-assistant-button");
      const assistantInput = document.querySelector(".ef-assistant-input");
      if (assistantBtn) assistantBtn.click();
      setTimeout(function(){
        if (assistantInput) {
          assistantInput.value = "Consigliami la garanzia migliore";
          document.getElementById("efAssistantForm")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }, 150);
    });
  }

  renderNav();
  renderVehicle();
  caricaGaranzie();
});
