document.addEventListener("DOMContentLoaded", () => {
  const loginView = document.getElementById("loginView");
  const adminView = document.getElementById("adminView");
  const loginForm = document.getElementById("adminLoginForm");
  const loginMessage = document.getElementById("loginMessage");
  const refreshButton = document.getElementById("refreshDashboard");
  const logoutButton = document.getElementById("logoutAdmin");
  const adminName = document.getElementById("adminName");
  const lastUpdate = document.getElementById("lastUpdate");

  let dashboardData = null;

  const euro = (value) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0) / 100);

  const number = (value) => new Intl.NumberFormat("it-IT").format(Number(value || 0));

  const safe = (value, fallback = "-") => {
    const text = String(value ?? "").trim();
    return text || fallback;
  };

  const dateIT = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  function token() {
    return localStorage.getItem("adminToken");
  }

  function setVisible(isLogged) {
    loginView.style.display = isLogged ? "none" : "grid";
    adminView.style.display = isLogged ? "grid" : "none";
  }

  function setMessage(text) {
    loginMessage.textContent = text || "";
  }

  async function login(email, password) {
    setMessage("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Accesso amministratore non riuscito");
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("partnerToken");
    localStorage.removeItem("partnerUser");
    localStorage.removeItem("privatoToken");
    localStorage.removeItem("privatoUser");
    localStorage.setItem("adminToken", data.token);
    localStorage.setItem("adminUser", JSON.stringify(data.admin || {}));
    localStorage.setItem("tipoUtente", "admin");

    return data.admin || {};
  }

  async function loadDashboard() {
    const res = await fetch("/api/admin/dashboard", {
      headers: { Authorization: "Bearer " + token() }
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("tipoUtente");
        setVisible(false);
      }

      throw new Error(data.error || "Errore caricamento dashboard");
    }

    dashboardData = data;
    renderDashboard(data);
  }

  function renderDashboard(data) {
    setVisible(true);
    adminName.textContent = safe(data.admin?.nome || data.admin?.email, "Amministratore");
    lastUpdate.textContent = "Ultimo aggiornamento: " + new Date().toLocaleString("it-IT");

    renderProof(data);
    renderKpis(data.kpi || {});
    renderInsights(data.evidenze || {});
    renderFlows(data.flussi || {});
    renderStatusList("statusList", data.charts?.ordini_per_stato || [], "stato", "totale");
    renderStatusList("topWarrantyList", data.charts?.top_garanzie || [], "nome", "totale", (item) => safe(item.brand, "Prodotto"));
    renderStatusList("topCarList", data.charts?.top_auto || [], "modello", "totale");
    renderTables(data.liste || {});
    drawMonthlyChart(document.getElementById("monthlyChart"), data.charts?.andamento_mensile || []);
    drawBarChart(document.getElementById("partnerChart"), data.charts?.garanzie_per_partner || [], "partner", "totale");
  }

  function renderProof(data) {
    document.getElementById("proofRequests").textContent = number(data.flussi?.totale_ordini || 0);
    document.getElementById("proofRevenue").textContent = euro(data.kpi?.fatturato_complessivo || 0);
    document.getElementById("proofWarranties").textContent = number(data.kpi?.garanzie_caricate || 0);
  }

  function renderKpis(kpi) {
    const cards = [
      ["Richieste preventivo", kpi.richieste_preventivo, "Pratiche non ancora pagate"],
      ["Richieste buon fine", kpi.richieste_buon_fine, "Pagamenti confermati"],
      ["Fatturato complessivo", euro(kpi.fatturato_complessivo), "Valore richieste pagate"],
      ["Garanzie attive", kpi.garanzie_attive, "Prodotti vendibili"],
      ["Garanzie caricate", kpi.garanzie_caricate, "Catalogo totale"],
      ["Certificati generati", kpi.certificati_generati, "PDF emessi dai partner"],
      ["Nuovi iscritti", kpi.nuovi_iscritti, "Ultimi 30 giorni"],
      ["Operatori", `${number(kpi.concessionari)} / ${number(kpi.partner)}`, "Concessionari / partner"]
    ];

    document.getElementById("kpiGrid").innerHTML = cards.map(([label, value, note]) => `
      <article class="kpi-card">
        <div>
          <div class="kpi-label">${label}</div>
          <div class="kpi-value">${typeof value === "number" ? number(value) : value}</div>
        </div>
        <div class="kpi-note">${note}</div>
      </article>
    `).join("");
  }

  function renderInsights(evidenze) {
    const garanzia = evidenze.garanzia_piu_scelta;
    const auto = evidenze.auto_piu_attivata;
    const dealer = evidenze.concessionario_piu_attivo;

    const cards = [
      {
        label: "Garanzia piu scelta",
        title: garanzia ? safe(garanzia.nome) : "Nessun dato",
        text: garanzia ? `${number(garanzia.totale)} richieste, ${euro(garanzia.valore)}` : "Comparira dopo il primo acquisto."
      },
      {
        label: "Auto piu attivata",
        title: auto ? safe(auto.modello) : "Nessun dato",
        text: auto ? `${number(auto.totale)} attivazioni pagate` : "Comparira dopo il primo pagamento."
      },
      {
        label: "Concessionario piu attivo",
        title: dealer ? safe(dealer.nome) : "Nessun dato",
        text: dealer ? `${number(dealer.totale_ordini)} richieste, ${euro(dealer.fatturato)}` : "Comparira dopo la prima pratica."
      }
    ];

    document.getElementById("insightGrid").innerHTML = cards.map((card) => `
      <article class="insight-card">
        <small>${card.label}</small>
        <strong>${card.title}</strong>
        <span>${card.text}</span>
      </article>
    `).join("");
  }

  function renderFlows(flussi) {
    const items = [
      ["Ordini totali", flussi.totale_ordini, "Tutte le pratiche create"],
      ["Caricamenti garanzie", flussi.caricamenti_garanzie, "Prodotti presenti a catalogo"],
      ["PDF condizioni", flussi.caricamenti_con_pdf, "Garanzie con documento allegato"],
      ["Bozze", flussi.garanzie_bozza, "Prodotti non ancora definitivi"],
      ["Sospese", flussi.garanzie_sospese, "Prodotti non vendibili"],
      ["Preventivi aperti", flussi.richieste_preventivo, "Richieste non ancora pagate"],
      ["Buon fine", flussi.richieste_buon_fine, "Richieste pagate"],
      ["Conversione", conversionRate(flussi), "Rapporto tra pagate e totali"]
    ];

    document.getElementById("flowGrid").innerHTML = items.map(([label, value, text]) => `
      <article class="flow-card">
        <small>${label}</small>
        <strong>${typeof value === "number" ? number(value) : value}</strong>
        <span>${text}</span>
      </article>
    `).join("");
  }

  function conversionRate(flussi) {
    const total = Number(flussi.totale_ordini || 0);
    if (!total) return "0%";
    return Math.round((Number(flussi.richieste_buon_fine || 0) / total) * 100) + "%";
  }

  function renderStatusList(targetId, rows, labelKey, valueKey, subtitleFn) {
    const target = document.getElementById(targetId);
    const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

    if (!rows.length) {
      target.innerHTML = `<div class="flow-card"><strong>Nessun dato</strong><span>I dati appariranno dopo le prime pratiche.</span></div>`;
      return;
    }

    target.innerHTML = rows.map((row, index) => {
      const value = Number(row[valueKey] || 0);
      const width = Math.max(4, Math.round((value / max) * 100));
      const color = ["#18b45a", "#5b5fc7", "#d97706", "#10346f", "#64748b", "#0f766e"][index % 6];

      return `
        <div class="status-row">
          <div class="status-meta">
            <span>${safe(row[labelKey])}</span>
            <strong>${number(value)}</strong>
          </div>
          ${subtitleFn ? `<div class="kpi-note">${subtitleFn(row)}</div>` : ""}
          <div class="status-track"><div class="status-fill" style="width:${width}%;background:${color};"></div></div>
        </div>
      `;
    }).join("");
  }

  function renderTables(liste) {
    renderOrders(liste.ordini_recenti || []);
    renderWarranties(liste.garanzie_recenti || []);
    renderUsers(liste.utenti_recenti || []);
  }

  function paymentPill(status) {
    if (status === "pagato") return `<span class="pill">Pagato</span>`;
    if (status === "in_attesa") return `<span class="pill warn">In attesa</span>`;
    return `<span class="pill off">${safe(status, "Non pagato")}</span>`;
  }

  function warrantyPill(status) {
    if (!status || status === "attiva") return `<span class="pill">Attiva</span>`;
    if (status === "bozza") return `<span class="pill warn">Bozza</span>`;
    return `<span class="pill off">${safe(status)}</span>`;
  }

  function renderOrders(rows) {
    const tbody = document.getElementById("ordersTable");

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8">Nessuna richiesta presente.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>#${row.id}<br><small>${dateIT(row.created_at)}</small></td>
        <td>${safe(row.garanzia_nome || row.prodotto_nome)}</td>
        <td>${safe(row.concessionario_nome)}</td>
        <td>${safe(row.partner_nome)}</td>
        <td>${safe(row.veicolo_modello)}<br><small>${safe(row.veicolo_targa)}</small></td>
        <td>${paymentPill(row.stato_pagamento)}</td>
        <td>${euro(row.prezzo_finale)}</td>
        <td>${row.numero_certificato ? `<span class="pill">${row.numero_certificato}</span>` : `<span class="pill off">Da emettere</span>`}</td>
      </tr>
    `).join("");
  }

  function renderWarranties(rows) {
    const tbody = document.getElementById("warrantiesTable");

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7">Nessuna garanzia caricata.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${safe(row.nome)}</td>
        <td>${safe(row.partner_nome)}</td>
        <td>${safe(row.brand)}</td>
        <td>${euro(row.prezzo)}</td>
        <td>${number(row.durata)} mesi</td>
        <td>${warrantyPill(row.stato)}</td>
        <td>${row.pdf_url ? `<span class="pill">Presente</span>` : `<span class="pill off">Assente</span>`}</td>
      </tr>
    `).join("");
  }

  function renderUsers(rows) {
    const tbody = document.getElementById("usersTable");

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="4">Nessun iscritto recente.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${safe(row.nome)}</td>
        <td>${safe(row.email)}</td>
        <td><span class="pill ${row.tipo === "partner" ? "" : "off"}">${safe(row.tipo)}</span></td>
        <td>${dateIT(row.created_at)}</td>
      </tr>
    `).join("");
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function drawEmpty(ctx, width, height) {
    ctx.fillStyle = "#64748b";
    ctx.font = "700 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Nessun dato disponibile", width / 2, height / 2);
  }

  function drawMonthlyChart(canvas, rows) {
    const { ctx, width, height } = clearCanvas(canvas);

    if (!rows.length) {
      drawEmpty(ctx, width, height);
      return;
    }

    const padding = { top: 20, right: 28, bottom: 44, left: 52 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxRequests = Math.max(...rows.map((row) => Number(row.richieste || 0)), 1);
    const maxRevenue = Math.max(...rows.map((row) => Number(row.fatturato || 0)), 1);
    const step = chartW / Math.max(rows.length - 1, 1);

    ctx.strokeStyle = "#dfe7f2";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    rows.forEach((row, index) => {
      const x = padding.left + step * index;
      const reqHeight = (Number(row.richieste || 0) / maxRequests) * chartH;
      const barW = Math.min(34, chartW / rows.length * 0.45);

      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(x - barW / 2, padding.top + chartH - reqHeight, barW, reqHeight);
      ctx.fillStyle = "#071d49";
      ctx.font = "800 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(row.mese || "").slice(5), x, height - 16);
    });

    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = padding.left + step * index;
      const y = padding.top + chartH - (Number(row.fatturato || 0) / maxRevenue) * chartH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#18b45a";
    ctx.lineWidth = 3;
    ctx.stroke();

    rows.forEach((row, index) => {
      const x = padding.left + step * index;
      const y = padding.top + chartH - (Number(row.fatturato || 0) / maxRevenue) * chartH;
      ctx.fillStyle = "#18b45a";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#102542";
    ctx.font = "800 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Barre: richieste", padding.left, 14);
    ctx.fillStyle = "#18b45a";
    ctx.fillText("Linea: fatturato", padding.left + 118, 14);
  }

  function drawBarChart(canvas, rows, labelKey, valueKey) {
    const { ctx, width, height } = clearCanvas(canvas);

    if (!rows.length) {
      drawEmpty(ctx, width, height);
      return;
    }

    const padding = { top: 24, right: 24, bottom: 34, left: 180 };
    const chartW = width - padding.left - padding.right;
    const barH = Math.min(30, (height - padding.top - padding.bottom) / rows.length - 8);
    const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
    const colors = ["#18b45a", "#5b5fc7", "#d97706", "#10346f", "#0f766e", "#64748b"];

    rows.forEach((row, index) => {
      const y = padding.top + index * (barH + 10);
      const value = Number(row[valueKey] || 0);
      const barW = Math.max(4, (value / max) * chartW);

      ctx.fillStyle = "#334155";
      ctx.font = "800 12px Arial";
      ctx.textAlign = "right";
      ctx.fillText(safe(row[labelKey]).slice(0, 22), padding.left - 12, y + barH * 0.72);

      ctx.fillStyle = "#edf2f7";
      ctx.fillRect(padding.left, y, chartW, barH);
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(padding.left, y, barW, barH);
      ctx.fillStyle = "#071d49";
      ctx.textAlign = "left";
      ctx.fillText(number(value), padding.left + barW + 8, y + barH * 0.72);
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const admin = await login(
        document.getElementById("adminEmail").value.trim(),
        document.getElementById("adminPassword").value.trim()
      );

      adminName.textContent = safe(admin.nome || admin.email, "Amministratore");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "Errore di connessione");
    }
  });

  refreshButton.addEventListener("click", () => {
    loadDashboard().catch((error) => {
      lastUpdate.textContent = error.message || "Errore aggiornamento dati";
    });
  });

  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("tipoUtente");
    setVisible(false);
  });

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      document.querySelectorAll(".section").forEach((section) => section.classList.remove("active"));
      document.getElementById("section-" + button.dataset.section)?.classList.add("active");

      if (dashboardData) {
        drawMonthlyChart(document.getElementById("monthlyChart"), dashboardData.charts?.andamento_mensile || []);
        drawBarChart(document.getElementById("partnerChart"), dashboardData.charts?.garanzie_per_partner || [], "partner", "totale");
      }
    });
  });

  window.addEventListener("resize", () => {
    if (!dashboardData || adminView.style.display === "none") return;
    drawMonthlyChart(document.getElementById("monthlyChart"), dashboardData.charts?.andamento_mensile || []);
    drawBarChart(document.getElementById("partnerChart"), dashboardData.charts?.garanzie_per_partner || [], "partner", "totale");
  });

  if (token()) {
    setVisible(true);
    loadDashboard().catch(() => setVisible(false));
  } else {
    setVisible(false);
  }
});
