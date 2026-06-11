# Fix risultati non autenticati

Modifica applicata alla pagina risultati/comparatore:

- Se l'utente non e' autenticato, le garanzie compatibili non mostrano piu' prezzo, durata, copertura, PDF e dettagli commerciali.
- Rimane leggibile solo il nome del partner/brand.
- I dettagli sono offuscati con messaggio di accesso richiesto.
- Sono presenti CTA chiare: Accedi e Registrati gratis.
- Se l'utente e' autenticato, la pagina continua a mostrare dettagli completi e mantiene il flusso verso il checkout per il concessionario.

File modificati:
- public/js/risultati.js
- public/approved-ui.css
