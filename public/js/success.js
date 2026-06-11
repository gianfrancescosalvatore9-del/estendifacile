document.addEventListener("DOMContentLoaded", function () {
  function euro(cents) { return "€ " + (Number(cents || 0) / 100).toFixed(2).replace(".", ","); }
  function formatDateIT(dateString) { if (!dateString) return "—"; const d = new Date(dateString + "T00:00:00"); return Number.isNaN(d.getTime()) ? dateString : d.toLocaleDateString("it-IT"); }
  function safe(value, fallback = "—") { return value === undefined || value === null || value === "" ? fallback : value; }
  function item(label, value) { return `<div class="detail-item"><small>${label}</small><strong>${value}</strong></div>`; }

  function dashboardUrl() {
    const ctx = localStorage.getItem("checkoutReturnContext") || localStorage.getItem("tipoUtente") || (localStorage.getItem("privatoToken") ? "privato" : "concessionario");
    return ctx === "privato" ? "/profilo.html" : "/dashboard-concessionario.html";
  }
  function comparatorUrl() {
    const ctx = localStorage.getItem("checkoutReturnContext") || localStorage.getItem("tipoUtente") || (localStorage.getItem("privatoToken") ? "privato" : "concessionario");
    return ctx === "privato" ? "/profilo.html#comparatore" : "/dashboard-concessionario.html#comparatore";
  }
  document.querySelectorAll("[data-dashboard-link]").forEach(a => a.setAttribute("href", dashboardUrl()));
  document.querySelectorAll("[data-new-practice-link]").forEach(a => a.setAttribute("href", comparatorUrl()));

  const ordine = JSON.parse(localStorage.getItem("ultimoOrdine") || "null");
  const orderDetails = document.getElementById("orderDetails");
  const nextSteps = document.getElementById("nextSteps");
  const totalFinale = document.getElementById("totalFinale");

  if (!ordine) {
    orderDetails.innerHTML = item("Stato", "Nessun dato disponibile");
    nextSteps.innerHTML = `<div class="step">Torna alla dashboard per consultare le pratiche salvate.</div>`;
    return;
  }

  const stato = ordine.pagamento?.stato === "in_attesa" ? `<span class="status pending">In attesa</span>` : `<span class="status">Pagato</span>`;
  const durata = ordine.validita?.durata_mesi || ordine.garanzia?.durata || 12;
  const inizio = ordine.validita?.inizio;
  const fine = ordine.validita?.fine;
  const cliente = `${ordine.proprietario?.nome || ""} ${ordine.proprietario?.cognome || ""}`.trim();

  orderDetails.innerHTML = [
    item("ID ordine", `#${safe(ordine.ordineId)}`),
    item("Garanzia", safe(ordine.garanzia?.nome)),
    item("Veicolo", safe(ordine.veicolo?.modello)),
    item("Targa", safe(ordine.veicolo?.targa)),
    item("Cliente", safe(cliente)),
    item("Pagamento", safe(ordine.pagamento?.metodo)),
    item("Stato", stato),
    item("Inizio garanzia", `${formatDateIT(inizio)} ore 00:00`),
    item("Fine garanzia", `${formatDateIT(fine)} ore 23:59`),
    item("Durata", `${durata} mesi`)
  ].join("");

  if (ordine.pagamento?.stato === "in_attesa") {
    nextSteps.innerHTML = `<div class="step">Attendere ricezione bonifico</div><div class="step">Verifica pagamento manuale</div><div class="step">Attivazione garanzia</div>`;
  } else {
    nextSteps.innerHTML = `<div class="step">Pagamento confermato</div><div class="step">Attivazione pratica in corso</div><div class="step">Invio documentazione cliente</div>`;
  }
  totalFinale.textContent = euro(ordine.pagamento?.prezzo_finale || ordine.garanzia?.prezzo || 0);
});
