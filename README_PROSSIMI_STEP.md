# EstendiFacile.it - Stato professionale progetto

## Modifiche applicate in questa versione

1. Aggiunta verifica pubblica certificato:
   - pagina `/verifica-certificato.html`
   - API `GET /api/verifica-certificato/:numero`

2. Aggiunto QR code dentro i certificati PDF generati.
   Il QR punta alla pagina pubblica di verifica con il numero certificato precompilato.

3. Aggiunti file di progetto mancanti:
   - `package.json`
   - `.env.example`

## Avvio locale

```bash
npm install
cp .env.example .env
npm run start
```

Poi aprire:

```text
http://localhost:3000
```

## Credenziali demo già previste nel server

Partner 1:
- email: partner@estendifacile.it
- password: partner123

Partner 2:
- email: partner2@estendifacile.it
- password: partner456

## Prossime priorità consigliate

1. Separare `server.js` in route/controller/service.
2. Completare area admin.
3. Aggiungere gestione scadenze e rinnovi.
4. Rafforzare sicurezza produzione.
5. Passare da SQLite a PostgreSQL quando il gestionale va online con più utenti.
