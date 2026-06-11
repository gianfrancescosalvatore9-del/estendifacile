from pathlib import Path
p=Path('/mnt/data/proj/public/js/dashboard-concessionario.js')
s=p.read_text()
insert='''

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
          <h3>Documenti pratica #${o.id}</h3>
          <p>${o.prodotto_nome || "Garanzia"} · ${o.veicolo_targa || "—"} · ${formatDateTime(o.created_at)}</p>
        </div>
        <span class="status-pill">Disponibile</span>
      </div>
    `).join("");
  }
'''
s=s.replace('  function filtraOrdini() {', insert+'\n  function filtraOrdini() {')
s=s.replace('      aggiornaKpi(data);\n      renderOrdini(data);', '      aggiornaKpi(data);\n      renderOrdini(data);\n      renderPagamenti(data);\n      renderVeicoli(data);\n      renderDocumenti(data);')
p.write_text(s)
print('done')
