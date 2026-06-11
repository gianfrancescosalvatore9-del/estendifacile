# Certificato premium EstendiFacile

Aggiornata la funzione server-side `generaPdfCertificato()` in `server.js`.

Migliorie:
- layout PDF A4 premium
- logo EF/EstendiFacile in testata
- badge garanzia attiva
- card dati garanzia, veicolo, proprietario e importi
- totale evidenziato
- QR code in box verifica autenticita
- footer corporate verificabile

Il flusso funzionale di emissione certificato resta invariato: il partner emette il certificato dalla dashboard e il sistema genera il PDF nella cartella `public/certificati`.
