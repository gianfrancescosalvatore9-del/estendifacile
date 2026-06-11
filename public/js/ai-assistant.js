
(function(){
  if (window.__efAssistantLoaded) return;
  window.__efAssistantLoaded = true;

  const euro = cents => "€ " + (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  const text = v => String(v || '').trim();
  const $ = sel => document.querySelector(sel);

  function getVehicleFromPage(){
    return {
      targa: text(localStorage.getItem('veicolo_targa') || localStorage.getItem('targa') || $('#dashTargaInput')?.value || $('#vehicleTarga')?.textContent),
      modello: text(localStorage.getItem('veicolo_modello') || $('#dashModelloInput')?.value || $('#vehicleModello')?.textContent),
      anno: text(localStorage.getItem('veicolo_anno') || $('#dashAnnoInput')?.value || $('#vehicleAnno')?.textContent),
      km: text(localStorage.getItem('veicolo_km') || $('#dashKmInput')?.value || $('#vehicleKm')?.textContent).replace(/\D/g,'')
    };
  }

  function compatible(g, v){
    if (String(g.stato || 'attiva').toLowerCase() === 'sospesa') return false;
    if (Number(g.limiti_attivi || 0) !== 1) return true;
    const km = Number(v.km || 0), anno = Number(v.anno || 0);
    if (g.limite_km && km > Number(g.limite_km)) return false;
    if (g.limite_immatricolazione && anno < Number(g.limite_immatricolazione)) return false;
    return true;
  }

  function scoreWarranty(g, v){
    const km = Number(v.km || 0);
    const year = Number(v.anno || new Date().getFullYear());
    const age = Math.max(0, new Date().getFullYear() - year);
    let score = 0;
    const durata = Number(g.durata || 0);
    const prezzo = Number(g.prezzo || 0);
    const coverage = String((g.nome || '') + ' ' + (g.descrizione || '') + ' ' + (g.copertura || '')).toLowerCase();

    score += Math.min(durata, 48) * 2;
    if (/full|premium|completa|elettronica|climatizzazione|assistenza/.test(coverage)) score += 35;
    if (/motore|cambio/.test(coverage)) score += 22;
    if (km > 120000 || age >= 8) score += /full|premium|completa|over|motore|cambio/.test(coverage) ? 35 : 8;
    if (km < 70000 && age <= 5) score += durata >= 24 ? 20 : 10;
    if (prezzo) score += Math.max(0, 30 - prezzo / 10000); // premia rapporto qualità/prezzo senza scegliere solo il più economico
    if (Number(g.limiti_attivi || 0) === 1) score += 8;
    return Math.round(score);
  }

  async function loadWarranties(v){
    const params = new URLSearchParams();
    if (v.km) params.set('km', v.km);
    if (v.anno) params.set('anno', v.anno);
    const res = await fetch('/api/garanzie' + (params.toString() ? '?' + params.toString() : ''));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore nel caricamento garanzie');
    return data;
  }

  function addMessage(body, who='bot'){
    const el = document.createElement('div');
    el.className = 'ef-msg ' + who;
    el.innerHTML = body;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function quickChips(){
    const wrap = document.createElement('div');
    wrap.className = 'ef-assistant-chips';
    const chips = [
      ['recommend','Consigliami garanzia'],
      ['practice','Come creo una pratica?'],
      ['certificate','Come emetto/verifico un certificato?']
    ];
    chips.forEach(([key,label])=>{
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ef-chip'; b.textContent = label;
      b.addEventListener('click',()=>handleIntent(key));
      wrap.appendChild(b);
    });
    messages.appendChild(wrap);
  }

  function showVehicleForm(){
    const v = getVehicleFromPage();
    const box = document.createElement('form');
    box.className = 'ef-assistant-form';
    box.innerHTML = `
      <input name="modello" placeholder="Modello veicolo" value="${v.modello && v.modello !== '—' ? v.modello : ''}">
      <input name="anno" type="number" placeholder="Anno immatricolazione" value="${v.anno && v.anno !== '—' ? v.anno : ''}">
      <input name="km" type="number" placeholder="Chilometri" value="${v.km || ''}">
      <button type="submit">Analizza e consiglia</button>
    `;
    box.addEventListener('submit', async e => {
      e.preventDefault();
      const form = new FormData(box);
      const vehicle = { modello:text(form.get('modello')), anno:text(form.get('anno')), km:text(form.get('km')) };
      localStorage.setItem('veicolo_modello', vehicle.modello);
      localStorage.setItem('veicolo_anno', vehicle.anno);
      localStorage.setItem('veicolo_km', vehicle.km);
      addMessage(`Analizza ${vehicle.modello || 'veicolo'} · anno ${vehicle.anno || 'n/d'} · ${vehicle.km || '0'} km`, 'user');
      await recommend(vehicle);
    });
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
  }

  async function recommend(vehicle){
    const v = vehicle || getVehicleFromPage();
    if (!v.anno || !v.km) {
      addMessage('Per consigliarti bene mi servono almeno anno e chilometraggio del veicolo.');
      showVehicleForm();
      return;
    }
    addMessage('Sto confrontando garanzie compatibili, limiti km/anno, durata, coperture e rapporto prezzo/copertura...');
    try{
      const data = await loadWarranties(v);
      const ranked = data.filter(g => compatible(g, v)).map(g => ({...g, _score:scoreWarranty(g, v)})).sort((a,b)=>b._score-a._score).slice(0,3);
      if (!ranked.length) { addMessage('Non ho trovato garanzie compatibili con questi dati. Prova a ridurre i filtri o contattare un partner.'); return; }
      const cards = ranked.map((g,i)=>`
        <div class="ef-ai-card">
          <strong>${i===0?'Consigliata: ':''}${g.nome || 'Garanzia'}</strong><br>
          <span>${g.brand || 'Partner'} · ${g.durata || '—'} mesi · punteggio IA ${g._score}</span>
          <div class="price">${euro(g.prezzo || 0)}</div>
          <small>${reason(g, v)}</small>
        </div>`).join('');
      addMessage(`Ecco le migliori opzioni per il veicolo inserito:${cards}<br><br><a href="/risultati.html" class="ef-chip">Apri comparatore</a>`);
    }catch(err){
      addMessage('Non riesco a caricare le garanzie in questo momento. Verifica che il server sia avviato.');
    }
  }

  function reason(g, v){
    const km = Number(v.km || 0), age = new Date().getFullYear() - Number(v.anno || new Date().getFullYear());
    const durata = Number(g.durata || 0);
    const parts = [];
    if (durationText(durata)) parts.push(durationText(durata));
    if (km > 120000 || age >= 8) parts.push('adatta a veicoli con età/km elevati');
    if (/full|premium|completa/i.test((g.nome||'')+' '+(g.descrizione||''))) parts.push('copertura più completa');
    if (g.limite_km || g.limite_immatricolazione) parts.push('limiti compatibili con i dati inseriti');
    return parts.length ? parts.join(' · ') : 'buon equilibrio tra prezzo, durata e copertura';
  }
  function durationText(d){ if (d >= 36) return 'durata estesa'; if (d >= 24) return 'durata superiore alla base'; return ''; }

  function handleIntent(intent){
    if (intent === 'recommend') return recommend();
    if (intent === 'practice') return addMessage('Per creare una pratica: entra come concessionario, vai su “Nuova ricerca”, inserisci targa/modello/anno/km, confronta le garanzie, scegli quella più adatta e completa il checkout.');
    if (intent === 'certificate') return addMessage('Il partner vede gli ordini pagati nella dashboard e può emettere il certificato. Il cliente può verificarlo dalla pagina “Verifica certificato” o tramite QR nel PDF.');
  }

  function handleText(q){
    const l = q.toLowerCase();
    if (/consiglia|miglior|garanzia|veicolo|auto|moto/.test(l)) return recommend();
    if (/certificat|qr|verifica/.test(l)) return handleIntent('certificate');
    if (/pratica|ordine|checkout|acquisto/.test(l)) return handleIntent('practice');
    addMessage('Posso aiutarti a scegliere la garanzia migliore, creare una pratica, gestire ordini o capire certificati e QR. Usa uno dei pulsanti rapidi oppure scrivimi cosa vuoi fare.');
  }

  const button = document.createElement('button');
  button.className = 'ef-assistant-button';
  button.type = 'button';
  button.innerHTML = '<span>IA</span> Assistente';
  const panel = document.createElement('div');
  panel.className = 'ef-assistant-panel';
  panel.innerHTML = `
    <div class="ef-assistant-head"><div><strong>Assistente EstendiFacile</strong><small>Aiuto operativo e consiglio garanzia con IA locale</small></div><button class="ef-assistant-close" type="button">×</button></div>
    <div class="ef-assistant-body" id="efAssistantMessages"></div>
    <form class="ef-assistant-foot" id="efAssistantForm"><input class="ef-assistant-input" placeholder="Scrivi qui..." autocomplete="off"><button class="ef-assistant-send" type="submit">Invia</button></form>`;
  document.body.appendChild(button);
  document.body.appendChild(panel);
  const messages = panel.querySelector('#efAssistantMessages');
  const form = panel.querySelector('#efAssistantForm');
  const input = panel.querySelector('.ef-assistant-input');
  button.addEventListener('click',()=>panel.classList.toggle('open'));
  panel.querySelector('.ef-assistant-close').addEventListener('click',()=>panel.classList.remove('open'));
  form.addEventListener('submit', e=>{e.preventDefault(); const q=text(input.value); if(!q) return; input.value=''; addMessage(q,'user'); handleText(q);});
  addMessage('Ciao, sono l’assistente della piattaforma. Posso guidarti nei flussi e consigliarti la garanzia migliore in base al veicolo.');
  quickChips();
})();
