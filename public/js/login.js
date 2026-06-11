document.addEventListener("DOMContentLoaded", function () {
  const privatoCard = document.getElementById("privatoCard");
  const concessionarioCard = document.getElementById("concessionarioCard");
  const partnerCard = document.getElementById("partnerCard");

  const ruoloInput = document.getElementById("ruolo");
  const loginForm = document.getElementById("loginForm");
  const errorMsg = document.getElementById("errorMsg");

  function resetCards() {
    if (privatoCard) privatoCard.classList.remove("active");
    if (concessionarioCard) concessionarioCard.classList.remove("active");
    if (partnerCard) partnerCard.classList.remove("active");
  }

  function setRuolo(tipo) {
    ruoloInput.value = tipo;
    resetCards();

    if (tipo === "privato" && privatoCard) {
      privatoCard.classList.add("active");
    } else if (tipo === "partner" && partnerCard) {
      partnerCard.classList.add("active");
    } else if (concessionarioCard) {
      concessionarioCard.classList.add("active");
    }

    errorMsg.textContent = "";
    errorMsg.className = "message";
  }

  if (privatoCard) {
    privatoCard.addEventListener("click", function () {
      setRuolo("privato");
    });
  }

  if (concessionarioCard) {
    concessionarioCard.addEventListener("click", function () {
      setRuolo("concessionario");
    });
  }

  if (partnerCard) {
    partnerCard.addEventListener("click", function () {
      setRuolo("partner");
    });
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const ruolo = ruoloInput.value;

    errorMsg.textContent = "";
    errorMsg.className = "message";

    let endpoint = "/api/login";

    if (ruolo === "partner") {
      endpoint = "/api/partner/login";
    }

    if (ruolo === "privato") {
      endpoint = "/api/privati/login";
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.error || "Credenziali non valide";
        errorMsg.classList.add("error");
        return;
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("partnerToken");
      localStorage.removeItem("partnerUser");
      localStorage.removeItem("privatoToken");
      localStorage.removeItem("privatoUser");
      localStorage.removeItem("tipoUtente");

      if (ruolo === "partner") {
        localStorage.setItem("partnerToken", data.token);
        localStorage.setItem("partnerUser", JSON.stringify(data.partner || {}));
        localStorage.setItem("tipoUtente", "partner");

        window.location.href = "/partner-dashboard.html";
        return;
      }

      if (ruolo === "privato") {
        localStorage.setItem("privatoToken", data.token);
        localStorage.setItem("privatoUser", JSON.stringify(data.user || {}));
        localStorage.setItem("tipoUtente", "privato");

        window.location.href = "/profilo.html";
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || {}));
      localStorage.setItem("tipoUtente", "concessionario");

      window.location.href = "/dashboard-concessionario.html";
    } catch (err) {
      console.error(err);
      errorMsg.textContent = "Errore connessione server";
      errorMsg.classList.add("error");
    }
  });

  setRuolo("concessionario");
});