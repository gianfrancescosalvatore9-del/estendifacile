# Checklist messa online

Prima del deploy:

1. Copia `.env.example` in `.env` sul server e imposta valori reali.
2. Imposta `JWT_SECRET` con una chiave casuale lunga almeno 32 caratteri.
3. Imposta `APP_URL` e `FRONTEND_URL` con il dominio pubblico definitivo.
4. Configura `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` se vuoi abilitare i pagamenti con carta.
5. Configura SMTP se vuoi inviare email automatiche a partner e clienti.
6. Esegui `npm ci`.
7. Esegui `npm run check`.
8. Esegui `npm audit --audit-level=low` e verifica che non segnali vulnerabilita'.
9. Avvia con `NODE_ENV=production npm start`.

Note operative:

- In produzione il server non parte se `JWT_SECRET` e' assente, troppo corto o lasciato al valore segnaposto.
- Senza Stripe configurato, il pagamento con carta viene bloccato e non viene segnato come pagato.
- `database.db`, `.env`, `public/uploads` e `public/certificati` sono dati/runtime: gestiscili con backup separati dal codice.
