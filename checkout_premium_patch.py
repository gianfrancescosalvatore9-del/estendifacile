from pathlib import Path
p=Path('/mnt/data/work_v8/public/checkout.html')
s=p.read_text()
# Replace body background and sidebar with richer dashboard-coherent style
s=s.replace('''    body {
      margin: 0;
      background:
        radial-gradient(circle at top right, rgba(24, 180, 90, 0.06), transparent 32%),
        linear-gradient(180deg, #ffffff 0%, var(--ef-bg) 42%, #ffffff 100%);
      color: var(--ef-text);
      font-family: Arial, Helvetica, sans-serif;
    }''','''    body {
      margin: 0;
      background:
        radial-gradient(circle at 88% 8%, rgba(99, 102, 241, 0.10), transparent 28%),
        radial-gradient(circle at 18% 0%, rgba(24, 180, 90, 0.10), transparent 30%),
        linear-gradient(180deg, #f8fbff 0%, #eef4fb 46%, #ffffff 100%);
      color: var(--ef-text);
      font-family: Arial, Helvetica, sans-serif;
    }''')
s=s.replace('''      background: rgba(255, 255, 255, 0.95);
      color: var(--ef-text);
      border-right: 1px solid var(--ef-border);
      box-shadow: 14px 0 40px rgba(7, 29, 73, 0.035);''','''      background:
        radial-gradient(circle at 20% 8%, rgba(24, 180, 90, 0.28), transparent 22%),
        linear-gradient(180deg, #061a43 0%, #0b2b66 58%, #071d49 100%);
      color: #ffffff;
      border-right: 1px solid rgba(255,255,255,0.12);
      box-shadow: 18px 0 54px rgba(7, 29, 73, 0.18);''')
s=s.replace('''      border-bottom: 1px solid var(--ef-border);''','''      border-bottom: 1px solid rgba(255,255,255,0.14);''',1)
s=s.replace('''      background: var(--ef-blue);''','''      background: linear-gradient(135deg, #ffffff 0%, #dff7ea 100%);''')
s=s.replace('''      color: #ffffff;''','''      color: var(--ef-blue);''',1)
s=s.replace('''      box-shadow: 0 14px 24px rgba(7, 29, 73, 0.18);''','''      box-shadow: 0 18px 34px rgba(0, 0, 0, 0.22);''')
s=s.replace('''      border: 4px solid #ffffff;''','''      border: 4px solid #071d49;''')
s=s.replace('''      color: var(--ef-text);''','''      color: #ffffff;''',1)
s=s.replace('''      color: var(--ef-muted);''','''      color: rgba(255,255,255,0.72);''',1)
s=s.replace('''      background: #f8fbff;
      border: 1px solid #e5edf7;
      border-radius: 18px;
      padding: 16px;
      color: var(--ef-text);''','''      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 18px;
      padding: 16px;
      color: #ffffff;''')
s=s.replace('''      background: #f3fbf6;
      border-color: #bce8cc;''','''      background: rgba(24, 180, 90, 0.18);
      border-color: rgba(24, 180, 90, 0.58);
      box-shadow: inset 4px 0 0 #18b45a;''')
s=s.replace('''      background: #ffffff;
      color: var(--ef-text);
      border: 1px solid var(--ef-border);''','''      background: rgba(255,255,255,0.10);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.14);''')
s=s.replace('''      color: var(--ef-muted);''','''      color: rgba(255,255,255,0.72);''',1)
s=s.replace('''      background: #ffffff;
      color: var(--ef-text);''','''      background: rgba(255,255,255,0.10);
      color: #ffffff;''',1)
# main padding and hero styling
s=s.replace('''    .checkout-main {
      padding: 32px 42px 42px;
      min-width: 0;
    }''','''    .checkout-main {
      padding: 28px 38px 42px;
      min-width: 0;
    }''')
s=s.replace('''      border-radius: 26px;
      padding: 42px 44px;''','''      border-radius: 30px;
      padding: 40px 44px;''')
# replace card styles
s=s.replace('''    .card,
    .summary-card {
      background: white;
      border: 1px solid var(--ef-border);
      border-radius: 24px;
      padding: 24px;
      box-shadow: var(--ef-shadow-soft);
      margin-bottom: 18px;
    }''','''    .card,
    .summary-card {
      position: relative;
      overflow: hidden;
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(210, 222, 238, 0.95);
      border-radius: 26px;
      padding: 24px;
      box-shadow: 0 18px 48px rgba(7,29,73,.075);
      margin-bottom: 18px;
    }

    .card::before,
    .summary-card::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 5px;
      background: linear-gradient(90deg, var(--ef-green), #2563eb, #7c3aed, #f97316);
    }

    .card-headline {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .section-kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ef-green);
      font-size: 12px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 8px;
    }

    .section-icon {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      background: linear-gradient(135deg, var(--ef-green), #2563eb);
      box-shadow: 0 14px 28px rgba(24,180,90,.18);
      flex-shrink: 0;
    }''')
s=s.replace('''    .card h2 { font-size: 30px; }''','''    .card h2 { font-size: 26px; }''')
s=s.replace('''    .info-box {
      background: #f8fbff;
      border: 1px solid #e5edf7;
      border-radius: 18px;
      padding: 16px;
    }''','''    .info-box {
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border: 1px solid #dce8f5;
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 8px 22px rgba(7,29,73,.04);
    }''')
s=s.replace('''    .form-group input {
      width: 100%;
      padding: 14px;
      border: 1px solid #d6deea;
      border-radius: 14px;
      background: white;
      font-size: 15px;
      outline: none;
    }''','''    .form-group input {
      width: 100%;
      padding: 15px 15px;
      border: 1px solid #d6deea;
      border-radius: 15px;
      background: #ffffff;
      font-size: 15px;
      outline: none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
    }''')
s=s.replace('''    .supplemento-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      background: #f8fbff;
      border: 1px solid #e5edf7;
      border-radius: 16px;
      padding: 14px;
      cursor: pointer;
      transition: 0.18s ease;
    }''','''    .supplemento-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      background: linear-gradient(180deg, #ffffff, #f8fbff);
      border: 1px solid #dde8f5;
      border-radius: 18px;
      padding: 16px;
      cursor: pointer;
      transition: 0.18s ease;
    }''')
s=s.replace('''    .payment-option {
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      cursor: pointer;
      background: white;
      transition: 0.2s ease;
    }''','''    .payment-option {
      border: 2px solid #e2e8f0;
      border-radius: 18px;
      padding: 18px;
      cursor: pointer;
      background: linear-gradient(180deg, #ffffff, #f8fbff);
      transition: 0.2s ease;
      min-height: 126px;
    }

    .payment-option i {
      width: 38px;
      height: 38px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #eef6ff;
      color: #2563eb;
      margin-bottom: 12px;
      font-size: 16px;
    }

    .payment-option.active i {
      background: #dcfce7;
      color: var(--ef-green);
    }''')
s=s.replace('''      background: #f3fbf6;
    }''','''      background: linear-gradient(180deg, #f3fbf6, #ffffff);
      box-shadow: 0 14px 34px rgba(24,180,90,.10);
    }''',1)
s=s.replace('''    .economic-box {
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #071d49 0%, #0b2d6c 100%);
      color: white;
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 14px 34px rgba(11, 28, 57, .14);
    }''','''    .economic-box {
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at 85% 12%, rgba(24,180,90,.28), transparent 28%),
        linear-gradient(135deg, #061a43 0%, #0b2d6c 68%, #071d49 100%);
      color: white;
      border-radius: 26px;
      padding: 26px;
      box-shadow: 0 22px 52px rgba(11, 28, 57, .20);
      border: 1px solid rgba(255,255,255,.12);
    }''')
# append responsive and premium action styles before media
insert='''

    .checkout-actions {
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:18px;
      padding-top: 16px;
      border-top: 1px solid #edf2f7;
    }

    .checkout-actions .btn {
      min-height: 50px;
      border-radius: 14px;
      font-weight: 950;
      padding: 0 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
    }

    .summary-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 999px;
      background: #eefcf4;
      color: #0f9f4e;
      border: 1px solid #c8efd7;
      font-size: 12px;
      font-weight: 950;
      margin-bottom: 14px;
    }

    .secure-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 16px;
    }

    .secure-strip span {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      border-radius: 14px;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.14);
      color: #dbe7f9;
      font-size: 12px;
      font-weight: 900;
    }
'''
s=s.replace('''    @keyframes spin { to { transform: rotate(360deg); } }''', insert+'\n    @keyframes spin { to { transform: rotate(360deg); } }')
# add hero secure strip
s=s.replace('''        <p>
          Verifica i dati del veicolo, completa l’intestatario, seleziona eventuali supplementi
          e procedi con il pagamento in un ambiente sicuro e professionale.
        </p>''','''        <p>
          Verifica i dati del veicolo, completa l’intestatario, seleziona eventuali supplementi
          e procedi con il pagamento in un ambiente sicuro e professionale.
        </p>
        <div class="secure-strip">
          <span><i class="fa-solid fa-shield-halved"></i> Area protetta</span>
          <span><i class="fa-solid fa-file-contract"></i> Pratica verificata</span>
          <span><i class="fa-solid fa-lock"></i> Pagamento sicuro</span>
        </div>''')
p.write_text(s)

# Patch checkout.js markup to add professional section headers, icons and non-external change guarantee
p=Path('/mnt/data/work_v8/public/js/checkout.js')
s=p.read_text()
s=s.replace('''          <section class="card">
            <h2>Veicolo e garanzia</h2>
            <p class="card-subtitle">Controlla la pratica prima di procedere con intestatario e pagamento.</p>''','''          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-car-side"></i> Dati pratica</div><h2>Veicolo e garanzia</h2><p class="card-subtitle">Controlla la pratica prima di procedere con intestatario e pagamento.</p></div>
              <div class="section-icon"><i class="fa-solid fa-shield-halved"></i></div>
            </div>''')
s=s.replace('''          <section class="card">
            <h2>Dati proprietario</h2>
            <p class="card-subtitle">Inserisci i dati obbligatori dell’intestatario del veicolo.</p>''','''          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-user-check"></i> Intestatario</div><h2>Dati proprietario</h2><p class="card-subtitle">Inserisci i dati obbligatori dell’intestatario del veicolo.</p></div>
              <div class="section-icon"><i class="fa-solid fa-id-card"></i></div>
            </div>''')
s=s.replace('''          <section class="card">
            <h2>Supplementi applicabili</h2>
            <p class="card-subtitle">Seleziona eventuali supplementi da aggiungere alla garanzia.</p>''','''          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-plus-circle"></i> Extra disponibili</div><h2>Supplementi applicabili</h2><p class="card-subtitle">Seleziona eventuali supplementi da aggiungere alla garanzia.</p></div>
              <div class="section-icon"><i class="fa-solid fa-layer-group"></i></div>
            </div>''')
s=s.replace('''          <section class="card">
            <h2>Metodo di pagamento</h2>
            <p class="card-subtitle">Scegli come procedere.</p>''','''          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-credit-card"></i> Pagamento</div><h2>Metodo di pagamento</h2><p class="card-subtitle">Scegli come procedere.</p></div>
              <div class="section-icon"><i class="fa-solid fa-wallet"></i></div>
            </div>''')
s=s.replace('''              <div class="payment-option active" id="paySimulato">
                <h4>Pagamento simulato</h4>''','''              <div class="payment-option active" id="paySimulato">
                <i class="fa-solid fa-vial-circle-check"></i>
                <h4>Pagamento simulato</h4>''')
s=s.replace('''              <div class="payment-option" id="payCarta">
                <h4>Carta</h4>''','''              <div class="payment-option" id="payCarta">
                <i class="fa-solid fa-credit-card"></i>
                <h4>Carta</h4>''')
s=s.replace('''              <div class="payment-option" id="payBonifico">
                <h4>Bonifico</h4>''','''              <div class="payment-option" id="payBonifico">
                <i class="fa-solid fa-building-columns"></i>
                <h4>Bonifico</h4>''')
s=s.replace('''          <section class="card">
            <h2>Conferme finali</h2>
            <p class="card-subtitle">Prima di procedere, conferma privacy e correttezza dei dati.</p>''','''          <section class="card">
            <div class="card-headline">
              <div><div class="section-kicker"><i class="fa-solid fa-circle-check"></i> Conferma ordine</div><h2>Conferme finali</h2><p class="card-subtitle">Prima di procedere, conferma privacy e correttezza dei dati.</p></div>
              <div class="section-icon"><i class="fa-solid fa-file-signature"></i></div>
            </div>''')
s=s.replace('''            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;">
              <button class="btn btn-primary" type="button" id="btnConfermaOrdine">Procedi al pagamento</button>
              <a href="/risultati.html" class="btn btn-outline">Cambia garanzia</a>
            </div>''','''            <div class="checkout-actions">
              <button class="btn btn-primary" type="button" id="btnConfermaOrdine"><i class="fa-solid fa-lock"></i> Procedi al pagamento</button>
              <a href="#" class="btn btn-outline" id="btnCambiaGaranziaInline"><i class="fa-solid fa-arrow-left"></i> Scegli altra garanzia</a>
            </div>''')
s=s.replace('''          <div class="summary-card">
            <h3>Riepilogo pratica</h3>''','''          <div class="summary-card">
            <div class="summary-pill"><i class="fa-solid fa-shield-heart"></i> Pratica pronta</div>
            <h3>Riepilogo pratica</h3>''')
s=s.replace('''    document.getElementById("btnConfermaOrdine").addEventListener("click", confermaOrdine);''','''    const cambiaInline = document.getElementById("btnCambiaGaranziaInline");
    if (cambiaInline) {
      cambiaInline.addEventListener("click", function(e){
        e.preventDefault();
        const params = new URLSearchParams(window.location.search);
        const from = params.get("from") || localStorage.getItem("checkoutReturnContext") || "concessionario";
        const returnUrl = localStorage.getItem("checkoutReturnUrl") || (from === "privato" ? "/profilo.html#comparatore" : "/dashboard-concessionario.html#comparatore");
        localStorage.setItem("restoreComparatorResults", "1");
        window.location.href = returnUrl;
      });
    }

    document.getElementById("btnConfermaOrdine").addEventListener("click", confermaOrdine);''')
p.write_text(s)
