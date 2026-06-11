from pathlib import Path
# read inline css from dashboard after marker
inline_css = '''
    /* V6: identità visuale coerente con dashboard concessionario */
    html body { margin-top:0!important; padding-top:0!important; }
    body > .main-header, body > .premium-header, body > .topbar { display:none!important; height:0!important; min-height:0!important; }
    .private-main, .partner-main { padding-top:28px!important; }
    .private-sidebar, .partner-sidebar {
      background: linear-gradient(180deg,#071d49 0%, #102d6b 45%, #163d86 100%) !important;
      border-right: 1px solid rgba(255,255,255,.08) !important;
      box-shadow: 14px 0 40px rgba(7,29,73,.12) !important;
    }
    .private-sidebar .nav-item, .partner-sidebar .nav-item { color:rgba(255,255,255,.88)!important; }
    .private-sidebar .nav-item:hover, .partner-sidebar .nav-item:hover { background:rgba(255,255,255,.12)!important; color:#fff!important; transform:translateX(4px)!important; }
    .private-sidebar .nav-item.active, .partner-sidebar .nav-item.active { background:linear-gradient(135deg,#6ea8ff,#7b61ff)!important; color:#fff!important; box-shadow:0 12px 28px rgba(123,97,255,.28)!important; }
    .private-sidebar .ef-mini-logo, .partner-sidebar .ef-mini-logo { background:linear-gradient(135deg,#7b61ff,#4f8cff)!important; }
    .private-sidebar .sidebar-user { background:rgba(255,255,255,.10)!important; border-color:rgba(255,255,255,.14)!important; box-shadow:none!important; }
    .private-sidebar .sidebar-user strong, .private-sidebar .sidebar-user span { color:#fff!important; }
    .section-title, .section-banner-v6 {
      position:relative; overflow:hidden; border-radius:24px; padding:26px 28px; margin-bottom:18px; color:#fff;
      background:radial-gradient(circle at 88% 20%,rgba(24,180,90,.36),transparent 30%),linear-gradient(135deg,#071d49 0%,#123477 56%,#255fba 100%);
      box-shadow:0 22px 55px rgba(7,29,73,.16);
    }
    .section-title h2, .section-banner-v6 h2 { margin:0 0 8px!important; font-size:32px!important; line-height:1.05!important; font-weight:950!important; color:#fff!important; }
    .section-title p, .section-banner-v6 p { margin:0!important; max-width:760px; color:rgba(255,255,255,.78)!important; font-weight:650; line-height:1.65; }
    .panel-card, .table-card { border-radius:24px!important; border:1px solid #e2eaf5!important; box-shadow:0 14px 32px rgba(7,29,73,.07)!important; }
    .kpi-grid { gap:12px!important; margin-bottom:18px!important; }
    .kpi-card { min-height:82px!important; padding:13px 15px!important; border-radius:15px!important; }
    .kpi-icon { width:36px!important; height:36px!important; font-size:14px!important; }
    .kpi-label { font-size:10px!important; margin-bottom:5px!important; }
    .kpi-value { font-size:22px!important; margin-bottom:3px!important; }
    .kpi-note { font-size:10px!important; }
    .comparatore-panel-v6 {
      padding:34px; border:1px solid rgba(79,140,255,.34); border-radius:28px; color:#fff;
      background:radial-gradient(circle at 84% 18%, rgba(24,180,90,.35), transparent 34%),linear-gradient(120deg,rgba(7,29,73,.96),rgba(12,44,103,.94) 45%,rgba(38,95,180,.88));
      box-shadow:0 26px 70px rgba(7,29,73,.18); position:relative; overflow:hidden;
    }
    .comparatore-panel-v6::before { content:""; position:absolute; inset:0 auto 0 0; width:9px; background:linear-gradient(180deg,#18b45a,#4f8cff,#7b61ff); }
    .comparatore-panel-v6 h2 { margin:0 0 8px; color:#fff; font-size:32px; font-weight:950; }
    .comparatore-panel-v6 p { margin:0 0 20px; color:rgba(255,255,255,.78); line-height:1.6; }
    .badge-v6 { display:inline-flex; border-radius:999px; padding:8px 13px; margin-bottom:14px; font-size:12px; font-weight:950; text-transform:uppercase; background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.18); }
    .plate-wrap-v6 { display:grid; grid-template-columns:58px 1fr; max-width:460px; overflow:hidden; border-radius:18px; border:1px solid rgba(255,255,255,.22); box-shadow:0 18px 35px rgba(0,0,0,.16); margin-bottom:14px; }
    .plate-country-v6 { display:flex; align-items:center; justify-content:center; background:#2456a6; color:#fff; font-weight:950; }
    .plate-wrap-v6 input, .form-row-v6 input { width:100%; border:0; padding:16px; font-weight:900; font-size:16px; outline:none; }
    .search-fields-v6 { display:none; margin-top:18px; }
    .search-fields-v6.open { display:block; }
    .form-row-v6 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
    .form-group-v6 { display:grid; gap:8px; }
    .form-group-v6 label { color:#fff; font-weight:900; font-size:13px; }
    .form-group-v6 input { border-radius:16px; border:1px solid rgba(255,255,255,.22); box-shadow:0 18px 35px rgba(0,0,0,.16); }
    .search-error-v6 { color:#fecaca; font-weight:900; margin-top:12px; }
    .inline-results { display:none; margin-top:18px; } .inline-results.open { display:block; }
    .inline-results-head { display:flex; justify-content:space-between; gap:18px; flex-wrap:wrap; padding:24px 26px; margin-bottom:14px; border-radius:24px; color:#fff; background:radial-gradient(circle at 92% 18%, rgba(24,180,90,.30), transparent 32%), linear-gradient(135deg,#071d49 0%,#123477 55%,#255fba 100%); box-shadow:0 22px 55px rgba(7,29,73,.16); }
    .inline-results-head h2 { margin:0 0 6px; color:#fff; font-size:28px; font-weight:950; } .inline-results-head p { margin:0; color:rgba(255,255,255,.78); font-weight:750; }
    .inline-results-grid { display:grid; gap:14px; }
    .inline-warranty-card { display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:18px; background:linear-gradient(135deg,#fff,#f8fbff); border:1px solid #e2eaf5; border-radius:24px; padding:20px; box-shadow:0 14px 32px rgba(7,29,73,.07); position:relative; overflow:hidden; }
    .inline-warranty-card::before { content:""; position:absolute; inset:0 auto 0 0; width:5px; background:linear-gradient(180deg,#18b45a,#4f8cff,#7b61ff); }
    .warranty-topline { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
    .compatibility,.brand-pill { display:inline-flex; border-radius:999px; padding:7px 10px; font-size:12px; font-weight:950; } .compatibility{background:#eafaf1;color:#0fa34f}.brand-pill{background:#eef6ff;color:#2563eb}
    .inline-warranty-card h3{margin:0 0 8px;color:#071d49;font-size:22px;font-weight:950}.inline-warranty-card p{margin:0 0 14px;color:#64748b;line-height:1.55}
    .warranty-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.warranty-mini-grid span{background:#fff;border:1px solid #edf2f7;border-radius:15px;padding:11px}.warranty-mini-grid small{display:block;color:#64748b;font-size:10px;font-weight:950;text-transform:uppercase;margin-bottom:5px}.warranty-mini-grid strong{color:#071d49;font-weight:950}
    .warranty-price-box{display:flex;flex-direction:column;justify-content:space-between;gap:12px;padding:16px;border-radius:20px;background:#071d49;color:#fff}.warranty-price-box small{color:#cfe0ff;font-weight:900;text-transform:uppercase}.warranty-price-box strong{font-size:28px;font-weight:950}
    @media(max-width:800px){.form-row-v6,.inline-warranty-card,.warranty-mini-grid{grid-template-columns:1fr}.warranty-price-box{background:#f8fbff;color:#071d49;border:1px solid #e2eaf5}}
'''

# patch profilo
p=Path('public/profilo.html')
s=p.read_text()
s=s.replace('</style>', inline_css+'\n  </style>')
s=s.replace('''        <button class="nav-item private-section-btn" type="button" data-section="garanzie">\n          <span class="nav-icon"><i class="fa-solid fa-shield-halved"></i></span>\n          Le mie garanzie\n        </button>''','''        <button class="nav-item private-section-btn" type="button" data-section="comparatore">\n          <span class="nav-icon"><i class="fa-solid fa-scale-balanced"></i></span>\n          Comparatore\n        </button>\n\n        <button class="nav-item private-section-btn" type="button" data-section="garanzie">\n          <span class="nav-icon"><i class="fa-solid fa-shield-halved"></i></span>\n          Le mie garanzie\n        </button>''')
s=s.replace('''            <a class="hero-btn primary" href="/index.html">\n              <i class="fa-solid fa-magnifying-glass-chart"></i>\n              Confronta garanzie\n            </a>''','''            <button class="hero-btn primary" type="button" data-go="comparatore">\n              <i class="fa-solid fa-magnifying-glass-chart"></i>\n              Confronta garanzie\n            </button>''')
insert='''\n      <section id="section-comparatore" class="section">\n        <div class="comparatore-panel-v6">\n          <span class="badge-v6">Comparatore garanzie</span>\n          <h2>Confronta le garanzie senza uscire dalla dashboard</h2>\n          <p>Inserisci targa, modello, anno di immatricolazione e chilometraggio. Le soluzioni compatibili compariranno qui sotto, nella stessa pagina.</p>\n\n          <div class="plate-wrap-v6">\n            <div class="plate-country-v6">IT</div>\n            <input id="privCmpTargaInput" type="text" placeholder="ES. AB123CD" maxlength="8" />\n          </div>\n\n          <button class="hero-btn primary" type="button" id="privBtnApriComparatore">Continua</button>\n\n          <div class="search-fields-v6" id="privCmpExtraFields">\n            <div class="form-row-v6">\n              <div class="form-group-v6"><label for="privCmpModelloInput">Modello veicolo</label><input id="privCmpModelloInput" type="text" placeholder="Es. Fiat Panda" /></div>\n              <div class="form-group-v6"><label for="privCmpAnnoInput">Anno immatricolazione</label><input id="privCmpAnnoInput" type="number" placeholder="Es. 2019" /></div>\n            </div>\n            <div class="form-row-v6">\n              <div class="form-group-v6"><label for="privCmpKmInput">Chilometraggio</label><input id="privCmpKmInput" type="number" placeholder="Es. 65000" /></div>\n              <div class="form-group-v6"><label>&nbsp;</label><button class="hero-btn primary" type="button" id="privBtnConfrontaGaranzie">Confronta garanzie</button></div>\n            </div>\n          </div>\n          <div id="privCmpSearchError" class="search-error-v6"></div>\n        </div>\n        <div id="privInlineResults" class="inline-results"></div>\n      </section>\n'''
s=s.replace('''      <section id="section-garanzie" class="section">''', insert+'\n      <section id="section-garanzie" class="section">''')
script_add=r'''

    function euro(cents) { return "€ " + (Number(cents || 0) / 100).toFixed(2).replace(".", ","); }
    function formatKm(value) { return Number(value || 0).toLocaleString("it-IT") + " km"; }
    function validaTarga(targa) { return /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(targa); }
    function getVeicoloInline() {
      return { targa: localStorage.getItem("veicolo_targa") || localStorage.getItem("targa") || "", modello: localStorage.getItem("veicolo_modello") || "", anno: localStorage.getItem("veicolo_anno") || "", km: localStorage.getItem("veicolo_km") || "" };
    }
    function garanziaCompatibileInline(g) {
      const v = getVeicoloInline();
      if (String(g.stato || "attiva").toLowerCase() === "sospesa") return false;
      if (Number(g.limiti_attivi || 0) !== 1) return true;
      if (g.limite_km && Number(v.km || 0) > Number(g.limite_km)) return false;
      if (g.limite_immatricolazione && Number(v.anno || 0) < Number(g.limite_immatricolazione)) return false;
      return true;
    }
    function apriComparatorePrivato() {
      const targaInput = document.getElementById("privCmpTargaInput");
      const errorBox = document.getElementById("privCmpSearchError");
      const extra = document.getElementById("privCmpExtraFields");
      const targa = targaInput.value.trim().toUpperCase();
      errorBox.textContent = "";
      if (!targa) { errorBox.textContent = "Inserisci la targa per continuare."; return; }
      if (!validaTarga(targa)) { errorBox.textContent = "Inserisci una targa valida nel formato italiano es. AB123CD."; return; }
      targaInput.value = targa;
      extra.classList.add("open");
      document.getElementById("privCmpModelloInput").focus();
    }
    async function confrontaGaranziePrivato() {
      const errorBox = document.getElementById("privCmpSearchError");
      const targa = document.getElementById("privCmpTargaInput").value.trim().toUpperCase();
      const modello = document.getElementById("privCmpModelloInput").value.trim();
      const anno = document.getElementById("privCmpAnnoInput").value.trim();
      const km = document.getElementById("privCmpKmInput").value.trim();
      errorBox.textContent = "";
      if (!targa || !modello || !anno || !km) { errorBox.textContent = "Compila tutti i campi del veicolo."; return; }
      if (!validaTarga(targa)) { errorBox.textContent = "Inserisci una targa valida nel formato italiano es. AB123CD."; return; }
      if (Number(anno) < 1980 || Number(anno) > new Date().getFullYear()) { errorBox.textContent = "Inserisci un anno di immatricolazione valido."; return; }
      if (Number(km) < 0) { errorBox.textContent = "Inserisci un chilometraggio valido."; return; }
      localStorage.setItem("targa", targa); localStorage.setItem("veicolo_targa", targa); localStorage.setItem("veicolo_modello", modello); localStorage.setItem("veicolo_anno", anno); localStorage.setItem("veicolo_km", km);
      const box = document.getElementById("privInlineResults");
      box.classList.add("open");
      box.innerHTML = `<div class="inline-results-head"><div><span class="badge-v6">Soluzioni compatibili</span><h2>Garanzie disponibili per ${targa}</h2><p>${modello} • ${anno} • ${formatKm(km)}</p></div><div>Caricamento...</div></div>`;
      try {
        const res = await fetch("/api/garanzie");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore caricamento garanzie");
        const lista = data.filter(garanziaCompatibileInline).sort((a,b)=>Number(a.prezzo||0)-Number(b.prezzo||0));
        if (!lista.length) { box.innerHTML = `<div class="inline-results-head"><div><span class="badge-v6">0 risultati</span><h2>Nessuna garanzia compatibile</h2><p>Modifica i dati del veicolo e riprova.</p></div></div>`; return; }
        box.innerHTML = `<div class="inline-results-head"><div><span class="badge-v6">${lista.length} risultat${lista.length===1?"o":"i"}</span><h2>Soluzioni compatibili</h2><p>${targa} • ${modello} • ${anno} • ${formatKm(km)}</p></div></div><div class="inline-results-grid">${lista.map(g=>`<article class="inline-warranty-card"><div><div class="warranty-topline"><span class="compatibility">✓ Compatibile</span><span class="brand-pill">${g.brand||"Partner"}</span></div><h3>${g.nome||"Garanzia"}</h3><p>${g.descrizione||"Soluzione di garanzia disponibile per il veicolo selezionato."}</p><div class="warranty-mini-grid"><span><small>Durata</small><strong>${g.durata||"—"} mesi</strong></span><span><small>Stato</small><strong>${g.stato||"attiva"}</strong></span><span><small>Documento</small><strong>${g.pdf_url?"PDF":"N/D"}</strong></span></div></div><aside class="warranty-price-box"><small>Prezzo base</small><strong>${euro(g.prezzo||0)}</strong><button class="hero-btn primary btnScegliPriv" type="button" data-id="${g.id}">Scegli</button></aside></article>`).join("")}</div>`;
        box.querySelectorAll(".btnScegliPriv").forEach(button => button.addEventListener("click", () => { const garanzia = lista.find(g => Number(g.id) === Number(button.dataset.id)); if (garanzia) { localStorage.setItem("garanziaSelezionata", JSON.stringify(garanzia)); window.location.href = "/checkout.html"; } }));
        box.scrollIntoView({ behavior:"smooth", block:"start" });
      } catch (error) { box.innerHTML = `<div class="empty">${error.message || "Errore di connessione al server."}</div>`; }
    }
    document.getElementById("privBtnApriComparatore")?.addEventListener("click", apriComparatorePrivato);
    document.getElementById("privBtnConfrontaGaranzie")?.addEventListener("click", confrontaGaranziePrivato);
'''
s=s.replace('''    document.getElementById("profileForm").addEventListener("submit", (e) => {''', script_add+'\n    document.getElementById("profileForm").addEventListener("submit", (e) => {''')
p.write_text(s)

# patch partner CSS
p=Path('public/partner-dashboard.html')
s=p.read_text()
s=s.replace('</style>', inline_css+'\n  </style>')
s=s.replace('<a href="/risultati.html" class="nav-item">\n          <span class="nav-icon"><i class="fa-solid fa-store"></i></span><span class="nav-text">Offerte pubbliche</span>\n        </a>', '<button class="nav-item partner-section-btn" type="button" data-section="catalog">\n          <span class="nav-icon"><i class="fa-solid fa-store"></i></span><span class="nav-text">Offerte pubbliche</span>\n        </button>')
p.write_text(s)
