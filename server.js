require("dotenv").config();

const express = require("express");
const sqlite3 = require("./sqlite-node24-shim").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const QRCode = require("qrcode");

const app = express();
const db = new sqlite3.Database(process.env.DB_PATH || "./database.db");

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_JWT_SECRET = "cambia-questa-chiave-in-env";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || APP_URL;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;
const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || "admin@estendifacile.it");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Amministratore EstendiFacile";

function validateRuntimeConfig() {
  const placeholderSecrets = new Set([
    DEFAULT_JWT_SECRET,
    "metti-qui-una-chiave-lunga-e-casuale"
  ]);
  const jwtIsUnsafe = placeholderSecrets.has(JWT_SECRET) || JWT_SECRET.length < 32;

  if (process.env.NODE_ENV === "production" && jwtIsUnsafe) {
    throw new Error("JWT_SECRET deve essere impostato con una chiave lunga e casuale prima del deploy.");
  }

  if (jwtIsUnsafe) {
    console.warn("Avviso: JWT_SECRET non e' sicuro. Imposta una chiave lunga e casuale prima della messa online.");
  }

  if (STRIPE_SECRET_KEY && !STRIPE_WEBHOOK_SECRET) {
    console.warn("Avviso: STRIPE_SECRET_KEY presente ma STRIPE_WEBHOOK_SECRET mancante.");
  }

  if (process.env.NODE_ENV === "production" && (ADMIN_PASSWORD === "admin123" || ADMIN_PASSWORD.length < 12)) {
    throw new Error("ADMIN_PASSWORD non sicura. Imposta una password di almeno 12 caratteri nel file .env prima del deploy.");
  }
  if (ADMIN_PASSWORD === "admin123") {
    console.warn("Avviso: ADMIN_PASSWORD usa il valore di default. Impostane una sicura nel file .env.");
  }
}

// =========================
// MIDDLEWARE GLOBALI
// =========================
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdnjs.cloudflare.com", "https://kit.fontawesome.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://ka-f.fontawesome.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Stripe webhook deve stare prima di express.json
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send("Stripe non configurato");
    }

    let event;

    try {
      const signature = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("Errore verifica webhook Stripe:", error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const ordineId = session.metadata && session.metadata.ordine_id;

        if (ordineId) {
          await runDb(
            `UPDATE ordini
             SET stato = 'pagato',
                 stato_pagamento = 'pagato',
                 paid_at = COALESCE(paid_at, ?),
                 stripe_session_id = ?
             WHERE id = ?`,
            [new Date().toISOString(), session.id, ordineId]
          );
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Errore gestione webhook Stripe:", error.message);
      res.status(500).json({ error: "Errore gestione webhook" });
    }
  }
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Troppi tentativi. Riprova tra qualche minuto." }
});

// =========================
// CARTELLE
// =========================
const uploadDir = path.join(__dirname, "public", "uploads");
const certificatiDir = path.join(__dirname, "public", "certificati");

for (const dir of [uploadDir, certificatiDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// =========================
// HELPERS DB
// =========================
function runDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function ignoreDuplicate(nomeColonna) {
  return (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error(`Errore aggiunta ${nomeColonna}:`, err.message);
    }
  };
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function generaNumeroCertificato(ordineId) {
  const anno = new Date().getFullYear();
  const random = require("crypto").randomBytes(4).toString("hex").toUpperCase();
  return `EF-${anno}-${random}`;
}
function generaUrlVerificaCertificato(numeroCertificato) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  return `${baseUrl}/verifica-certificato.html?certificato=${encodeURIComponent(numeroCertificato)}`;
}
function parseJsonSafe(value, fallback = []) {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function normalizeVehicleText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function vehicleRuleMatches(rule, marca, modello) {
  const marcaQ = normalizeVehicleText(marca);
  const modelloQ = normalizeVehicleText(modello);
  const queryText = normalizeVehicleText(`${marca || ""} ${modello || ""}`);
  const ruleMarca = normalizeVehicleText(rule.marca);
  const ruleModello = normalizeVehicleText(rule.modello);
  const ruleText = normalizeVehicleText(`${rule.marca || ""} ${rule.modello || ""}`);

  if (!queryText || !ruleText) return false;

  const exactMarca = marcaQ && ruleMarca && marcaQ === ruleMarca;
  const exactModello = modelloQ && ruleModello && modelloQ === ruleModello;
  const queryContainsRule = ruleText.length >= 3 && queryText.includes(ruleText);
  const ruleContainsQuery = queryText.length >= 3 && ruleText.includes(queryText);
  const modelloMatchesMarca = modelloQ && ruleMarca && (modelloQ === ruleMarca || modelloQ.includes(ruleMarca) || ruleMarca.includes(modelloQ));
  const modelloMatchesModel = modelloQ && ruleModello && (modelloQ === ruleModello || modelloQ.includes(ruleModello) || ruleModello.includes(modelloQ));

  return Boolean(exactMarca || exactModello || queryContainsRule || ruleContainsQuery || modelloMatchesMarca || modelloMatchesModel);
}


function normalizeVehicleCategory(value) {
  const raw = String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  if (!raw) return "";
  if (["AUTO", "AUTOVEICOLO", "AUTOVEICOLI", "VEICOLO", "VEICOLI"].includes(raw)) return "AUTOVEICOLO";
  if (["MOTO", "MOTOVEICOLO", "MOTOVEICOLI", "MOTOCICLO", "MOTOCICLI"].includes(raw)) return "MOTOVEICOLO";
  if (["COMMERCIALE", "VEICOLO COMMERCIALE", "VEICOLI COMMERCIALI", "TRUCK", "FURGONE", "FURGONI", "LCV"].includes(raw)) return "VEICOLO COMMERCIALE";
  if (["RICREAZIONALE", "RICREAZIONALI", "VEICOLO RICREAZIONALE", "VEICOLI RICREAZIONALI", "CAMPER", "AUTOCARAVAN", "MOTORHOME"].includes(raw)) return "VEICOLO RICREAZIONALE";
  return raw;
}

function vehicleCategoryAliases(value) {
  const category = normalizeVehicleCategory(value);
  const aliases = {
    AUTOVEICOLO: ["AUTOVEICOLO", "AUTO", "VEICOLO"],
    MOTOVEICOLO: ["MOTOVEICOLO", "MOTO", "MOTOCICLO"],
    "VEICOLO COMMERCIALE": ["VEICOLO COMMERCIALE", "VEICOLI COMMERCIALI", "COMMERCIALE", "TRUCK", "FURGONE", "LCV"],
    "VEICOLO RICREAZIONALE": ["VEICOLO RICREAZIONALE", "VEICOLI RICREAZIONALI", "RICREAZIONALE", "RICREAZIONALI", "CAMPER", "AUTOCARAVAN", "MOTORHOME"]
  };
  return aliases[category] || (category ? [category] : []);
}

async function getVehicleAvailabilityForPartner(partnerId, marca, modello) {
  const queryText = normalizeVehicleText(`${marca || ""} ${modello || ""}`);
  if (!partnerId || !queryText) {
    return {
      status: "standard",
      message: "Attivabile direttamente"
    };
  }

  const rules = await allDb(
    `SELECT * FROM partner_vehicle_rules
     WHERE partner_id = ?
     ORDER BY CASE status WHEN 'non_attivabile' THEN 0 WHEN 'preventivo' THEN 1 ELSE 2 END`,
    [Number(partnerId)]
  );
  const matchedRules = rules.filter((rule) => vehicleRuleMatches(rule, marca, modello));

  if (matchedRules.some((rule) => rule.status === "non_attivabile")) {
    return {
      status: "non_attivabile",
      message: "Veicolo non attivabile per questo partner: non e' possibile procedere all'acquisto di questa soluzione."
    };
  }

  if (matchedRules.some((rule) => rule.status === "preventivo")) {
    return {
      status: "preventivo",
      message: "Veicolo attivabile solo con preventivazione partner: apri un ticket per ricevere quotazione dedicata."
    };
  }

  return {
    status: "standard",
    message: "Attivabile direttamente"
  };
}

// =========================
// EMAIL
// =========================
function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendEmail({ to, subject, html, attachments = [] }) {
  const mailer = getMailer();

  if (!mailer || !to) {
    console.log("Email non inviata: SMTP non configurato o destinatario mancante.");
    return { skipped: true };
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    attachments
  });

  return { sent: true };
}

// =========================
// UPLOAD PDF
// =========================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, "-")
      .replace(/-+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("È consentito solo il formato PDF"));
    }
    cb(null, true);
  }
});

// =========================
// SUPPLEMENTI DEFAULT
// =========================
const SUPPLEMENTI_DEFAULT = [
  { codice: "4x4_suv", nome: "4x4 o Suv" },
  { codice: "super_car", nome: "Super Car" },
  { codice: "piu_24_mesi", nome: "+ 24 mesi" },
  { codice: "gpl_metano", nome: "GPL / Metano" },
  { codice: "upgrade_auto_sostitutiva", nome: "Upgrade Auto Sostitutiva" },
  { codice: "over_8", nome: "Over 8" },
  { codice: "over_18", nome: "Over 18" },
  { codice: "kw_185_290", nome: ">185 KW, <290 KW" },
  { codice: "commerciale", nome: "Commerciale" },
  { codice: "cambio_robotizzato", nome: "Cambio Robotizzato" },
  { codice: "piu_36_mesi", nome: "+ 36 mesi" },
  { codice: "cambio_sol", nome: "Cambio Sol." },
  { codice: "full_hybrid", nome: "Full Hybrid" },
  { codice: "over_10", nome: "Over 10" },
  { codice: "buona_pratica", nome: "Buona Pratica" },
  { codice: "garanzia_infiltrazioni", nome: "Garanzia Infiltrazioni" },
  { codice: "cambio_automatico", nome: "Cambio Automatico" },
  { codice: "piu_12_mesi", nome: "+ 12 mesi" },
  { codice: "cilindrata", nome: "Cilindrata" },
  { codice: "km_aggiuntivi", nome: "Km Aggiuntivi" },
  { codice: "over_6", nome: "Over 6" },
  { codice: "over_12", nome: "Over 12" },
  { codice: "conformita", nome: "Conformità" },
  { codice: "cellula_abitativa", nome: "Cellula Abitativa" }
];

async function assicuraSupplementiPartner(partnerId) {
  if (!partnerId) throw new Error("Partner ID mancante");

  const now = new Date().toISOString();

  for (const supplemento of SUPPLEMENTI_DEFAULT) {
    await runDb(
      `INSERT OR IGNORE INTO partner_supplementi (
        partner_id, codice, nome, prezzo, attivo, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [partnerId, supplemento.codice, supplemento.nome, 0, 1, now]
    );
  }
}

// =========================
// MIGRAZIONI DB
// =========================
async function setupDatabase() {
  await runDb(`PRAGMA foreign_keys = ON`);

  await runDb(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      ruolo TEXT NOT NULL DEFAULT 'concessionario',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_azienda TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const [table, column, type] of [
    ["partners", "telefono", "TEXT"],
    ["partners", "partita_iva", "TEXT"],
    ["partners", "indirizzo", "TEXT"],
    ["partners", "citta", "TEXT"],
    ["partners", "cap", "TEXT"],
    ["partners", "provincia", "TEXT"],
    ["partners", "referente", "TEXT"]
  ]) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, ignoreDuplicate(column));
  }

  await runDb(`
    CREATE TABLE IF NOT EXISTS partner_supplementi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      codice TEXT NOT NULL,
      nome TEXT NOT NULL,
      prezzo INTEGER NOT NULL DEFAULT 0,
      attivo INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      UNIQUE(partner_id, codice),
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS partner_vehicle_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      marca TEXT NOT NULL,
      modello TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS quote_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_type TEXT NOT NULL,
      requester_id INTEGER,
      partner_id INTEGER,
      garanzia_id INTEGER,
      veicolo_tipo TEXT,
      marca TEXT,
      modello TEXT,
      targa TEXT,
      anno INTEGER,
      km INTEGER,
      stato TEXT NOT NULL DEFAULT 'aperto',
      messaggio TEXT,
      prezzo_preventivo INTEGER,
      risposta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (partner_id) REFERENCES partners(id),
      FOREIGN KEY (garanzia_id) REFERENCES garanzie(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS garanzie (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descrizione TEXT NOT NULL,
      prezzo INTEGER NOT NULL,
      durata INTEGER NOT NULL,
      copertura TEXT NOT NULL
    )
  `);

  for (const [column, type] of [
    ["partner_id", "INTEGER"],
    ["brand", "TEXT"],
    ["stato", "TEXT DEFAULT 'attiva'"],
    ["updated_at", "DATETIME"],
    ["pdf_url", "TEXT"],
    ["limiti_attivi", "INTEGER DEFAULT 0"],
    ["limite_km", "INTEGER"],
    ["limite_immatricolazione", "INTEGER"],
    ["canale_attivazione", "TEXT DEFAULT 'entrambi'"],
    ["tipo_veicolo_attivabile", "TEXT DEFAULT 'AUTOVEICOLO'"],
    ["servizio_tipo", "TEXT DEFAULT 'GARANZIA'"],
    ["created_at", "DATETIME"]
  ]) {
    db.run(`ALTER TABLE garanzie ADD COLUMN ${column} ${type}`, ignoreDuplicate(column));
  }

  await runDb(`
    CREATE TABLE IF NOT EXISTS ordini (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      prodotto_nome TEXT NOT NULL,
      prezzo INTEGER NOT NULL,
      stato TEXT NOT NULL DEFAULT 'creato',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  for (const [column, type] of [
    ["garanzia_id", "INTEGER"],
    ["quote_ticket_id", "INTEGER"],
    ["partner_id", "INTEGER"],
    ["proprietario_nome", "TEXT"],
    ["proprietario_cognome", "TEXT"],
    ["proprietario_cf", "TEXT"],
    ["proprietario_email", "TEXT"],
    ["proprietario_telefono", "TEXT"],
    ["proprietario_indirizzo", "TEXT"],
    ["proprietario_citta", "TEXT"],
    ["proprietario_cap", "TEXT"],
    ["proprietario_provincia", "TEXT"],
    ["veicolo_targa", "TEXT"],
    ["veicolo_modello", "TEXT"],
    ["veicolo_anno", "TEXT"],
    ["veicolo_km", "TEXT"],
    ["metodo_pagamento", "TEXT"],
    ["stato_pagamento", "TEXT DEFAULT 'non_pagato'"],
    ["paid_at", "DATETIME"],
    ["supplementi_json", "TEXT"],
    ["totale_supplementi", "INTEGER DEFAULT 0"],
    ["prezzo_finale", "INTEGER"],
    ["garanzia_inizio", "TEXT"],
    ["garanzia_fine", "TEXT"],
    ["garanzia_durata_mesi", "INTEGER DEFAULT 12"],
    ["numero_certificato", "TEXT"],
    ["certificato_emesso_at", "DATETIME"],
    ["certificato_pdf_url", "TEXT"],
    ["stripe_session_id", "TEXT"],
    ["updated_at", "DATETIME"]
  ]) {
    db.run(`ALTER TABLE ordini ADD COLUMN ${column} ${type}`, ignoreDuplicate(column));
  }

  await runDb(`CREATE INDEX IF NOT EXISTS idx_ordini_user_id ON ordini(user_id)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_ordini_partner_id ON ordini(partner_id)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_ordini_garanzia_id ON ordini(garanzia_id)`);

  await seedDemoData();
}

async function seedDemoData() {
  const garanzieCount = await getDb(`SELECT COUNT(*) AS count FROM garanzie`);

  if (garanzieCount.count === 0) {
    const now = new Date().toISOString();

    await runDb(
      `INSERT INTO garanzie (nome, descrizione, prezzo, durata, copertura, brand, stato, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Garanzia Base",
        "Protezione essenziale per motore, cambio e impianto elettrico.",
        29900,
        12,
        "Motore, cambio, impianto elettrico, assistenza stradale",
        "AutoProtect",
        "attiva",
        now
      ]
    );

    await runDb(
      `INSERT INTO garanzie (nome, descrizione, prezzo, durata, copertura, brand, stato, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Garanzia Premium",
        "Copertura avanzata con più componenti inclusi e servizi extra.",
        54900,
        24,
        "Motore, cambio, elettronica, climatizzazione, assistenza stradale",
        "DriveSafe",
        "attiva",
        now
      ]
    );

    await runDb(
      `INSERT INTO garanzie (nome, descrizione, prezzo, durata, copertura, brand, stato, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Garanzia Full",
        "La soluzione più completa con copertura estesa e gestione prioritaria.",
        89900,
        36,
        "Copertura completa, zero scoperti, assistenza premium",
        "TopGaranzia",
        "attiva",
        now
      ]
    );

    console.log("Garanzie demo inserite.");
  }

  await creaPartnerDemo("Partner Demo Srl", "partner@estendifacile.it", "partner123");
  await creaPartnerDemo("Second Partner Auto Srl", "partner2@estendifacile.it", "partner456");
  await creaAdminDemo(ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);

  const partnerDemo = await getDb(`SELECT id FROM partners WHERE email = ?`, ["partner@estendifacile.it"]);

  if (partnerDemo) {
    await runDb(
      `UPDATE garanzie
       SET partner_id = ?,
           brand = COALESCE(brand, 'AutoProtect'),
           stato = COALESCE(stato, 'attiva'),
           updated_at = COALESCE(updated_at, ?)
       WHERE partner_id IS NULL`,
      [partnerDemo.id, new Date().toISOString()]
    );
  }

  await runDb(`UPDATE garanzie SET canale_attivazione = COALESCE(canale_attivazione, 'entrambi'), tipo_veicolo_attivabile = COALESCE(tipo_veicolo_attivabile, 'AUTOVEICOLO'), servizio_tipo = COALESCE(servizio_tipo, 'GARANZIA')`);

  const conformita = await getDb(`SELECT id FROM garanzie WHERE servizio_tipo = 'GARANZIA_CONFORMITA' LIMIT 1`);
  if (!conformita && partnerDemo) {
    await runDb(
      `INSERT INTO garanzie (nome, descrizione, prezzo, durata, copertura, brand, stato, updated_at, partner_id, canale_attivazione, tipo_veicolo_attivabile, servizio_tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Garanzia di conformità",
        "Servizio post vendita per gestione garanzia legale di conformità e supporto documentale.",
        19900,
        12,
        "Conformità, documentazione, gestione pratica post vendita",
        "EstendiFacile",
        "attiva",
        new Date().toISOString(),
        partnerDemo.id,
        "concessionario",
        "AUTOVEICOLO",
        "GARANZIA_CONFORMITA"
      ]
    );
  }

  const partners = await allDb(`SELECT id FROM partners`);

  for (const partner of partners) {
    await assicuraSupplementiPartner(partner.id);
  }
}

async function creaPartnerDemo(nomeAzienda, email, password) {
  const existing = await getDb(`SELECT id FROM partners WHERE email = ?`, [email]);

  if (existing) {
    await assicuraSupplementiPartner(existing.id);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await runDb(
    `INSERT INTO partners (nome_azienda, email, password) VALUES (?, ?, ?)`,
    [nomeAzienda, email, passwordHash]
  );

  await assicuraSupplementiPartner(result.lastID);
  console.log(`Partner demo creato: ${email} / ${password}`);
}

async function creaAdminDemo(nome, email, password) {
  const existing = await getDb(`SELECT id, ruolo FROM users WHERE email = ?`, [email]);
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    if (existing.ruolo !== "admin" || process.env.ADMIN_PASSWORD || process.env.ADMIN_NAME) {
      await runDb(
        `UPDATE users SET nome = ?, password = ?, ruolo = ? WHERE id = ?`,
        [nome, passwordHash, "admin", existing.id]
      );
    }
    return;
  }

  await runDb(
    `INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)`,
    [nome, email, passwordHash, "admin"]
  );

  console.log(`Admin demo creato: ${email}`);
}

// =========================
// AUTH / TOKEN / RUOLI
// =========================

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return null;

  if (!authHeader.startsWith("Bearer ")) return null;

  return authHeader.split(" ")[1];
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function generaToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      ruolo: user.ruolo || "concessionario",
      tipo: "concessionario"
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function generaPrivatoToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      ruolo: "privato",
      tipo: "privato"
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function generaPartnerToken(partner) {
  return jwt.sign(
    {
      id: partner.id,
      email: partner.email,
      nome_azienda: partner.nome_azienda,
      tipo: "partner"
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function generaAdminToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nome: user.nome,
      ruolo: "admin",
      tipo: "admin"
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

// =========================
// AUTH GENERICA
// =========================

function authMiddleware(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: "Token mancante"
    });
  }

  const decoded = verifyJwt(token);

  if (!decoded) {
    return res.status(401).json({
      error: "Token non valido"
    });
  }

  req.user = decoded;

  next();
}

// =========================
// SOLO CONCESSIONARIO
// =========================

function privatoOnly(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.tipo !== "privato") {
      return res.status(403).json({
        error: "Accesso negato"
      });
    }

    next();
  });
}

function concessionarioOnly(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.tipo !== "concessionario") {
      return res.status(403).json({
        error: "Accesso negato"
      });
    }

    next();
  });
}

function buyerOnly(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.tipo !== "concessionario" && req.user.tipo !== "privato") {
      return res.status(403).json({
        error: "Accesso negato"
      });
    }

    next();
  });
}

// =========================
// SOLO PARTNER
// =========================

function partnerOnly(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.tipo !== "partner") {
      return res.status(403).json({
        error: "Accesso negato"
      });
    }

    req.partner = {
      id: req.user.id,
      email: req.user.email,
      nome_azienda: req.user.nome_azienda
    };

    next();
  });
}

// =========================
// SOLO ADMIN
// =========================

function adminOnly(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.tipo !== "admin") {
      return res.status(403).json({
        error: "Accesso negato"
      });
    }

    next();
  });
}
// =========================
// PDF CERTIFICATO
// =========================
async function generaPdfCertificato(ordine) {
  const numeroCertificato = ordine.numero_certificato || generaNumeroCertificato(ordine.id);
  const filename = `${numeroCertificato}.pdf`;
  const filePath = path.join(certificatiDir, filename);
  const publicUrl = `/certificati/${filename}`;
  const urlVerifica = generaUrlVerificaCertificato(numeroCertificato);
  let qrDataUrl = null;

  try {
    qrDataUrl = await QRCode.toDataURL(urlVerifica, { margin: 1, width: 220 });
  } catch (error) {
    console.error("Errore generazione QR certificato:", error.message);
  }

  const euro = (value) => `€ ${(Number(value || 0) / 100).toFixed(2).replace(".", ",")}`;
  const safe = (value, fallback = "-") => {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  };
  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("it-IT");
  };
  const ownerName = `${safe(ordine.proprietario_nome, "")} ${safe(ordine.proprietario_cognome, "")}`.trim() || "-";
  const garanziaNome = ordine.garanzia_nome || ordine.prodotto_nome || "Garanzia";
  const partnerNome = ordine.partner_nome || ordine.garanzia_brand || "Partner";
  const copertura = ordine.garanzia_copertura || "Motore, cambio, elettronica, climatizzazione, assistenza stradale";

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;
    const navy = "#071d49";
    const navy2 = "#0b2a5b";
    const green = "#18b45a";
    const greenDark = "#0fa34f";
    const bg = "#f4f8fc";
    const border = "#d8e4f0";
    const muted = "#64748b";
    const text = "#0b1c39";
    const softGreen = "#eafaf1";
    const white = "#ffffff";

    const x = 34;
    const y0 = 24;
    const contentW = W - 68;

    const rounded = (rx, ry, rw, rh, rr, fill, stroke = null, lineWidth = 1) => {
      doc.save();
      doc.lineWidth(lineWidth);
      doc.roundedRect(rx, ry, rw, rh, rr);
      if (fill && stroke) doc.fillAndStroke(fill, stroke);
      else if (fill) doc.fill(fill);
      else if (stroke) doc.stroke(stroke);
      doc.restore();
    };
    const small = (txt, tx, ty, w, opts = {}) => doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 7).fillColor(opts.color || muted).text(txt, tx, ty, { width: w, height: opts.height || 20, ellipsis: true, lineGap: 1 });
    const value = (label, val, tx, ty, w, opts = {}) => {
      small(String(label).toUpperCase(), tx, ty, w, { bold: true, size: 6.3, color: muted });
      doc.font("Helvetica-Bold").fontSize(opts.size || 8.4).fillColor(opts.green ? greenDark : text).text(safe(val), tx, ty + 11, { width: w, height: opts.height || 26, ellipsis: true, lineGap: 1 });
    };
    const sectionTitle = (title, tx, ty, icon = "✓") => {
      rounded(tx, ty, 22, 22, 11, softGreen);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(greenDark).text(icon, tx, ty + 6, { width: 22, align: "center" });
      doc.font("Helvetica-Bold").fontSize(9.8).fillColor(navy).text(title.toUpperCase(), tx + 31, ty + 5, { width: 190 });
    };

    doc.rect(0, 0, W, H).fill(bg);
    rounded(22, y0, W - 44, H - 48, 16, white, border, 1.2);
    doc.save().strokeColor("#a9bad0").lineWidth(1).roundedRect(28, y0 + 6, W - 56, H - 60, 10).stroke().restore();

    // Header ufficiale
    let y = 50;
    rounded(x + 4, y, 42, 42, 11, navy);
    doc.font("Helvetica-Bold").fontSize(16).fillColor(white).text("EF", x + 4, y + 13, { width: 42, align: "center" });
    doc.circle(x + 41, y + 38, 6.5).fill(green);
    doc.font("Helvetica-Bold").fontSize(23).fillColor(navy).text("Estendi", x + 58, y + 2, { continued: true });
    doc.fillColor(green).text("Facile", { continued: true });
    doc.fontSize(10).fillColor(navy).text(".it");
    doc.font("Helvetica").fontSize(8.5).fillColor(muted).text("Certificato ufficiale di garanzia", x + 59, y + 31);
    doc.moveTo(x + 246, y - 2).lineTo(x + 246, y + 54).strokeColor(border).lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(17).fillColor(navy).text("CERTIFICATO\nDI ATTIVAZIONE", x + 270, y + 0, { width: 150, lineGap: 2 });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(greenDark).text(String(garanziaNome).toUpperCase(), x + 270, y + 43, { width: 170, ellipsis: true });
    rounded(W - 155, y + 4, 110, 30, 15, softGreen, "#bfeccb");
    doc.font("Helvetica-Bold").fontSize(8).fillColor(greenDark).text("GARANZIA ATTIVA", W - 155, y + 14, { width: 110, align: "center" });
    doc.moveTo(x + 4, y + 74).lineTo(x + 42, y + 74).strokeColor(green).lineWidth(2).stroke();

    // Meta con QR
    y = 142;
    rounded(x, y, contentW, 80, 13, white, border);
    value("Numero certificato", numeroCertificato, x + 20, y + 24, 160, { size: 12 });
    value("Data emissione", new Date().toLocaleDateString("it-IT"), x + 215, y + 24, 110, { size: 11 });
    value("Stato", "Attivo", x + 360, y + 24, 90, { green: true, size: 12 });
    if (qrDataUrl) {
      doc.moveTo(x + contentW - 110, y + 14).lineTo(x + contentW - 110, y + 66).strokeColor(border).lineWidth(1).stroke();
      rounded(x + contentW - 82, y + 9, 58, 58, 8, "#f8fbff", border);
      doc.image(qrDataUrl, x + contentW - 76, y + 15, { width: 46 });
      small("VERIFICA ONLINE", x + contentW - 86, y + 68, 66, { bold: true, size: 5.4, color: muted });
    }

    const gap = 12;
    const half = (contentW - gap) / 2;
    y = 244;
    rounded(x, y, half, 142, 12, white, border);
    sectionTitle("Dati del beneficiario", x + 14, y + 16, "●");
    value("Nome e cognome", ownerName, x + 18, y + 54, 190);
    value("Codice fiscale", ordine.proprietario_cf, x + 18, y + 92, 115, { size: 8 });
    value("Telefono", ordine.proprietario_telefono, x + 150, y + 92, 90, { size: 8 });
    value("E-mail", ordine.proprietario_email, x + 18, y + 120, 130, { size: 7.5 });
    value("Indirizzo", `${safe(ordine.proprietario_indirizzo, "")} ${safe(ordine.proprietario_cap, "")} ${safe(ordine.proprietario_citta, "")}`, x + 150, y + 120, 90, { size: 7.5 });

    const rx = x + half + gap;
    rounded(rx, y, half, 142, 12, white, border);
    sectionTitle("Dati del veicolo", rx + 14, y + 16, "▣");
    value("Targa", ordine.veicolo_targa, rx + 18, y + 54, 95);
    value("Marca", String(ordine.veicolo_modello || "").split(" ")[0] || ordine.veicolo_modello, rx + 130, y + 54, 110);
    value("Telaio (VIN)", ordine.veicolo_telaio || ordine.telaio || "-", rx + 18, y + 92, 140, { size: 8 });
    value("Modello", ordine.veicolo_modello, rx + 178, y + 92, 86, { size: 8 });
    value("Anno", ordine.veicolo_anno, rx + 18, y + 120, 80, { size: 8 });
    value("Chilometraggio", ordine.veicolo_km ? `${Number(ordine.veicolo_km).toLocaleString("it-IT")} km` : "-", rx + 130, y + 120, 110, { size: 8 });

    y = 402;
    rounded(x, y, half, 130, 12, white, border);
    sectionTitle("Dati della garanzia", x + 14, y + 16, "✓");
    value("Prodotto", garanziaNome, x + 18, y + 54, 120);
    value("Partner", partnerNome, x + 150, y + 54, 105);
    value("Durata", `${safe(ordine.garanzia_durata || ordine.garanzia_durata_mesi || 12)} mesi`, x + 18, y + 92, 80);
    value("Decorrenza", formatDate(ordine.garanzia_inizio), x + 112, y + 92, 85);
    value("Scadenza", formatDate(ordine.garanzia_fine), x + 205, y + 92, 75);

    rounded(rx, y, half, 130, 12, white, border);
    sectionTitle("Coperture principali", rx + 14, y + 16, "✓");
    const coverageList = String(copertura).split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 5);
    (coverageList.length ? coverageList : ["Motore e componenti interni", "Cambio e trasmissione", "Elettronica e centraline", "Assistenza stradale"]).forEach((item, i) => {
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(greenDark).text("✓", rx + 20, y + 52 + i * 17, { width: 12 });
      doc.font("Helvetica").fontSize(7.8).fillColor(text).text(item, rx + 38, y + 52 + i * 17, { width: 135, height: 14, ellipsis: true });
    });
    doc.moveTo(rx + half - 112, y + 48).lineTo(rx + half - 112, y + 112).strokeColor(border).stroke();
    value("Supplementi inclusi", ordine.supplementi_json ? "Vedi condizioni" : "Nessuno", rx + half - 96, y + 54, 85, { size: 7.7 });
    value("Esclusioni principali", "Materiali di consumo, manutenzione ordinaria, usura", rx + half - 96, y + 88, 85, { size: 7.2, height: 34 });

    y = 548;
    rounded(x, y, contentW, 88, 12, white, border);
    sectionTitle("Validità e verifica", x + 14, y + 16, "✓");
    value("Data inizio", formatDate(ordine.garanzia_inizio), x + 18, y + 52, 90);
    value("Data fine", formatDate(ordine.garanzia_fine), x + 130, y + 52, 90);
    value("Codice verifica", numeroCertificato, x + 242, y + 52, 120);
    value("Link verifica", urlVerifica, x + 380, y + 52, 130, { size: 6.2, height: 24, green: true });

    y = 652;
    rounded(x, y, contentW, 52, 12, "#fbfdff", border);
    doc.moveTo(x + 18, y + 14).lineTo(x + 18, y + 38).strokeColor(green).lineWidth(2).stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#51627a").text(
      "Il presente documento certifica l'attivazione della garanzia secondo le condizioni contrattuali associate al prodotto acquistato. Documento generato automaticamente dalla piattaforma EstendiFacile.it e verificabile online tramite codice o QR code.",
      x + 34, y + 15, { width: contentW - 55, lineGap: 1.3 }
    );

    y = 724;
    const sigW = (contentW - 40) / 3;
    const sigs = [["FIRMA CLIENTE", ownerName], ["FIRMA PARTNER", partnerNome], ["FIRMA ESTENDIFACILE", "Documento emesso digitalmente"]];
    sigs.forEach((sig, i) => {
      const sx = x + i * (sigW + 20);
      small(sig[0], sx, y, sigW, { bold: true, color: navy2, size: 7 });
      doc.font("Helvetica-Oblique").fontSize(18).fillColor(text).text(i === 0 ? "Firma cliente" : i === 1 ? "Firma partner" : "EstendiFacile", sx + 10, y + 18, { width: sigW - 20, align: "center" });
      doc.moveTo(sx + 10, y + 45).lineTo(sx + sigW - 10, y + 45).strokeColor(green).lineWidth(1).stroke();
      small(sig[1], sx, y + 50, sigW, { color: muted, size: 6.5 });
    });

    doc.moveTo(x, H - 40).lineTo(x + contentW, H - 40).strokeColor(green).lineWidth(2).stroke();
    doc.font("Helvetica-Bold").fontSize(7.4).fillColor(navy).text("EstendiFacile.it", x, H - 28, { width: 120 });
    doc.font("Helvetica").fontSize(7).fillColor(muted).text("Piattaforma ufficiale di garanzie e servizi per la mobilità", x + 95, H - 28, { width: 210 });
    doc.font("Helvetica-Bold").fontSize(7.4).fillColor(navy).text("SICURO · TRASPARENTE · VERIFICABILE", x + 320, H - 28, { width: 200, align: "right" });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { filePath, publicUrl, numeroCertificato };
}

async function getOrdineCompletoForPartner(ordineId, partnerId) {
  return getDb(
    `SELECT
       ordini.*,
       garanzie.nome AS garanzia_nome,
       garanzie.brand AS garanzia_brand,
       garanzie.durata AS garanzia_durata,
       garanzie.copertura AS garanzia_copertura,
       garanzie.pdf_url AS garanzia_pdf_url,
       partners.nome_azienda AS partner_nome,
       partners.email AS partner_email,
       users.nome AS concessionario_nome,
       users.email AS concessionario_email
     FROM ordini
     LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
     LEFT JOIN partners ON ordini.partner_id = partners.id
     LEFT JOIN users ON ordini.user_id = users.id
     WHERE ordini.id = ? AND ordini.partner_id = ?`,
    [ordineId, partnerId]
  );
}


app.get("/api/partner/vehicle-rules", partnerOnly, async (req, res, next) => {
  try {
    const status = req.query.status;
    const params = [req.partner.id];
    let where = "partner_id = ?";
    if (status) { where += " AND status = ?"; params.push(status); }
    const rows = await allDb(`SELECT * FROM partner_vehicle_rules WHERE ${where} ORDER BY updated_at DESC, id DESC`, params);
    res.json(rows);
  } catch (error) { next(error); }
});

app.post("/api/partner/vehicle-rules", partnerOnly, async (req, res, next) => {
  try {
    const { status, marca, modello } = req.body || {};
    if (!status || !marca || !modello) return res.status(400).json({ error: "Marca, modello e tipologia regola sono obbligatori" });
    const result = await runDb(
      `INSERT INTO partner_vehicle_rules (partner_id, status, marca, modello, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [req.partner.id, status, marca.trim(), modello.trim(), new Date().toISOString()]
    );
    res.status(201).json({ id: result.lastID });
  } catch (error) { next(error); }
});

app.put("/api/partner/vehicle-rules/:id", partnerOnly, async (req, res, next) => {
  try {
    const { status, marca, modello } = req.body || {};
    if (!status || !marca || !modello) return res.status(400).json({ error: "Marca, modello e tipologia regola sono obbligatori" });
    await runDb(
      `UPDATE partner_vehicle_rules SET status = ?, marca = ?, modello = ?, updated_at = ? WHERE id = ? AND partner_id = ?`,
      [status, marca.trim(), modello.trim(), new Date().toISOString(), Number(req.params.id), req.partner.id]
    );
    res.json({ message: "Regola veicolo aggiornata" });
  } catch (error) { next(error); }
});

app.delete("/api/partner/vehicle-rules/:id", partnerOnly, async (req, res, next) => {
  try {
    await runDb(`DELETE FROM partner_vehicle_rules WHERE id = ? AND partner_id = ?`, [Number(req.params.id), req.partner.id]);
    res.json({ message: "Regola veicolo eliminata" });
  } catch (error) { next(error); }
});

app.get("/api/partner/tickets", partnerOnly, async (req, res, next) => {
  try {
    const rows = await allDb(
      `SELECT quote_tickets.*, garanzie.nome AS garanzia_nome, garanzie.brand AS garanzia_brand
       FROM quote_tickets
       LEFT JOIN garanzie ON quote_tickets.garanzia_id = garanzie.id
       WHERE quote_tickets.partner_id = ?
       ORDER BY quote_tickets.created_at DESC`,
      [req.partner.id]
    );
    res.json(rows);
  } catch (error) { next(error); }
});

app.put("/api/partner/tickets/:id", partnerOnly, async (req, res, next) => {
  try {
    const { stato, prezzo_preventivo, risposta } = req.body || {};
    await runDb(
      `UPDATE quote_tickets SET stato = ?, prezzo_preventivo = ?, risposta = ?, updated_at = ? WHERE id = ? AND partner_id = ?`,
      [stato || 'risposto', prezzo_preventivo ? Number(prezzo_preventivo) : null, risposta || '', new Date().toISOString(), Number(req.params.id), req.partner.id]
    );
    res.json({ message: "Ticket aggiornato" });
  } catch (error) { next(error); }
});

// =========================
// API GENERALI
// =========================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server attivo",
    stripe_configurato: Boolean(stripe),
    email_configurata: Boolean(getMailer())
  });
});

app.get("/api/garanzie", async (req, res, next) => {
  try {
    const { partner_id, km, anno, richiesta_tipo, veicolo_tipo, marca, modello } = req.query;
    const params = [];
    const where = ["(garanzie.stato IS NULL OR garanzie.stato != 'sospesa')"];

    if (partner_id) {
      where.push("garanzie.partner_id = ?");
      params.push(Number(partner_id));
    }

    if (km) {
      where.push("(garanzie.limiti_attivi = 0 OR garanzie.limite_km IS NULL OR garanzie.limite_km >= ?)");
      params.push(Number(km));
    }

    if (anno) {
      where.push("(garanzie.limiti_attivi = 0 OR garanzie.limite_immatricolazione IS NULL OR garanzie.limite_immatricolazione <= ?)");
      params.push(Number(anno));
    }

    if (richiesta_tipo) {
      where.push("(garanzie.canale_attivazione IS NULL OR garanzie.canale_attivazione = 'entrambi' OR garanzie.canale_attivazione = ?)");
      params.push(String(richiesta_tipo).toLowerCase());
    }

    if (veicolo_tipo) {
      const aliases = vehicleCategoryAliases(veicolo_tipo);
      if (aliases.length) {
        where.push(`(garanzie.tipo_veicolo_attivabile IS NULL OR garanzie.tipo_veicolo_attivabile = '' OR UPPER(TRIM(garanzie.tipo_veicolo_attivabile)) IN (${aliases.map(() => '?').join(',')}))`);
        params.push(...aliases);
      }
    }

    const rows = await allDb(
      `SELECT garanzie.*, partners.nome_azienda AS partner_nome
       FROM garanzie
       LEFT JOIN partners ON garanzie.partner_id = partners.id
       WHERE ${where.join(" AND ")}
       ORDER BY garanzie.prezzo ASC`,
      params
    );

    const normalizeVehicleText = (value) => String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const marcaQ = normalizeVehicleText(marca);
    const modelloQ = normalizeVehicleText(modello);
    const queryText = normalizeVehicleText(`${marca || ""} ${modello || ""}`);

    const ruleMatchesVehicle = (rule) => {
      const ruleMarca = normalizeVehicleText(rule.marca);
      const ruleModello = normalizeVehicleText(rule.modello);
      const ruleText = normalizeVehicleText(`${rule.marca || ""} ${rule.modello || ""}`);

      if (!queryText || !ruleText) return false;

      // Corrispondenza esatta o parziale su marca, modello oppure marca+modello.
      // Serve perché nel comparatore oggi l'utente può scrivere "Yamaha", "Yamaha MT-07" o solo "MT-07" nel campo modello.
      const exactMarca = marcaQ && ruleMarca && marcaQ === ruleMarca;
      const exactModello = modelloQ && ruleModello && modelloQ === ruleModello;
      const queryContainsRule = ruleText.length >= 3 && queryText.includes(ruleText);
      const ruleContainsQuery = queryText.length >= 3 && ruleText.includes(queryText);
      const modelloMatchesMarca = modelloQ && ruleMarca && (modelloQ === ruleMarca || modelloQ.includes(ruleMarca) || ruleMarca.includes(modelloQ));
      const modelloMatchesModel = modelloQ && ruleModello && (modelloQ === ruleModello || modelloQ.includes(ruleModello) || ruleModello.includes(modelloQ));

      return Boolean(exactMarca || exactModello || queryContainsRule || ruleContainsQuery || modelloMatchesMarca || modelloMatchesModel);
    };

    const enriched = [];
    for (const row of rows) {
      let availability_status = "standard";
      let availability_message = "Attivabile direttamente";
      if (row.partner_id && queryText) {
        const rules = await allDb(
          `SELECT * FROM partner_vehicle_rules
           WHERE partner_id = ?
           ORDER BY CASE status WHEN 'non_attivabile' THEN 0 WHEN 'preventivo' THEN 1 ELSE 2 END`,
          [Number(row.partner_id)]
        );
        const matchedRules = rules.filter(ruleMatchesVehicle);
        if (matchedRules.some(r => r.status === 'non_attivabile')) {
          availability_status = "non_attivabile";
          availability_message = "Veicolo non attivabile per questo partner: non è possibile procedere all'acquisto di questa soluzione.";
        } else if (matchedRules.some(r => r.status === 'preventivo')) {
          availability_status = "preventivo";
          availability_message = "Veicolo attivabile solo con preventivazione partner: apri un ticket per ricevere quotazione dedicata.";
        }
      }
      const availability = await getVehicleAvailabilityForPartner(row.partner_id, marca, modello);
      enriched.push({
        ...row,
        availability_status: availability.status,
        availability_message: availability.message
      });
    }

    res.json(enriched);
  } catch (error) {
    next(error);
  }
});


app.get("/api/quote-tickets", async (req, res, next) => {
  try {
    const requesterType = String(req.query.requester_type || "").toLowerCase();
    const params = [];
    let where = "1=1";
    if (requesterType) { where += " AND quote_tickets.requester_type = ?"; params.push(requesterType); }
    const rows = await allDb(
      `SELECT quote_tickets.*, garanzie.nome AS garanzia_nome, garanzie.brand AS garanzia_brand, garanzie.descrizione AS garanzia_descrizione, garanzie.durata AS garanzia_durata, garanzie.prezzo AS garanzia_prezzo_base, partners.nome_azienda AS partner_nome
       FROM quote_tickets
       LEFT JOIN garanzie ON quote_tickets.garanzia_id = garanzie.id
       LEFT JOIN partners ON quote_tickets.partner_id = partners.id
       WHERE ${where}
       ORDER BY quote_tickets.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (error) { next(error); }
});


app.put("/api/quote-tickets/:id/action", async (req, res, next) => {
  try {
    const action = String((req.body || {}).action || "").toLowerCase();
    if (!["accettato", "rifiutato", "chiuso"].includes(action)) {
      return res.status(400).json({ error: "Azione ticket non valida" });
    }
    const stato = action === "accettato" ? "accettato" : "rifiutato";
    await runDb(
      `UPDATE quote_tickets SET stato = ?, updated_at = ? WHERE id = ?`,
      [stato, new Date().toISOString(), Number(req.params.id)]
    );
    const ticket = await getDb(
      `SELECT quote_tickets.*, garanzie.nome AS garanzia_nome, garanzie.brand AS garanzia_brand, garanzie.descrizione AS garanzia_descrizione, garanzie.durata AS garanzia_durata, garanzie.prezzo AS garanzia_prezzo_base, partners.nome_azienda AS partner_nome
       FROM quote_tickets
       LEFT JOIN garanzie ON quote_tickets.garanzia_id = garanzie.id
       LEFT JOIN partners ON quote_tickets.partner_id = partners.id
       WHERE quote_tickets.id = ?`,
      [Number(req.params.id)]
    );
    res.json({ message: stato === "accettato" ? "Preventivo accettato" : "Ticket rifiutato e chiuso", ticket });
  } catch (error) { next(error); }
});

app.post("/api/quote-tickets", async (req, res, next) => {
  try {
    const { requester_type, partner_id, garanzia_id, veicolo_tipo, marca, modello, targa, anno, km, messaggio } = req.body || {};
    if (!partner_id || !modello || !targa) return res.status(400).json({ error: "Dati ticket mancanti" });
    const result = await runDb(
      `INSERT INTO quote_tickets (requester_type, requester_id, partner_id, garanzia_id, veicolo_tipo, marca, modello, targa, anno, km, messaggio, stato, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aperto', ?)`,
      [requester_type || 'concessionario', null, Number(partner_id), garanzia_id ? Number(garanzia_id) : null, veicolo_tipo || '', marca || '', modello || '', targa || '', anno ? Number(anno) : null, km ? Number(km) : null, messaggio || '', new Date().toISOString()]
    );
    res.status(201).json({ id: result.lastID, message: "Ticket preventivo aperto correttamente" });
  } catch (error) { next(error); }
});

app.get("/api/supplementi/partner/:partnerId", async (req, res, next) => {
  try {
    const rows = await allDb(
      `SELECT id, partner_id, codice, nome, prezzo, attivo
       FROM partner_supplementi
       WHERE partner_id = ? AND attivo = 1
       ORDER BY id ASC`,
      [Number(req.params.partnerId)]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});


app.get("/api/verifica-certificato/:numero", async (req, res, next) => {
  try {
    const numero = String(req.params.numero || "").trim().toUpperCase();

    if (!numero || !/^EF-\d{4}-\d{6}$/.test(numero)) {
      return res.status(400).json({ valido: false, error: "Numero certificato non valido" });
    }

    const ordine = await getDb(
      `SELECT
         ordini.id,
         ordini.stato,
         ordini.stato_pagamento,
         ordini.numero_certificato,
         ordini.certificato_emesso_at,
         ordini.certificato_pdf_url,
         ordini.garanzia_inizio,
         ordini.garanzia_fine,
         ordini.veicolo_targa,
         ordini.veicolo_modello,
         ordini.veicolo_anno,
         garanzie.nome AS garanzia_nome,
         garanzie.brand AS garanzia_brand,
         garanzie.durata AS garanzia_durata,
         partners.nome_azienda AS partner_nome
       FROM ordini
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       LEFT JOIN partners ON ordini.partner_id = partners.id
       WHERE ordini.numero_certificato = ?
       LIMIT 1`,
      [numero]
    );

    if (!ordine) {
      return res.status(404).json({ valido: false, error: "Certificato non trovato" });
    }

    const oggi = new Date();
    const fineGaranzia = ordine.garanzia_fine ? new Date(ordine.garanzia_fine) : null;
    const scaduto = Boolean(fineGaranzia && !Number.isNaN(fineGaranzia.getTime()) && fineGaranzia < oggi);
    const valido = ordine.stato_pagamento === "pagato" && Boolean(ordine.certificato_emesso_at) && !scaduto;

    res.json({
      valido,
      scaduto,
      stato: ordine.stato,
      numero_certificato: ordine.numero_certificato,
      certificato_emesso_at: ordine.certificato_emesso_at,
      certificato_pdf_url: ordine.certificato_pdf_url,
      garanzia: {
        nome: ordine.garanzia_nome,
        brand: ordine.garanzia_brand,
        durata_mesi: ordine.garanzia_durata,
        inizio: ordine.garanzia_inizio,
        fine: ordine.garanzia_fine
      },
      veicolo: {
        targa: ordine.veicolo_targa,
        modello: ordine.veicolo_modello,
        anno: ordine.veicolo_anno
      },
      partner: {
        nome: ordine.partner_nome
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================
// AUTH CONCESSIONARIO
// =========================
app.post("/api/register", authLimiter, async (req, res, next) => {
  try {
    const { nome, email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!nome || !emailNorm || !password) {
      return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
    }

    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    if (String(password).length < 10) {
      return res.status(400).json({ error: "La password deve avere almeno 10 caratteri" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await runDb(
      `INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)`,
      [String(nome).trim(), emailNorm, passwordHash, "concessionario"]
    );

    const user = { id: result.lastID, nome: String(nome).trim(), email: emailNorm, ruolo: "concessionario" };
    const token = generaToken(user);

    res.json({ message: "Registrazione completata", token, user });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Registrazione non completata. Verifica i dati inseriti." });
    }
    next(error);
  }
});

app.post("/api/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: "Email e password obbligatorie" });
    }

    const user = await getDb(
      `SELECT * FROM users WHERE email = ? AND ruolo = ?`,
      [emailNorm, "concessionario"]
    );

    if (!user) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const token = generaToken(user);

    res.json({
      message: "Login effettuato",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        ruolo: user.ruolo
      }
    });
  } catch (error) {
    next(error);
  }
});
// =========================
// AUTH PRIVATI
// =========================
app.post("/api/privati/register", authLimiter, async (req, res, next) => {
  try {
    const { nome, email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!nome || !emailNorm || !password) {
      return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
    }

    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    if (String(password).length < 10) {
      return res.status(400).json({ error: "La password deve avere almeno 10 caratteri" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await runDb(
      `INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)`,
      [String(nome).trim(), emailNorm, passwordHash, "privato"]
    );

    const user = {
      id: result.lastID,
      nome: String(nome).trim(),
      email: emailNorm,
      ruolo: "privato"
    };

    const token = generaPrivatoToken(user);

    res.json({
      message: "Registrazione privato completata",
      token,
      user
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Registrazione non completata. Verifica i dati inseriti." });
    }

    next(error);
  }
});

app.post("/api/privati/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: "Email e password obbligatorie" });
    }

    const user = await getDb(
      `SELECT * FROM users WHERE email = ? AND ruolo = ?`,
      [emailNorm, "privato"]
    );

    if (!user) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const token = generaPrivatoToken(user);

    res.json({
      message: "Login privato effettuato",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        ruolo: user.ruolo
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/privati/me", privatoOnly, async (req, res, next) => {
  try {
    const user = await getDb(
      `SELECT id, nome, email, ruolo, created_at FROM users WHERE id = ? AND ruolo = ?`,
      [req.user.id, "privato"]
    );

    if (!user) {
      return res.status(404).json({ error: "Utente privato non trovato" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// =========================
// AUTH / DASHBOARD ADMIN
// =========================
app.post("/api/admin/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: "Email e password obbligatorie" });
    }

    const admin = await getDb(
      `SELECT * FROM users WHERE email = ? AND ruolo = ?`,
      [emailNorm, "admin"]
    );

    if (!admin) {
      return res.status(401).json({ error: "Credenziali amministratore non valide" });
    }

    const passwordValida = await bcrypt.compare(password, admin.password);

    if (!passwordValida) {
      return res.status(401).json({ error: "Credenziali amministratore non valide" });
    }

    const token = generaAdminToken(admin);

    res.json({
      message: "Login amministratore effettuato",
      token,
      admin: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        ruolo: admin.ruolo
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/dashboard", adminOnly, async (req, res, next) => {
  try {
    const ordiniStats = await getDb(
      `SELECT
         COUNT(*) AS totale_ordini,
         SUM(CASE WHEN stato_pagamento = 'pagato' THEN 1 ELSE 0 END) AS richieste_buon_fine,
         SUM(CASE WHEN stato_pagamento != 'pagato' OR stato_pagamento IS NULL THEN 1 ELSE 0 END) AS richieste_preventivo,
         SUM(CASE WHEN numero_certificato IS NOT NULL AND numero_certificato != '' THEN 1 ELSE 0 END) AS certificati_generati,
         COALESCE(SUM(CASE WHEN stato_pagamento = 'pagato' THEN COALESCE(prezzo_finale, prezzo) ELSE 0 END), 0) AS fatturato_complessivo
       FROM ordini`
    );

    const garanzieStats = await getDb(
      `SELECT
         COUNT(*) AS garanzie_caricate,
         SUM(CASE WHEN stato IS NULL OR stato = 'attiva' THEN 1 ELSE 0 END) AS garanzie_attive,
         SUM(CASE WHEN pdf_url IS NOT NULL AND pdf_url != '' THEN 1 ELSE 0 END) AS garanzie_con_pdf,
         SUM(CASE WHEN stato = 'sospesa' THEN 1 ELSE 0 END) AS garanzie_sospese,
         SUM(CASE WHEN stato = 'bozza' THEN 1 ELSE 0 END) AS garanzie_bozza
       FROM garanzie`
    );

    const utentiStats = await getDb(
      `SELECT
         SUM(CASE WHEN ruolo = 'concessionario' THEN 1 ELSE 0 END) AS concessionari,
         SUM(CASE WHEN ruolo = 'privato' THEN 1 ELSE 0 END) AS privati,
         SUM(CASE WHEN ruolo = 'admin' THEN 1 ELSE 0 END) AS amministratori,
         SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS utenti_ultimi_30
       FROM users`
    );

    const partnerStats = await getDb(
      `SELECT
         COUNT(*) AS partner,
         SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS partner_ultimi_30
       FROM partners`
    );

    const garanziaPiuScelta = await getDb(
      `SELECT
         COALESCE(garanzie.nome, ordini.prodotto_nome) AS nome,
         garanzie.brand AS brand,
         COUNT(ordini.id) AS totale,
         COALESCE(SUM(COALESCE(ordini.prezzo_finale, ordini.prezzo)), 0) AS valore
       FROM ordini
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       GROUP BY ordini.garanzia_id, COALESCE(garanzie.nome, ordini.prodotto_nome), garanzie.brand
       ORDER BY totale DESC, valore DESC
       LIMIT 1`
    );

    const autoPiuAttivata = await getDb(
      `SELECT
         COALESCE(NULLIF(TRIM(veicolo_modello), ''), 'Non indicata') AS modello,
         COUNT(*) AS totale
       FROM ordini
       WHERE stato_pagamento = 'pagato'
       GROUP BY COALESCE(NULLIF(TRIM(veicolo_modello), ''), 'Non indicata')
       ORDER BY totale DESC
       LIMIT 1`
    );

    const concessionarioPiuAttivo = await getDb(
      `SELECT
         users.nome,
         users.email,
         COUNT(ordini.id) AS totale_ordini,
         COALESCE(SUM(CASE WHEN ordini.stato_pagamento = 'pagato' THEN COALESCE(ordini.prezzo_finale, ordini.prezzo) ELSE 0 END), 0) AS fatturato
       FROM ordini
       LEFT JOIN users ON ordini.user_id = users.id
       GROUP BY users.id, users.nome, users.email
       ORDER BY totale_ordini DESC, fatturato DESC
       LIMIT 1`
    );

    const andamentoMensile = await allDb(
      `SELECT
         strftime('%Y-%m', created_at) AS mese,
         COUNT(*) AS richieste,
         SUM(CASE WHEN stato_pagamento = 'pagato' THEN 1 ELSE 0 END) AS buon_fine,
         COALESCE(SUM(CASE WHEN stato_pagamento = 'pagato' THEN COALESCE(prezzo_finale, prezzo) ELSE 0 END), 0) AS fatturato
       FROM ordini
       WHERE created_at >= date('now', '-12 months')
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY mese ASC`
    );

    const ordiniPerStato = await allDb(
      `SELECT
         COALESCE(stato_pagamento, 'non_pagato') AS stato,
         COUNT(*) AS totale
       FROM ordini
       GROUP BY COALESCE(stato_pagamento, 'non_pagato')
       ORDER BY totale DESC`
    );

    const garanziePerPartner = await allDb(
      `SELECT
         COALESCE(partners.nome_azienda, 'Senza partner') AS partner,
         COUNT(garanzie.id) AS totale
       FROM garanzie
       LEFT JOIN partners ON garanzie.partner_id = partners.id
       GROUP BY COALESCE(partners.nome_azienda, 'Senza partner')
       ORDER BY totale DESC
       LIMIT 8`
    );

    const topGaranzie = await allDb(
      `SELECT
         COALESCE(garanzie.nome, ordini.prodotto_nome) AS nome,
         garanzie.brand AS brand,
         COUNT(ordini.id) AS totale
       FROM ordini
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       GROUP BY ordini.garanzia_id, COALESCE(garanzie.nome, ordini.prodotto_nome), garanzie.brand
       ORDER BY totale DESC
       LIMIT 6`
    );

    const topAuto = await allDb(
      `SELECT
         COALESCE(NULLIF(TRIM(veicolo_modello), ''), 'Non indicata') AS modello,
         COUNT(*) AS totale
       FROM ordini
       WHERE stato_pagamento = 'pagato'
       GROUP BY COALESCE(NULLIF(TRIM(veicolo_modello), ''), 'Non indicata')
       ORDER BY totale DESC
       LIMIT 6`
    );

    const ordiniRecenti = await allDb(
      `SELECT
         ordini.id,
         ordini.created_at,
         ordini.stato,
         ordini.stato_pagamento,
         ordini.prezzo_finale,
         ordini.prodotto_nome,
         ordini.veicolo_targa,
         ordini.veicolo_modello,
         ordini.numero_certificato,
         users.nome AS concessionario_nome,
         partners.nome_azienda AS partner_nome,
         garanzie.nome AS garanzia_nome
       FROM ordini
       LEFT JOIN users ON ordini.user_id = users.id
       LEFT JOIN partners ON ordini.partner_id = partners.id
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       ORDER BY ordini.created_at DESC
       LIMIT 10`
    );

    const garanzieRecenti = await allDb(
      `SELECT
         garanzie.id,
         garanzie.nome,
         garanzie.brand,
         garanzie.stato,
         garanzie.prezzo,
         garanzie.durata,
         garanzie.pdf_url,
         garanzie.updated_at,
         partners.nome_azienda AS partner_nome
       FROM garanzie
       LEFT JOIN partners ON garanzie.partner_id = partners.id
       ORDER BY COALESCE(garanzie.updated_at, garanzie.created_at, '') DESC, garanzie.id DESC
       LIMIT 10`
    );

    const utentiRecenti = await allDb(
      `SELECT nome, email, ruolo AS tipo, created_at
       FROM users
       WHERE ruolo != 'admin'
       UNION ALL
       SELECT nome_azienda AS nome, email, 'partner' AS tipo, created_at
       FROM partners
       ORDER BY created_at DESC
       LIMIT 10`
    );

    res.json({
      admin: {
        nome: req.user.nome,
        email: req.user.email
      },
      kpi: {
        richieste_preventivo: Number(ordiniStats.richieste_preventivo || 0),
        richieste_buon_fine: Number(ordiniStats.richieste_buon_fine || 0),
        fatturato_complessivo: Number(ordiniStats.fatturato_complessivo || 0),
        garanzie_attive: Number(garanzieStats.garanzie_attive || 0),
        garanzie_caricate: Number(garanzieStats.garanzie_caricate || 0),
        certificati_generati: Number(ordiniStats.certificati_generati || 0),
        nuovi_iscritti: Number(utentiStats.utenti_ultimi_30 || 0) + Number(partnerStats.partner_ultimi_30 || 0),
        partner: Number(partnerStats.partner || 0),
        concessionari: Number(utentiStats.concessionari || 0),
        privati: Number(utentiStats.privati || 0)
      },
      evidenze: {
        garanzia_piu_scelta: garanziaPiuScelta || null,
        auto_piu_attivata: autoPiuAttivata || null,
        concessionario_piu_attivo: concessionarioPiuAttivo || null
      },
      flussi: {
        totale_ordini: Number(ordiniStats.totale_ordini || 0),
        caricamenti_garanzie: Number(garanzieStats.garanzie_caricate || 0),
        caricamenti_con_pdf: Number(garanzieStats.garanzie_con_pdf || 0),
        garanzie_bozza: Number(garanzieStats.garanzie_bozza || 0),
        garanzie_sospese: Number(garanzieStats.garanzie_sospese || 0),
        richieste_preventivo: Number(ordiniStats.richieste_preventivo || 0),
        richieste_buon_fine: Number(ordiniStats.richieste_buon_fine || 0)
      },
      charts: {
        andamento_mensile: andamentoMensile,
        ordini_per_stato: ordiniPerStato,
        garanzie_per_partner: garanziePerPartner,
        top_garanzie: topGaranzie,
        top_auto: topAuto
      },
      liste: {
        ordini_recenti: ordiniRecenti,
        garanzie_recenti: garanzieRecenti,
        utenti_recenti: utentiRecenti
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", concessionarioOnly, async (req, res, next) => {
  try {
    const user = await getDb(
      `SELECT id, nome, email, ruolo, created_at FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ error: "Utente non trovato" });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// =========================
// ORDINI CONCESSIONARIO
// =========================
app.post("/api/ordini", buyerOnly, async (req, res, next) => {
  try {
    const {
      prodotto_nome,
      prezzo,
      garanzia_id,
      quote_ticket_id,
      partner_id,
      proprietario_nome,
      proprietario_cognome,
      proprietario_cf,
      proprietario_email,
      proprietario_telefono,
      proprietario_indirizzo,
      proprietario_citta,
      proprietario_cap,
      proprietario_provincia,
      veicolo_targa,
      veicolo_modello,
      veicolo_anno,
      veicolo_km,
      metodo_pagamento,
      stato_pagamento,
      supplementi_json,
      totale_supplementi,
      prezzo_finale,
      garanzia_inizio,
      garanzia_fine,
      garanzia_durata_mesi
    } = req.body;

    if (!prodotto_nome || !prezzo || !garanzia_id || !partner_id) {
      return res.status(400).json({ error: "Dati ordine mancanti" });
    }

    if (!proprietario_nome || !proprietario_cognome || !proprietario_cf || !proprietario_email) {
      return res.status(400).json({ error: "Dati proprietario mancanti" });
    }

    if (!isValidEmail(proprietario_email)) {
      return res.status(400).json({ error: "Email proprietario non valida" });
    }

    const garanzia = await getDb(
      `SELECT * FROM garanzie 
       WHERE id = ? 
       AND partner_id = ? 
       AND (stato IS NULL OR stato != 'sospesa')`,
      [Number(garanzia_id), Number(partner_id)]
    );

    if (!garanzia) {
      return res.status(404).json({ error: "Garanzia non trovata o non disponibile" });
    }

    const kmVeicolo = Number(veicolo_km || 0);
    const annoVeicolo = Number(veicolo_anno || 0);

    if (Number(garanzia.limiti_attivi || 0) === 1) {
      if (garanzia.limite_km && kmVeicolo > Number(garanzia.limite_km)) {
        return res.status(400).json({ error: "Il veicolo supera il limite km della garanzia" });
      }

      if (garanzia.limite_immatricolazione && annoVeicolo < Number(garanzia.limite_immatricolazione)) {
        return res.status(400).json({ error: "Il veicolo non rispetta il limite di immatricolazione della garanzia" });
      }
    }

    const totaleSupplementiFinale = Number(totale_supplementi || 0);
    let prezzoBaseOrdine = Number(prezzo);
    let prezzoFinaleFinale = Number(prezzo_finale || prezzoBaseOrdine + totaleSupplementiFinale);
    let acceptedQuoteTicket = null;
    const availability = await getVehicleAvailabilityForPartner(partner_id, veicolo_modello, veicolo_modello);

    if (availability.status === "non_attivabile") {
      return res.status(400).json({ error: "Veicolo non attivabile per questa garanzia" });
    }

    if (availability.status === "preventivo") {
      const ticketId = Number(quote_ticket_id || 0);
      if (!ticketId) {
        return res.status(400).json({ error: "Per questo veicolo serve un preventivo partner accettato" });
      }

      const ticket = await getDb(
        `SELECT * FROM quote_tickets
         WHERE id = ? AND partner_id = ? AND garanzia_id = ?`,
        [ticketId, Number(partner_id), Number(garanzia_id)]
      );

      const ticketTarga = String(ticket?.targa || "").toUpperCase().trim();
      const orderTarga = String(veicolo_targa || "").toUpperCase().trim();
      const ticketRequester = String(ticket?.requester_type || "").toLowerCase();
      const prezzoPreventivo = Number(ticket?.prezzo_preventivo || 0);

      if (
        !ticket ||
        String(ticket.stato || "").toLowerCase() !== "accettato" ||
        prezzoPreventivo <= 0 ||
        (ticketRequester && ticketRequester !== req.user.tipo) ||
        (ticketTarga && orderTarga && ticketTarga !== orderTarga)
      ) {
        return res.status(400).json({ error: "Preventivo non valido o non accettato per questo acquisto" });
      }

      prezzoBaseOrdine = prezzoPreventivo;
      acceptedQuoteTicket = ticket;

      if (Number(prezzo) !== prezzoBaseOrdine) {
        return res.status(400).json({ error: "Prezzo preventivo non coerente con il ticket accettato" });
      }
    } else if (Number(prezzo) !== Number(garanzia.prezzo)) {
      return res.status(400).json({ error: "Prezzo garanzia non coerente con il catalogo partner" });
    }

    if (prezzoFinaleFinale < prezzoBaseOrdine + totaleSupplementiFinale) {
      return res.status(400).json({ error: "Totale ordine non coerente con garanzia e supplementi" });
    }

    const metodoPagamentoFinale = metodo_pagamento || "simulato";
    const statoPagamentoFinale =
      stato_pagamento || (metodoPagamentoFinale === "bonifico" ? "in_attesa" : "pagato");

    const statoOrdineFinale =
      statoPagamentoFinale === "pagato" ? "pagato" : "creato";

    const paidAt =
      statoPagamentoFinale === "pagato" ? new Date().toISOString() : null;

    const supplementiFinali =
      typeof supplementi_json === "string"
        ? supplementi_json
        : JSON.stringify(supplementi_json || []);

    const result = await runDb(
      `INSERT INTO ordini (
        user_id,
        prodotto_nome,
        prezzo,
        garanzia_id,
        quote_ticket_id,
        partner_id,
        stato,
        proprietario_nome,
        proprietario_cognome,
        proprietario_cf,
        proprietario_email,
        proprietario_telefono,
        proprietario_indirizzo,
        proprietario_citta,
        proprietario_cap,
        proprietario_provincia,
        veicolo_targa,
        veicolo_modello,
        veicolo_anno,
        veicolo_km,
        metodo_pagamento,
        stato_pagamento,
        paid_at,
        supplementi_json,
        totale_supplementi,
        prezzo_finale,
        garanzia_inizio,
        garanzia_fine,
        garanzia_durata_mesi,
        numero_certificato,
        certificato_emesso_at,
        certificato_pdf_url,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        prodotto_nome,
        prezzoBaseOrdine,
        Number(garanzia_id),
        acceptedQuoteTicket ? acceptedQuoteTicket.id : null,
        Number(partner_id),
        statoOrdineFinale,

        proprietario_nome,
        proprietario_cognome,
        String(proprietario_cf || "").toUpperCase().trim(),
        normalizeEmail(proprietario_email),
        proprietario_telefono || "",
        proprietario_indirizzo || "",
        proprietario_citta || "",
        onlyDigits(proprietario_cap),
        String(proprietario_provincia || "").toUpperCase().trim(),

        String(veicolo_targa || "").toUpperCase().trim(),
        veicolo_modello || "",
        veicolo_anno || "",
        veicolo_km || "",

        metodoPagamentoFinale,
        statoPagamentoFinale,
        paidAt,

        supplementiFinali,
        totaleSupplementiFinale,
        prezzoFinaleFinale,

        garanzia_inizio || "",
        garanzia_fine || "",
        Number(garanzia_durata_mesi || garanzia.durata || 12),

        null,
        null,
        null,

        new Date().toISOString()
      ]
    );

    const partner = await getDb(
      `SELECT nome_azienda, email FROM partners WHERE id = ?`,
      [Number(partner_id)]
    );

    const concessionario = await getDb(
      `SELECT nome, email FROM users WHERE id = ?`,
      [req.user.id]
    );

    const richiedenteLabel = req.user.tipo === "privato" ? "Privato" : "Concessionario";

    await sendEmail({
      to: partner?.email,
      subject: `Nuovo ordine ricevuto - ${prodotto_nome}`,
      html: `
        <h2>Nuovo ordine ricevuto</h2>
        <p>Un ${richiedenteLabel.toLowerCase()} ha acquistato una tua garanzia su EstendiFacile.it.</p>
        <p><strong>Ordine:</strong> #${result.lastID}</p>
        <p><strong>Garanzia:</strong> ${prodotto_nome}</p>
        <p><strong>Cliente:</strong> ${proprietario_nome} ${proprietario_cognome}</p>
        <p><strong>Veicolo:</strong> ${veicolo_modello || "-"} - ${veicolo_targa || "-"}</p>
        <p><strong>Totale:</strong> € ${(prezzoFinaleFinale / 100).toFixed(2)}</p>
        <p><strong>${richiedenteLabel}:</strong> ${concessionario?.nome || "-"} - ${concessionario?.email || "-"}</p>
        <p>Accedi alla tua area partner per vedere il dettaglio ed emettere il certificato.</p>
      `
    });

    res.json({
      message: "Ordine creato",
      ordineId: result.lastID,
      garanzia_id: Number(garanzia_id),
      quote_ticket_id: acceptedQuoteTicket ? acceptedQuoteTicket.id : null,
      partner_id: Number(partner_id),
      stato: statoOrdineFinale,
      metodo_pagamento: metodoPagamentoFinale,
      stato_pagamento: statoPagamentoFinale,
      paid_at: paidAt,
      totale_supplementi: totaleSupplementiFinale,
      prezzo_finale: prezzoFinaleFinale,
      numero_certificato: null,
      certificato_pdf_url: null
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/miei-ordini", buyerOnly, async (req, res, next) => {
  try {
    const rows = await allDb(
      `SELECT
         ordini.*,
         garanzie.nome AS garanzia_nome,
         garanzie.brand AS garanzia_brand,
         garanzie.durata AS garanzia_durata,
         garanzie.copertura AS garanzia_copertura,
         garanzie.pdf_url AS garanzia_pdf_url,
         partners.nome_azienda AS partner_nome,
         partners.email AS partner_email
       FROM ordini
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       LEFT JOIN partners ON ordini.partner_id = partners.id
       WHERE ordini.user_id = ?
       ORDER BY ordini.created_at DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/ordini/:id", buyerOnly, async (req, res, next) => {
  try {
    const ordine = await getDb(
      `SELECT
         ordini.*,
         garanzie.nome AS garanzia_nome,
         garanzie.brand AS garanzia_brand,
         garanzie.durata AS garanzia_durata,
         garanzie.copertura AS garanzia_copertura,
         garanzie.pdf_url AS garanzia_pdf_url,
         partners.nome_azienda AS partner_nome,
         partners.email AS partner_email
       FROM ordini
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       LEFT JOIN partners ON ordini.partner_id = partners.id
       WHERE ordini.id = ? AND ordini.user_id = ?`,
      [Number(req.params.id), req.user.id]
    );

    if (!ordine) return res.status(404).json({ error: "Ordine non trovato" });

    res.json(ordine);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", concessionarioOnly, async (req, res, next) => {
  try {
    const stats = await getDb(
      `SELECT
         COUNT(*) AS totale_ordini,
         SUM(CASE WHEN stato_pagamento = 'pagato' THEN 1 ELSE 0 END) AS ordini_pagati,
         SUM(CASE WHEN stato_pagamento != 'pagato' OR stato_pagamento IS NULL THEN 1 ELSE 0 END) AS ordini_non_pagati,
         COALESCE(SUM(prezzo_finale), 0) AS totale_venduto
       FROM ordini
       WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({
      totale_ordini: stats.totale_ordini || 0,
      ordini_pagati: stats.ordini_pagati || 0,
      ordini_non_pagati: stats.ordini_non_pagati || 0,
      totale_venduto: stats.totale_venduto || 0
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/ordini/:id/checkout", buyerOnly, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: "Stripe non configurato" });
    }

    const ordine = await getDb(
      `SELECT * FROM ordini WHERE id = ? AND user_id = ?`,
      [Number(req.params.id), req.user.id]
    );

    if (!ordine) return res.status(404).json({ error: "Ordine non trovato" });
    if (ordine.stato_pagamento === "pagato") return res.status(400).json({ error: "Ordine già pagato" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: ordine.prodotto_nome },
            unit_amount: Number(ordine.prezzo_finale || ordine.prezzo)
          },
          quantity: 1
        }
      ],
      success_url: `${FRONTEND_URL}/success.html?ordine=${ordine.id}`,
      cancel_url: `${FRONTEND_URL}/cancel.html?ordine=${ordine.id}`,
      metadata: { ordine_id: String(ordine.id) }
    });

    await runDb(`UPDATE ordini SET stripe_session_id = ?, updated_at = ? WHERE id = ?`, [
      session.id,
      new Date().toISOString(),
      ordine.id
    ]);

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (error) {
    next(error);
  }
});

// =========================
// AUTH PARTNER
// =========================
app.post("/api/partner/register", authLimiter, async (req, res, next) => {
  try {
    const { nome_azienda, email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!nome_azienda || !emailNorm || !password) {
      return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
    }

    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ error: "Email non valida" });
    }

    if (String(password).length < 10) {
      return res.status(400).json({ error: "La password deve avere almeno 10 caratteri" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await runDb(
      `INSERT INTO partners (nome_azienda, email, password) VALUES (?, ?, ?)`,
      [String(nome_azienda).trim(), emailNorm, passwordHash]
    );

    await assicuraSupplementiPartner(result.lastID);

    const partner = { id: result.lastID, nome_azienda: String(nome_azienda).trim(), email: emailNorm };
    const token = generaPartnerToken(partner);

    res.json({ message: "Registrazione partner completata", token, partner });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Email partner già registrata" });
    }
    next(error);
  }
});

app.post("/api/partner/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: "Email e password obbligatorie" });
    }

    const partner = await getDb(`SELECT * FROM partners WHERE email = ?`, [emailNorm]);

    if (!partner) {
      return res.status(401).json({ error: "Credenziali partner non valide" });
    }

    const passwordValida = await bcrypt.compare(password, partner.password);

    if (!passwordValida) {
      return res.status(401).json({ error: "Credenziali partner non valide" });
    }

    await assicuraSupplementiPartner(partner.id);

    const token = generaPartnerToken(partner);

    res.json({
      message: "Login partner effettuato",
      token,
      partner: {
        id: partner.id,
        nome_azienda: partner.nome_azienda,
        email: partner.email
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/partner/me", partnerOnly, async (req, res, next) => {
  try {
    const partner = await getDb(
      `SELECT id, nome_azienda, email, telefono, partita_iva, indirizzo, citta, cap, provincia, referente, created_at
       FROM partners
       WHERE id = ?`,
      [req.partner.id]
    );

    if (!partner) return res.status(404).json({ error: "Partner non trovato" });

    res.json(partner);
  } catch (error) {
    next(error);
  }
});

app.put("/api/partner/profilo", partnerOnly, async (req, res, next) => {
  try {
    const { nome_azienda, telefono, partita_iva, indirizzo, citta, cap, provincia, referente } = req.body;

    if (!nome_azienda) {
      return res.status(400).json({ error: "La ragione sociale è obbligatoria" });
    }

    await runDb(
      `UPDATE partners
       SET nome_azienda = ?, telefono = ?, partita_iva = ?, indirizzo = ?, citta = ?, cap = ?, provincia = ?, referente = ?
       WHERE id = ?`,
      [
        nome_azienda,
        telefono || "",
        partita_iva || "",
        indirizzo || "",
        citta || "",
        onlyDigits(cap),
        String(provincia || "").toUpperCase().trim(),
        referente || "",
        req.partner.id
      ]
    );

    res.json({ message: "Profilo partner aggiornato con successo" });
  } catch (error) {
    next(error);
  }
});

// =========================
// ORDINI PARTNER
// =========================
app.get("/api/partner/ordini", partnerOnly, async (req, res, next) => {
  try {
    const rows = await allDb(
      `SELECT
         ordini.*,
         garanzie.nome AS garanzia_nome,
         garanzie.brand AS garanzia_brand,
         garanzie.durata AS garanzia_durata,
         garanzie.copertura AS garanzia_copertura,
         users.nome AS concessionario_nome,
         users.email AS concessionario_email
       FROM ordini
       LEFT JOIN garanzie ON ordini.garanzia_id = garanzie.id
       LEFT JOIN users ON ordini.user_id = users.id
       WHERE ordini.partner_id = ?
       ORDER BY ordini.created_at DESC`,
      [req.partner.id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/partner/ordini/:id", partnerOnly, async (req, res, next) => {
  try {
    const ordine = await getOrdineCompletoForPartner(Number(req.params.id), req.partner.id);

    if (!ordine) return res.status(404).json({ error: "Ordine non trovato o non autorizzato" });

    res.json(ordine);
  } catch (error) {
    next(error);
  }
});

app.post("/api/partner/ordini/:id/emetti-certificato", partnerOnly, async (req, res, next) => {
  try {
    const ordineId = Number(req.params.id);
    const ordine = await getOrdineCompletoForPartner(ordineId, req.partner.id);

    if (!ordine) return res.status(404).json({ error: "Ordine non trovato o non autorizzato" });
    if (ordine.stato_pagamento !== "pagato") {
      return res.status(400).json({ error: "Il certificato può essere emesso solo per ordini pagati" });
    }

    const numeroCertificato = ordine.numero_certificato || generaNumeroCertificato(ordine.id);
    const emessoAt = ordine.certificato_emesso_at || new Date().toISOString();
    const ordineConNumero = { ...ordine, numero_certificato: numeroCertificato, stato: "attivo" };
    const pdf = await generaPdfCertificato(ordineConNumero);

    await runDb(
      `UPDATE ordini
       SET stato = 'attivo', numero_certificato = ?, certificato_emesso_at = ?, certificato_pdf_url = ?, updated_at = ?
       WHERE id = ? AND partner_id = ?`,
      [numeroCertificato, emessoAt, pdf.publicUrl, new Date().toISOString(), ordineId, req.partner.id]
    );

    await sendEmail({
      to: ordine.proprietario_email,
      subject: `Certificato garanzia ${numeroCertificato}`,
      html: `<p>Gentile ${ordine.proprietario_nome || "cliente"},</p><p>in allegato trova il certificato della garanzia ${ordine.garanzia_nome || ordine.prodotto_nome}.</p>`,
      attachments: [{ filename: `${numeroCertificato}.pdf`, path: pdf.filePath }]
    });

    res.json({
      message: "Certificato emesso con successo",
      ordine_id: ordineId,
      numero_certificato: numeroCertificato,
      certificato_emesso_at: emessoAt,
      certificato_pdf_url: pdf.publicUrl,
      stato: "attivo"
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/partner/ordini/:id/certificato", partnerOnly, async (req, res, next) => {
  try {
    const ordine = await getOrdineCompletoForPartner(Number(req.params.id), req.partner.id);

    if (!ordine) return res.status(404).json({ error: "Ordine non trovato o non autorizzato" });
    if (!ordine.numero_certificato) return res.status(400).json({ error: "Certificato non ancora emesso" });

    res.json({
      numero_certificato: ordine.numero_certificato,
      certificato_emesso_at: ordine.certificato_emesso_at,
      certificato_pdf_url: ordine.certificato_pdf_url,
      stato: ordine.stato,
      garanzia: {
        nome: ordine.garanzia_nome,
        brand: ordine.garanzia_brand,
        durata: ordine.garanzia_durata,
        copertura: ordine.garanzia_copertura,
        inizio: ordine.garanzia_inizio,
        fine: ordine.garanzia_fine,
        pdf_url: ordine.garanzia_pdf_url
      },
      proprietario: {
        nome: ordine.proprietario_nome,
        cognome: ordine.proprietario_cognome,
        codice_fiscale: ordine.proprietario_cf,
        email: ordine.proprietario_email,
        telefono: ordine.proprietario_telefono,
        indirizzo: ordine.proprietario_indirizzo,
        citta: ordine.proprietario_citta,
        cap: ordine.proprietario_cap,
        provincia: ordine.proprietario_provincia
      },
      veicolo: {
        targa: ordine.veicolo_targa,
        modello: ordine.veicolo_modello,
        anno: ordine.veicolo_anno,
        km: ordine.veicolo_km
      },
      partner: {
        nome: ordine.partner_nome,
        email: ordine.partner_email
      },
      concessionario: {
        nome: ordine.concessionario_nome,
        email: ordine.concessionario_email
      },
      importi: {
        prezzo: ordine.prezzo,
        totale_supplementi: ordine.totale_supplementi,
        prezzo_finale: ordine.prezzo_finale
      },
      supplementi: parseJsonSafe(ordine.supplementi_json, [])
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/partner/dashboard", partnerOnly, async (req, res, next) => {
  try {
    const stats = await getDb(
      `SELECT
         COUNT(*) AS totale_ordini,
         SUM(CASE WHEN stato_pagamento = 'pagato' THEN 1 ELSE 0 END) AS ordini_pagati,
         SUM(CASE WHEN stato_pagamento != 'pagato' OR stato_pagamento IS NULL THEN 1 ELSE 0 END) AS ordini_non_pagati,
         COALESCE(SUM(prezzo_finale), 0) AS totale_venduto
       FROM ordini
       WHERE partner_id = ?`,
      [req.partner.id]
    );

    const garanzieStats = await getDb(
      `SELECT COUNT(*) AS totale_garanzie FROM garanzie WHERE partner_id = ?`,
      [req.partner.id]
    );

    res.json({
      totale_ordini: stats.totale_ordini || 0,
      ordini_pagati: stats.ordini_pagati || 0,
      ordini_non_pagati: stats.ordini_non_pagati || 0,
      totale_venduto: stats.totale_venduto || 0,
      totale_garanzie: garanzieStats.totale_garanzie || 0
    });
  } catch (error) {
    next(error);
  }
});

// =========================
// SUPPLEMENTI PARTNER
// =========================
app.get("/api/partner/supplementi", partnerOnly, async (req, res, next) => {
  try {
    await assicuraSupplementiPartner(req.partner.id);

    const rows = await allDb(
      `SELECT * FROM partner_supplementi WHERE partner_id = ? ORDER BY id ASC`,
      [req.partner.id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/partner/supplementi", partnerOnly, async (req, res, next) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const codice = String(req.body.codice || nome)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const prezzoFinale = Number(req.body.prezzo || 0);
    const attivoFinale = Number(req.body.attivo || 0) === 1 ? 1 : 0;

    if (!nome) return res.status(400).json({ error: "Il nome del supplemento è obbligatorio" });
    if (!codice) return res.status(400).json({ error: "Il codice del supplemento è obbligatorio" });
    if (prezzoFinale < 0) return res.status(400).json({ error: "Il prezzo non può essere negativo" });

    try {
      const result = await runDb(
        `INSERT INTO partner_supplementi (partner_id, codice, nome, prezzo, attivo, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.partner.id, codice, nome, prezzoFinale, attivoFinale, new Date().toISOString()]
      );
      res.status(201).json({ id: result.lastID, message: "Supplemento creato con successo" });
    } catch (error) {
      if (String(error.message || "").includes("UNIQUE")) {
        return res.status(409).json({ error: "Esiste già un supplemento con questo codice" });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.put("/api/partner/supplementi/:id", partnerOnly, async (req, res, next) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const codice = req.body.codice ? String(req.body.codice).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : null;
    const prezzoFinale = Number(req.body.prezzo || 0);
    const attivoFinale = Number(req.body.attivo || 0) === 1 ? 1 : 0;

    if (!nome) return res.status(400).json({ error: "Il nome del supplemento è obbligatorio" });
    if (prezzoFinale < 0) return res.status(400).json({ error: "Il prezzo non può essere negativo" });

    const result = await runDb(
      `UPDATE partner_supplementi
       SET nome = ?, codice = COALESCE(?, codice), prezzo = ?, attivo = ?, updated_at = ?
       WHERE id = ? AND partner_id = ?`,
      [nome, codice, prezzoFinale, attivoFinale, new Date().toISOString(), Number(req.params.id), req.partner.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Supplemento non trovato o non autorizzato" });
    }

    res.json({ message: "Supplemento aggiornato con successo" });
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "Esiste già un supplemento con questo codice" });
    }
    next(error);
  }
});

app.delete("/api/partner/supplementi/:id", partnerOnly, async (req, res, next) => {
  try {
    const result = await runDb(
      `DELETE FROM partner_supplementi WHERE id = ? AND partner_id = ?`,
      [Number(req.params.id), req.partner.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Supplemento non trovato o non autorizzato" });
    }

    res.json({ message: "Supplemento eliminato con successo" });
  } catch (error) {
    next(error);
  }
});

// =========================
// GARANZIE PARTNER
// =========================
app.get("/api/partner/garanzie", partnerOnly, async (req, res, next) => {
  try {
    const rows = await allDb(
      `SELECT * FROM garanzie WHERE partner_id = ? ORDER BY id DESC`,
      [req.partner.id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/partner/garanzie", partnerOnly, async (req, res, next) => {
  try {
    const {
      nome,
      descrizione,
      prezzo,
      durata,
      copertura,
      brand,
      stato,
      pdf_url,
      limiti_attivi,
      limite_km,
      limite_immatricolazione,
      canale_attivazione,
      tipo_veicolo_attivabile,
      servizio_tipo
    } = req.body;

    if (!nome || !descrizione || !prezzo || !durata || !copertura) {
      return res.status(400).json({ error: "Tutti i campi obbligatori devono essere compilati" });
    }

    const result = await runDb(
      `INSERT INTO garanzie (
        nome, descrizione, prezzo, durata, copertura, partner_id, brand, stato,
        updated_at, pdf_url, limiti_attivi, limite_km, limite_immatricolazione, canale_attivazione, tipo_veicolo_attivabile, servizio_tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        descrizione,
        Number(prezzo),
        Number(durata),
        copertura,
        req.partner.id,
        brand || "",
        stato || "attiva",
        new Date().toISOString(),
        pdf_url || "",
        limiti_attivi ? 1 : 0,
        limite_km || null,
        limite_immatricolazione || null,
        canale_attivazione || "entrambi",
        tipo_veicolo_attivabile || "AUTOVEICOLO",
        servizio_tipo || "GARANZIA"
      ]
    );

    res.json({ message: "Garanzia creata con successo", id: result.lastID });
  } catch (error) {
    next(error);
  }
});

app.put("/api/partner/garanzie/:id", partnerOnly, async (req, res, next) => {
  try {
    const {
      nome,
      descrizione,
      prezzo,
      durata,
      copertura,
      brand,
      stato,
      pdf_url,
      limiti_attivi,
      limite_km,
      limite_immatricolazione,
      canale_attivazione,
      tipo_veicolo_attivabile,
      servizio_tipo
    } = req.body;

    if (!nome || !descrizione || !prezzo || !durata || !copertura) {
      return res.status(400).json({ error: "Tutti i campi obbligatori devono essere compilati" });
    }

    const result = await runDb(
      `UPDATE garanzie
       SET nome = ?, descrizione = ?, prezzo = ?, durata = ?, copertura = ?, brand = ?, stato = ?,
           updated_at = ?, pdf_url = ?, limiti_attivi = ?, limite_km = ?, limite_immatricolazione = ?,
           canale_attivazione = ?, tipo_veicolo_attivabile = ?, servizio_tipo = ?
       WHERE id = ? AND partner_id = ?`,
      [
        nome,
        descrizione,
        Number(prezzo),
        Number(durata),
        copertura,
        brand || "",
        stato || "attiva",
        new Date().toISOString(),
        pdf_url || "",
        limiti_attivi ? 1 : 0,
        limite_km || null,
        limite_immatricolazione || null,
        canale_attivazione || "entrambi",
        tipo_veicolo_attivabile || "AUTOVEICOLO",
        servizio_tipo || "GARANZIA",
        Number(req.params.id),
        req.partner.id
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Garanzia non trovata o non autorizzata" });
    }

    res.json({ message: "Garanzia aggiornata con successo" });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/partner/garanzie/:id", partnerOnly, async (req, res, next) => {
  try {
    const result = await runDb(
      `DELETE FROM garanzie WHERE id = ? AND partner_id = ?`,
      [Number(req.params.id), req.partner.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Garanzia non trovata o non autorizzata" });
    }

    res.json({ message: "Garanzia eliminata con successo" });
  } catch (error) {
    next(error);
  }
});

// =========================
// UPLOAD PDF PARTNER
// =========================
app.post("/api/partner/upload-pdf", partnerOnly, upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nessun file PDF caricato" });
  }

  res.json({
    message: "PDF caricato con successo",
    pdf_url: "/uploads/" + req.file.filename
  });
});

// =========================
// ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
  console.error("Errore server:", err.message);

  if (err.message === "È consentito solo il formato PDF") {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Il file supera il limite massimo di 5MB" });
  }

  res.status(500).json({ error: "Errore interno del server" });
});

// =========================
// START SERVER
// =========================
validateRuntimeConfig();

setupDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server attivo su ${APP_URL}`);
    });
  })
  .catch((error) => {
    console.error("Errore inizializzazione database:", error.message);
    process.exit(1);
  });
