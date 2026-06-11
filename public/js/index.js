document.addEventListener("DOMContentLoaded", function () {
  const navActions = document.getElementById("navActions");

  const tipoVeicoloInput = document.getElementById("tipoVeicoloInput");
  const vehicleTypeBtns = document.querySelectorAll(".vehicle-type-btn");

  const targaInput = document.getElementById("targaInput");
  const btnContinuaTarga = document.getElementById("btnContinuaTarga");
  const vehicleExtra = document.getElementById("vehicleExtra");
  const btnVaiRisultati = document.getElementById("btnVaiRisultati");
  const searchError = document.getElementById("searchError");

  const modelloInput = document.getElementById("modelloInput");
  const annoInput = document.getElementById("annoInput");
  const kmInput = document.getElementById("kmInput");

  const homeResultsSection = document.getElementById("homeResultsSection");
  const homeResultsContainer = document.getElementById("homeResultsContainer");
  const homeResultsVehicle = document.getElementById("homeResultsVehicle");
  const homeAuthPanel = document.getElementById("homeAuthPanel");

  function resetRicerca() {
    if (targaInput) targaInput.value = "";
    if (modelloInput) modelloInput.value = "";
    if (annoInput) annoInput.value = "";
    if (kmInput) kmInput.value = "";

    if (searchError) searchError.textContent = "";
    if (homeAuthPanel) homeAuthPanel.classList.remove("open");

    if (vehicleExtra) {
      vehicleExtra.classList.remove("open");
    }

    if (btnContinuaTarga) {
      btnContinuaTarga.disabled = false;
      btnContinuaTarga.innerHTML = 'Confronta garanzie e servizi <i class="fa-solid fa-arrow-right"></i>';
      btnContinuaTarga.style.opacity = "1";
      btnContinuaTarga.style.cursor = "pointer";
    }
  }

  function euro(cents) {
    return "€ " + (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
  }

  function isBuyerLogged() {
    const tipoUtente = localStorage.getItem("tipoUtente");
    return (tipoUtente === "privato" && !!localStorage.getItem("privatoToken")) ||
      (tipoUtente === "concessionario" && !!localStorage.getItem("token"));
  }

  function garanziaCompatibile(g, veicolo) {
    if (String(g.stato || "attiva").toLowerCase() === "sospesa") return false;
    if (Number(g.limiti_attivi || 0) !== 1) return true;

    const kmVeicolo = Number(veicolo.km || 0);
    const annoVeicolo = Number(veicolo.anno || 0);

    if (g.limite_km && kmVeicolo > Number(g.limite_km)) return false;
    if (g.limite_immatricolazione && annoVeicolo < Number(g.limite_immatricolazione)) return false;

    return true;
  }

  function fallbackGaranzie() {
    return [
      { id: "demo-1", nome: "Garanzia Smart", brand: "AutoProtect", durata: 12, prezzo: 29900, copertura: "Motore, cambio, impianto elettrico e assistenza stradale", stato: "attiva" },
      { id: "demo-2", nome: "Garanzia Premium", brand: "DriveSafe", durata: 24, prezzo: 54900, copertura: "Copertura estesa su organi principali e servizi premium", stato: "attiva" },
      { id: "demo-3", nome: "Garanzia Plus", brand: "MotoCar Care", durata: 18, prezzo: 39900, copertura: "Soluzione intermedia con assistenza e gestione digitale", stato: "attiva" }
    ];
  }

  function saveVehicleData() {
    const tipo = tipoVeicoloInput ? tipoVeicoloInput.value : "auto";
    const targa = targaInput.value.trim().toUpperCase();
    const modello = modelloInput.value.trim();
    const anno = annoInput.value.trim();
    const km = kmInput.value.trim();

    localStorage.setItem("tipoVeicolo", tipo);
    localStorage.setItem("targa", targa);
    localStorage.setItem("modello", modello);
    localStorage.setItem("anno", anno);
    localStorage.setItem("km", km);
    localStorage.setItem("veicolo_targa", targa);
    localStorage.setItem("veicolo_modello", modello);
    localStorage.setItem("veicolo_anno", anno);
    localStorage.setItem("veicolo_km", km);

    return { tipo, targa, modello, anno, km };
  }

  function renderHomeResults(lista, veicolo) {
    if (!homeResultsSection || !homeResultsContainer) return;

    const cards = lista.slice(0, Math.max(3, Math.min(lista.length, 6)));
    homeResultsSection.classList.add("open");
    if (homeResultsVehicle) {
      homeResultsVehicle.textContent = `${veicolo.targa} • ${veicolo.modello} • ${veicolo.anno} • ${Number(veicolo.km || 0).toLocaleString("it-IT")} km`;
    }

    if (!cards.length) {
      homeResultsContainer.className = "home-results-empty";
      homeResultsContainer.innerHTML = "Nessuna soluzione disponibile per i dati inseriti. Modifica i dati del veicolo e riprova.";
      homeResultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    homeResultsContainer.className = "home-warranty-grid";
    homeResultsContainer.innerHTML = cards.map((g) => `
      <article class="home-warranty-card">
        <div class="home-warranty-brand"><i class="fa-solid fa-building-shield"></i> ${g.brand || "Partner certificato"}</div>
        <h3 class="home-warranty-title">${g.nome || "Garanzia disponibile"}</h3>
        <p class="home-warranty-line">${g.copertura || g.descrizione || "Copertura compatibile con il veicolo inserito."}</p>
        <div class="home-warranty-features">
          <div class="home-warranty-feature"><span>Durata</span><strong>${g.durata || "—"} mesi</strong></div>
          <div class="home-warranty-feature"><span>Stato</span><strong>${g.stato || "attiva"}</strong></div>
        </div>
        <div class="home-warranty-price">${euro(g.prezzo || 0)}</div>
        <div class="home-card-lock"><i class="fa-solid fa-lock"></i><span>Dettagli e prezzo offuscati. Azienda visibile: ${g.brand || "Partner"}.</span></div>
        <button class="btn btn-primary btnHomeSelectWarranty" type="button" data-id="${g.id}">Seleziona garanzia</button>
      </article>
    `).join("");

    document.querySelectorAll(".btnHomeSelectWarranty").forEach((btn) => {
      btn.addEventListener("click", function () {
        const selected = cards.find((g) => String(g.id) === String(btn.dataset.id));
        if (selected) localStorage.setItem("garanziaSelezionata", JSON.stringify(selected));

        if (isBuyerLogged()) {
          window.location.href = "/checkout.html";
          return;
        }

        if (homeAuthPanel) {
          homeAuthPanel.classList.add("open");
          homeAuthPanel.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          window.location.href = "/login.html";
        }
      });
    });

    homeResultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadInlineWarrantyResults(veicolo) {
    if (!homeResultsSection || !homeResultsContainer) return;

    homeResultsSection.classList.add("open");
    homeResultsContainer.className = "home-results-loading";
    homeResultsContainer.innerHTML = "Sto cercando le soluzioni compatibili...";

    try {
      const res = await fetch("/api/garanzie");
      const data = await res.json();
      let list = Array.isArray(data) ? data.filter((g) => garanziaCompatibile(g, veicolo)) : [];

      if (!res.ok || !list.length) {
        list = fallbackGaranzie();
      }

      list.sort((a, b) => Number(a.prezzo || 0) - Number(b.prezzo || 0));
      renderHomeResults(list, veicolo);
    } catch (error) {
      console.error(error);
      renderHomeResults(fallbackGaranzie(), veicolo);
    }
  }

  vehicleTypeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      vehicleTypeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (tipoVeicoloInput) {
        tipoVeicoloInput.value = btn.dataset.vehicleType || "auto";
      }

      resetRicerca();
    });
  });

  if (btnContinuaTarga) {
    btnContinuaTarga.addEventListener("click", function () {
      const targa = targaInput.value.trim().toUpperCase();

      if (searchError) searchError.textContent = "";

      if (!targa) {
        searchError.textContent = "Inserisci la targa.";
        return;
      }

      if (targa.length < 5) {
        searchError.textContent = "Inserisci una targa valida.";
        return;
      }

      targaInput.value = targa;

      if (vehicleExtra) {
        vehicleExtra.classList.add("open");
      }

      btnContinuaTarga.disabled = true;
      btnContinuaTarga.innerHTML = 'Dati veicolo richiesti';
      btnContinuaTarga.style.opacity = "0.75";
      btnContinuaTarga.style.cursor = "not-allowed";
    });
  }

  if (btnVaiRisultati) {
    btnVaiRisultati.addEventListener("click", function () {
      const targa = targaInput.value.trim().toUpperCase();
      const modello = modelloInput.value.trim();
      const anno = annoInput.value.trim();
      const km = kmInput.value.trim();

      if (searchError) searchError.textContent = "";

      if (!targa || !modello || !anno || !km) {
        searchError.textContent =
          "Completa targa, modello, anno di immatricolazione e chilometraggio.";
        return;
      }

      const veicolo = saveVehicleData();
      loadInlineWarrantyResults(veicolo);
    });
  }
});
