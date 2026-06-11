# Controllo login unificato

Modifica effettuata:

- Eliminato `public/partner-login.html` perché duplicava `login.html`.
- Aggiornati tutti i riferimenti residui da `partner-login.html` a `login.html`.
- Aggiornato `public/js/auth-guard.js`: i partner non autenticati vengono rimandati alla pagina unica `login.html`.
- Aggiornato `public/dashboard.html`: redirect/logout partner verso `login.html`.

Logica corretta:

- `login.html` è la pagina unica di accesso per Privato, Concessionario e Partner.
- Dopo login, il redirect avviene in base al ruolo utente.

File modificati automaticamente:
- `public/dashboard.html`
- `public/partner-login.html`
- `public/js/auth-guard.js`
