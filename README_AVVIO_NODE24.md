# Avvio EstendiFacile con Node 24

Questa versione rimuove la dipendenza nativa `sqlite3`, che su Windows con Node 24 richiedeva `node-gyp` e Python.

Il server usa ora `node:sqlite`, modulo integrato in Node 24, tramite `sqlite-node24-shim.js`.

## Comandi

```powershell
npm install
node server.js
```

Poi apri:

```text
http://localhost:3000
```

## Nota

Non serve installare Python e non serve installare Node 22.
