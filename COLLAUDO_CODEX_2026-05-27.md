# Collaudo Codex - 2026-05-27

Pacchetto aggiornato dopo verifica funzionale e visuale.

## Esiti test

- Controllo sintassi server: superato.
- Smoke API originale: 18/18.
- Test profondo flussi veicolo/preventivo/ticket/checkout/certificato: 32/32.
- Smoke UI browser: 11/11.
- Controllo mobile rapido: nessun overflow orizzontale su home e login admin.

## Flussi verificati

- Caricamento PDF e creazione soluzione di garanzia partner.
- Gestione elenco veicoli non attivabili.
- Gestione elenco veicoli attivabili con preventivazione.
- Comparatore per modello standard.
- Comparatore per modello con preventivazione.
- Comparatore per modello non attivabile.
- Apertura ticket preventivo lato concessionario e lato privato.
- Risposta partner al preventivo.
- Accettazione preventivo dalla sezione ticket.
- Checkout con pagamento simulato.
- Emissione certificato PDF.
- Verifica pubblica certificato.
- Dashboard admin, partner, concessionario e privato.

## Correzioni principali

- Il server blocca l'acquisto di veicoli non attivabili anche se si prova a bypassare la UI.
- Il server richiede un ticket preventivo accettato per i veicoli attivabili solo con preventivazione.
- Il checkout invia il riferimento del ticket preventivo accettato.
- Dashboard admin riallineata alla palette premium navy/verde.
- Smoke test UI aggiornato al comportamento attuale della home con risultati inline.

## Note

- Stripe e SMTP non sono configurati in locale; il pagamento carta reale richiede chiavi Stripe valide.
- Il pacchetto non include dati runtime locali come `node_modules`, `database.db`, log, upload e certificati generati durante i test.
