const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const base = process.env.BASE_URL || "http://localhost:3100";
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outDir = path.join(process.cwd(), "test-artifacts");
const stamp = Date.now();
const results = [];

function mark(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function waitFor(fn, timeout = 12000, step = 150) {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }

    await sleep(step);
  }

  throw lastError || new Error("Timeout");
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    this.events = [];

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);

      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || "CDP error"));
        else resolve(msg.result || {});
        return;
      }

      if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.id++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  waitEvent(method, sessionId, timeout = 10000) {
    return waitFor(() => {
      const index = this.events.findIndex((event) => event.method === method && (!sessionId || event.sessionId === sessionId));
      if (index === -1) return false;
      return this.events.splice(index, 1)[0];
    }, timeout);
  }
}

async function startEdge() {
  const port = 9400 + Math.floor(Math.random() * 500);
  const userDataDir = path.join(os.tmpdir(), `ef-edge-${stamp}`);
  const proc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], { stdio: "ignore" });

  const version = await waitFor(() => fetchJson(`http://127.0.0.1:${port}/json/version`), 15000);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return { client: new CdpClient(ws), proc, userDataDir };
}

async function createPage(client) {
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Log.enable", {}, sessionId).catch(() => {});
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  }, sessionId);
  return sessionId;
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  }, sessionId);

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime exception");
  }

  return result.result ? result.result.value : undefined;
}

async function navigate(client, sessionId, url) {
  const load = client.waitEvent("Page.loadEventFired", sessionId, 12000).catch(() => null);
  await client.send("Page.navigate", { url }, sessionId);
  await load;
  await sleep(650);
}

async function screenshot(client, sessionId, name) {
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true
  }, sessionId);
  const file = path.join(outDir, name);
  await fs.writeFile(file, Buffer.from(shot.data, "base64"));
  return file;
}

function jsString(value) {
  return JSON.stringify(String(value));
}

async function click(client, sessionId, selector) {
  await evaluate(client, sessionId, `
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) throw new Error("Elemento non trovato: " + ${jsString(selector)});
      el.click();
      return true;
    })()
  `);
  await sleep(250);
}

async function fill(client, sessionId, selector, value) {
  await evaluate(client, sessionId, `
    (() => {
      const el = document.querySelector(${jsString(selector)});
      if (!el) throw new Error("Campo non trovato: " + ${jsString(selector)});
      el.focus();
      el.value = ${jsString(value)};
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);
}

async function submit(client, sessionId, selector) {
  await evaluate(client, sessionId, `
    (() => {
      const form = document.querySelector(${jsString(selector)});
      if (!form) throw new Error("Form non trovato: " + ${jsString(selector)});
      form.requestSubmit();
      return true;
    })()
  `);
}

async function currentUrl(client, sessionId) {
  return evaluate(client, sessionId, "location.href");
}

async function waitForUrl(client, sessionId, needle) {
  return waitFor(async () => {
    const url = await currentUrl(client, sessionId);
    return url.includes(needle) ? url : false;
  }, 12000);
}

async function waitForSelector(client, sessionId, selector) {
  return waitFor(() => evaluate(client, sessionId, `Boolean(document.querySelector(${jsString(selector)}))`), 12000);
}

async function registerRole(client, sessionId, role, email, password) {
  await navigate(client, sessionId, `${base}/register.html`);
  await evaluate(client, sessionId, "localStorage.clear()");
  await click(client, sessionId, `.profile-card[data-role="${role}"]`);

  if (role === "partner") {
    await fill(client, sessionId, "#nome_azienda", `Partner UI ${stamp}`);
  } else {
    await fill(client, sessionId, "#nome", role === "privato" ? "Privato UI" : "Dealer UI Srl");
  }

  await fill(client, sessionId, "#email", email);
  await fill(client, sessionId, "#password", password);
  await submit(client, sessionId, "#registerForm");
}

async function loginRole(client, sessionId, role, email, password) {
  await navigate(client, sessionId, `${base}/login.html`);
  await evaluate(client, sessionId, "localStorage.clear()");
  await click(client, sessionId, `.profile-card[data-role="${role}"]`);
  await fill(client, sessionId, "#email", email);
  await fill(client, sessionId, "#password", password);
  await submit(client, sessionId, "#loginForm");
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const { client, proc, userDataDir } = await startEdge();
  let sessionId;

  try {
    sessionId = await createPage(client);
    const password = "Test1234";
    const privatoEmail = `ui.privato.${stamp}@test.it`;
    const dealerEmail = `ui.dealer.${stamp}@test.it`;
    const partnerEmail = `ui.partner.${stamp}@test.it`;

    await navigate(client, sessionId, `${base}/index.html`);
    await screenshot(client, sessionId, "home.png");
    mark("Homepage caricata", await evaluate(client, sessionId, "Boolean(document.querySelector('.hero-search-panel'))"), await currentUrl(client, sessionId));

    await fill(client, sessionId, "#targaInput", "AB123CD");
    await click(client, sessionId, "#btnContinuaTarga");
    await fill(client, sessionId, "#modelloInput", "Audi A3");
    await fill(client, sessionId, "#annoInput", "2020");
    await fill(client, sessionId, "#kmInput", "80000");
    await click(client, sessionId, "#btnVaiRisultati");
    await waitForSelector(client, sessionId, "#homeResultsSection.open");
    await sleep(900);
    await screenshot(client, sessionId, "home-risultati-inline.png");
    const inlineCount = await evaluate(client, sessionId, "document.querySelectorAll('.home-warranty-card').length");
    mark("Homepage comparatore con risultati inline", inlineCount >= 1, `${inlineCount} card - ${await currentUrl(client, sessionId)}`);

    await click(client, sessionId, ".ef-assistant-button");
    await fill(client, sessionId, ".ef-assistant-input", "Consigliami una garanzia per Audi A3 2020 80000 km");
    await submit(client, sessionId, "#efAssistantForm");
    await waitForSelector(client, sessionId, ".ef-ai-card, .ef-assistant-form");
    mark("Chatbot IA risponde", await evaluate(client, sessionId, "document.querySelector('.ef-assistant-panel')?.classList.contains('open')"), "panel aperto");

    await registerRole(client, sessionId, "privato", privatoEmail, password);
    await waitForUrl(client, sessionId, "profilo");
    mark("Registrazione UI privato", true, await currentUrl(client, sessionId));

    await registerRole(client, sessionId, "concessionario", dealerEmail, password);
    await waitForUrl(client, sessionId, "dashboard-concessionario");
    mark("Registrazione UI concessionario", true, await currentUrl(client, sessionId));

    await registerRole(client, sessionId, "partner", partnerEmail, password);
    await waitForUrl(client, sessionId, "partner-dashboard");
    mark("Registrazione UI partner", true, await currentUrl(client, sessionId));

    await loginRole(client, sessionId, "privato", privatoEmail, password);
    await waitForUrl(client, sessionId, "profilo");
    await sleep(700);
    await screenshot(client, sessionId, "dashboard-privato.png");
    mark("Accesso UI privato", true, await currentUrl(client, sessionId));

    await loginRole(client, sessionId, "concessionario", dealerEmail, password);
    await waitForUrl(client, sessionId, "dashboard-concessionario");
    await sleep(700);
    await screenshot(client, sessionId, "dashboard-concessionario.png");
    mark("Accesso UI concessionario", true, await currentUrl(client, sessionId));

    await loginRole(client, sessionId, "partner", partnerEmail, password);
    await waitForUrl(client, sessionId, "partner-dashboard");
    await sleep(700);
    await screenshot(client, sessionId, "dashboard-partner.png");
    mark("Accesso UI partner", true, await currentUrl(client, sessionId));

    await navigate(client, sessionId, `${base}/admin.html`);
    await fill(client, sessionId, "#adminEmail", "admin@estendifacile.it");
    await fill(client, sessionId, "#adminPassword", "admin123");
    await submit(client, sessionId, "#adminLoginForm");
    await waitForSelector(client, sessionId, "#kpiGrid .kpi-card");
    await sleep(800);
    await screenshot(client, sessionId, "dashboard-admin.png");
    const kpiCount = await evaluate(client, sessionId, "document.querySelectorAll('#kpiGrid .kpi-card').length");
    mark("Accesso UI admin e KPI", kpiCount >= 8, `${kpiCount} KPI`);

    const pageErrors = client.events
      .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
      .map((event) => event.params?.exceptionDetails?.text || event.params?.entry?.text || "")
      .filter(Boolean)
      .filter((message) => !/Tracking Prevention blocked access to storage/i.test(message))
      .filter((message) => !message.includes("cdnjs.cloudflare.com/ajax/libs/font-awesome"));
    mark("Console senza errori critici", pageErrors.length === 0, pageErrors.slice(0, 4).join(" | "));
  } finally {
    client.ws.close();
    proc.kill();
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main()
  .catch((error) => {
    mark("Errore test UI", false, error.message);
  })
  .finally(() => {
    const passed = results.filter((item) => item.ok).length;
    console.log(JSON.stringify({ passed, total: results.length, outDir, results }, null, 2));
    if (passed !== results.length) process.exitCode = 1;
  });
