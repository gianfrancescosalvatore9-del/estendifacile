document.addEventListener("DOMContentLoaded", function () {
  const ruoloInput = document.getElementById("ruolo");

  const rolePrivato = document.getElementById("rolePrivato");
  const roleConcessionario = document.getElementById("roleConcessionario");
  const rolePartner = document.getElementById("rolePartner");

  const nomeGroup = document.getElementById("nomeGroup");
  const aziendaGroup = document.getElementById("aziendaGroup");

  const registerForm = document.getElementById("registerForm");
  const msg = document.getElementById("registerMsg");

  function resetRoles() {
    if (rolePrivato) rolePrivato.classList.remove("active");
    if (roleConcessionario) roleConcessionario.classList.remove("active");
    if (rolePartner) rolePartner.classList.remove("active");
  }

  function setRuolo(tipo) {
    ruoloInput.value = tipo;
    resetRoles();

    const nomeLabel = document.querySelector("#nomeGroup label");
    const nomeInput = document.getElementById("nome");

    if (tipo === "privato") {
      if (rolePrivato) rolePrivato.classList.add("active");

      nomeGroup.style.display = "block";
      aziendaGroup.style.display = "none";

      nomeLabel.innerText = "Nome e cognome";
      nomeInput.placeholder = "Es. Mario Rossi";
      return;
    }

    if (tipo === "partner") {
      if (rolePartner) rolePartner.classList.add("active");

      nomeGroup.style.display = "none";
      aziendaGroup.style.display = "block";
      return;
    }

    if (roleConcessionario) roleConcessionario.classList.add("active");

    nomeGroup.style.display = "block";
    aziendaGroup.style.display = "none";

    nomeLabel.innerText = "Nome / Ragione sociale concessionario";
    nomeInput.placeholder = "Es. Rossi Auto Srl";
  }

  if (rolePrivato) {
    rolePrivato.addEventListener("click", function () {
      setRuolo("privato");
    });
  }

  if (roleConcessionario) {
    roleConcessionario.addEventListener("click", function () {
      setRuolo("concessionario");
    });
  }

  if (rolePartner) {
    rolePartner.addEventListener("click", function () {
      setRuolo("partner");
    });
  }

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const ruolo = ruoloInput.value;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    msg.textContent = "";
    msg.className = "message";

    if (!email || !password) {
      msg.textContent = "Email e password sono obbligatorie.";
      return;
    }

    if (password.length < 6) {
      msg.textContent = "La password deve contenere almeno 6 caratteri.";
      return;
    }

    let endpoint = "";
    let payload = {};

    if (ruolo === "partner") {
      const nome_azienda = document.getElementById("nome_azienda").value.trim();

      if (!nome_azienda) {
        msg.textContent = "La ragione sociale partner è obbligatoria.";
        return;
      }

      endpoint = "/api/partner/register";
      payload = { nome_azienda, email, password };

    } else {
      const nome = document.getElementById("nome").value.trim();

      if (!nome) {
        msg.textContent =
          ruolo === "privato"
            ? "Nome e cognome sono obbligatori."
            : "Il nome o la ragione sociale è obbligatoria.";
        return;
      }

      if (ruolo === "privato") {
        endpoint = "/api/privati/register";
      } else {
        endpoint = "/api/register";
      }

      payload = { nome, email, password };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Errore durante la registrazione.";
        return;
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("partnerToken");
      localStorage.removeItem("partnerUser");
      localStorage.removeItem("tipoUtente");

      if (ruolo === "partner") {
        localStorage.setItem("partnerToken", data.token);
        localStorage.setItem("partnerUser", JSON.stringify(data.partner));
        localStorage.setItem("tipoUtente", "partner");

        window.location.href = "/partner-dashboard.html";
        return;
      }

      if (ruolo === "privato") {
  localStorage.setItem("privatoToken", data.token);
  localStorage.setItem("privatoUser", JSON.stringify(data.user));
  localStorage.setItem("tipoUtente", "privato");

  window.location.href = "/profilo.html";
  return;
}

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("tipoUtente", "concessionario");

      window.location.href = "/dashboard-concessionario.html";

    } catch (error) {
      console.error(error);
      msg.textContent = "Errore di connessione al server.";
    }
  });

  setRuolo("concessionario");
});