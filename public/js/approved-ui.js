(function () {
  function ensurePremiumCss() {
    if (document.querySelector('link[href^="/premium-uniform.css"]')) return;

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/premium-uniform.css?v=20260521";
    document.head.appendChild(link);
  }

  function text(id) {
    var el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : "";
  }

  function firstWord(value) {
    return (value || "").replace(/Caricamento\.\.\./i, "").trim() || "";
  }

  function updateConcessionario() {
    var shell = document.querySelector(".dashboard-shell");
    if (!shell) return;

    var h1 = shell.querySelector(".hero-panel h1");
    if (!h1) return;

    var name = firstWord(text("sidebarUserName")) || "Concessionario";
    h1.textContent = "Ciao " + name;

    var panel = shell.querySelector(".hero-panel");
    if (panel && !panel.querySelector(".approved-actions")) {
      var actions = document.createElement("div");
      actions.className = "btn-row approved-actions";
      actions.innerHTML =
        '<button class="btn btn-primary sidebar-section-btn" type="button" data-section="search">Nuova ricerca</button>' +
        '<button class="btn btn-outline sidebar-section-btn" type="button" data-section="orders">Le mie pratiche</button>' +
        '<a class="btn btn-outline" href="/risultati.html">Ordini e pagamenti</a>';
      panel.appendChild(actions);
    }
  }

  function updatePartner() {
    var shell = document.querySelector(".partner-shell");
    if (!shell) return;

    var h1 = shell.querySelector(".topbar-panel h1");
    if (!h1) return;

    var name = firstWord(text("sidebarPartnerName")) || "Partner";
    h1.textContent = "Ciao " + name;

    var p = document.getElementById("partnerInfo");
    if (p && /Caricamento/i.test(p.textContent || "")) {
      p.textContent = "Gestisci catalogo, supplementi, certificati e ordini concessionari da un'unica piattaforma professionale.";
    }

    var panel = shell.querySelector(".topbar-panel");
    if (panel && !panel.querySelector(".approved-actions")) {
      var actions = document.createElement("div");
      actions.className = "btn-row approved-actions";
      actions.innerHTML =
        '<button class="btn btn-primary partner-section-btn" type="button" data-section="orders">Ordini ricevuti</button>' +
        '<button class="btn btn-outline partner-section-btn" type="button" data-section="catalog">Catalogo garanzie</button>' +
        '<button class="btn btn-outline partner-section-btn" type="button" data-section="supplements">Supplementi</button>';
      panel.appendChild(actions);
    }
  }

  function tick() {
    updateConcessionario();
    updatePartner();
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensurePremiumCss();
    tick();

    var mo = new MutationObserver(tick);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
