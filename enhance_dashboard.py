from pathlib import Path
p=Path('/mnt/data/proj/public/dashboard-concessionario.html')
s=p.read_text()
css='''

    /* Coerenza pagine interne dashboard */
    .dealer-main { padding-top: 28px !important; }
    .section:not(#section-overview) { padding-top: 0; }
    .section-banner {
      position: relative;
      overflow: hidden;
      border-radius: 24px;
      padding: 26px 28px;
      margin-bottom: 18px;
      color: #ffffff;
      background:
        radial-gradient(circle at 88% 20%, rgba(24,180,90,0.36), transparent 30%),
        linear-gradient(135deg, #071d49 0%, #123477 56%, #255fba 100%);
      box-shadow: 0 22px 55px rgba(7,29,73,0.16);
    }
    .section-banner::after {
      content: "";
      position: absolute;
      right: -70px;
      top: -70px;
      width: 230px;
      height: 230px;
      border-radius: 50%;
      background: rgba(255,255,255,0.09);
    }
    .section-banner .badge {
      background: rgba(255,255,255,0.13);
      border: 1px solid rgba(255,255,255,0.18);
      color: #ffffff;
    }
    .section-banner h2 {
      margin: 0 0 8px;
      font-size: 32px;
      line-height: 1.05;
      font-weight: 950;
      letter-spacing: -0.7px;
      color: #ffffff;
    }
    .section-banner p {
      margin: 0;
      max-width: 760px;
      color: rgba(255,255,255,0.78);
      font-weight: 650;
      line-height: 1.65;
    }
    .section-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .quick-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .quick-stat {
      background: #ffffff;
      border: 1px solid #e2eaf5;
      border-left: 5px solid #18b45a;
      border-radius: 18px;
      padding: 16px 18px;
      box-shadow: 0 10px 24px rgba(7,29,73,0.06);
    }
    .quick-stat.blue { border-left-color: #2563eb; }
    .quick-stat.purple { border-left-color: #7b61ff; }
    .quick-stat.orange { border-left-color: #f97316; }
    .quick-stat small {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 7px;
    }
    .quick-stat strong {
      color: #071d49;
      font-size: 24px;
      font-weight: 950;
      line-height: 1;
    }
    .inner-card-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .feature-card {
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
      border: 1px solid #e2eaf5;
      border-radius: 22px;
      padding: 22px;
      box-shadow: 0 12px 28px rgba(7,29,73,0.06);
    }
    .feature-card::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 4px;
      background: linear-gradient(90deg, #18b45a, #4f8cff, #7b61ff);
    }
    .feature-icon {
      width: 46px;
      height: 46px;
      border-radius: 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #eafaf1;
      color: #0fa34f;
      margin-bottom: 14px;
      font-size: 18px;
    }
    .feature-card h3 { margin: 0 0 8px; font-size: 20px; font-weight: 950; color: #071d49; }
    .feature-card p { margin: 0; color: #64748b; line-height: 1.6; }
    .feature-card .hero-btn { margin-top: 16px; min-height: 42px; }
    .data-list { display: grid; gap: 12px; }
    .data-row-card {
      display: grid;
      grid-template-columns: 46px 1fr auto;
      gap: 14px;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e2eaf5;
      border-radius: 18px;
      padding: 15px;
      box-shadow: 0 8px 20px rgba(7,29,73,0.045);
    }
    .data-row-icon {
      width: 46px;
      height: 46px;
      border-radius: 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #eef6ff;
      color: #2563eb;
    }
    .data-row-card h3 { margin: 0 0 4px; color: #071d49; font-size: 16px; font-weight: 950; }
    .data-row-card p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.45; }
    .page-action-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
    @media (max-width: 900px) {
      .quick-stats, .inner-card-grid { grid-template-columns: 1fr; }
      .data-row-card { grid-template-columns: 46px 1fr; }
      .data-row-card .status-pill { grid-column: 1 / -1; justify-self: start; }
    }
'''
s=s.replace('\n  </style>', css+'\n  </style>')
start=s.index('      <section id="section-payments" class="section">')
end=s.index('    </main>', start)
new='''      <section id="section-payments" class="section">
        <div class="section-banner">
          <div class="badge">Area economica</div>
          <h2>Ordini e pagamenti</h2>
          <p>Una vista dedicata per controllare incassi, pratiche in attesa e ordini completati senza uscire dalla dashboard.</p>
        </div>

        <div class="quick-stats">
          <div class="quick-stat blue"><small>Ordini totali</small><strong id="payTotali">0</strong></div>
          <div class="quick-stat"><small>Pagati</small><strong id="payPagati">0</strong></div>
          <div class="quick-stat orange"><small>In attesa</small><strong id="payAttesa">0</strong></div>
        </div>

        <div class="panel-card">
          <div class="section-toolbar">
            <div class="panel-head" style="margin:0;">
              <h2>Riepilogo pagamenti</h2>
              <p>Gli stati vengono letti dalle pratiche presenti nel tuo account concessionario.</p>
            </div>
            <button class="hero-btn primary sidebar-section-btn" type="button" data-section="orders"><i class="fa-solid fa-folder-open"></i> Apri pratiche</button>
          </div>
          <div id="paymentsContainer" class="data-list"><div class="empty-state">Caricamento pagamenti...</div></div>
        </div>
      </section>

      <section id="section-vehicles" class="section">
        <div class="section-banner">
          <div class="badge">Parco veicoli</div>
          <h2>Veicoli</h2>
          <p>Consulta i veicoli già collegati alle pratiche e avvia rapidamente un nuovo confronto garanzie.</p>
        </div>

        <div class="panel-card">
          <div class="section-toolbar">
            <div class="panel-head" style="margin:0;">
              <h2>Veicoli in pratica</h2>
              <p>Elenco ricavato dalle richieste create dal tuo account.</p>
            </div>
            <button class="hero-btn primary sidebar-section-btn" type="button" data-section="comparatore"><i class="fa-solid fa-scale-balanced"></i> Nuovo confronto</button>
          </div>
          <div id="vehiclesContainer" class="data-list"><div class="empty-state">Caricamento veicoli...</div></div>
        </div>
      </section>

      <section id="section-partner" class="section">
        <div class="section-banner">
          <div class="badge">Network</div>
          <h2>Partner</h2>
          <p>Strumenti e materiali pensati per supportare il concessionario nella gestione quotidiana delle pratiche.</p>
        </div>
        <div class="inner-card-grid">
          <article class="feature-card"><div class="feature-icon"><i class="fa-solid fa-handshake"></i></div><h3>Supporto operativo</h3><p>Area pensata per raccogliere comunicazioni, procedure e materiali dedicati ai partner.</p></article>
          <article class="feature-card"><div class="feature-icon"><i class="fa-solid fa-chart-simple"></i></div><h3>Flusso professionale</h3><p>Dashboard, ordini e comparatore restano nello stesso ambiente, con una UX coerente.</p></article>
        </div>
      </section>

      <section id="section-documents" class="section">
        <div class="section-banner">
          <div class="badge">Archivio</div>
          <h2>Documenti</h2>
          <p>Un’area ordinata per ritrovare certificati, riepiloghi pratica e materiali collegati agli ordini.</p>
        </div>
        <div class="panel-card">
          <div class="section-toolbar">
            <div class="panel-head" style="margin:0;"><h2>Documentazione pratiche</h2><p>I documenti saranno collegati alle pratiche completate.</p></div>
            <button class="hero-btn sidebar-section-btn" type="button" data-section="orders"><i class="fa-solid fa-folder-open"></i> Vai alle pratiche</button>
          </div>
          <div id="documentsContainer" class="data-list"><div class="empty-state">Nessun documento disponibile al momento.</div></div>
        </div>
      </section>

      <section id="section-settings" class="section">
        <div class="section-banner">
          <div class="badge">Configurazione</div>
          <h2>Impostazioni</h2>
          <p>Gestisci profilo, preferenze operative e impostazioni della tua area concessionario.</p>
        </div>
        <div class="inner-card-grid">
          <article class="feature-card"><div class="feature-icon"><i class="fa-regular fa-user"></i></div><h3>Profilo concessionario</h3><p>Consulta dati account, ruolo e stato operativo.</p><button class="hero-btn primary sidebar-section-btn" type="button" data-section="profile">Apri profilo</button></article>
          <article class="feature-card"><div class="feature-icon"><i class="fa-solid fa-shield-halved"></i></div><h3>Sicurezza account</h3><p>Accesso protetto e sessione concessionario separata dall’area pubblica.</p></article>
        </div>
      </section>

      <section id="section-help" class="section">
        <div class="section-banner">
          <div class="badge">Supporto</div>
          <h2>Assistenza e FAQ</h2>
          <p>Risposte rapide e percorsi guidati per utilizzare dashboard, comparatore e pratiche.</p>
        </div>
        <div class="inner-card-grid">
          <article class="feature-card"><div class="feature-icon"><i class="fa-solid fa-scale-balanced"></i></div><h3>Come usare il comparatore</h3><p>Inserisci la targa, completa modello, anno e chilometraggio, poi confronta le garanzie disponibili.</p></article>
          <article class="feature-card"><div class="feature-icon"><i class="fa-solid fa-folder-open"></i></div><h3>Dove trovo le pratiche?</h3><p>La sezione “Le mie pratiche” raccoglie storico, dettagli veicolo, proprietario e stato pagamento.</p></article>
        </div>
      </section>

      <section id="section-profile" class="section">
        <div class="section-banner">
          <div class="badge">Account</div>
          <h2>Profilo concessionario</h2>
          <p>Informazioni principali del tuo account e stato operativo.</p>
        </div>
        <div class="panel-card">
          <div class="profile-list" id="profileList">
            <div class="profile-row"><strong>Caricamento profilo</strong><span>...</span></div>
          </div>
        </div>
      </section>
'''
s=s[:start]+new+s[end:]
p.write_text(s)
print('done')
