(function () {
  function redirect(path) {
    if (!path.startsWith("/")) return;
    window.location.replace(path);
  }

  function isTokenValid(token) {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  function clearAllTokens() {
    ["token", "partnerToken", "privatoToken", "adminToken",
     "user", "partnerUser", "adminUser", "tipoUtente",
     "garanziaSelezionata", "ultimoOrdine"].forEach(function (k) {
      localStorage.removeItem(k);
    });
  }

  function getTipoUtente() {
    const stored = localStorage.getItem("tipoUtente");
    if (stored) return stored;
    if (isTokenValid(localStorage.getItem("partnerToken"))) return "partner";
    if (isTokenValid(localStorage.getItem("privatoToken"))) return "privato";
    if (isTokenValid(localStorage.getItem("token"))) return "concessionario";
    if (isTokenValid(localStorage.getItem("adminToken"))) return "admin";
    return "";
  }

  function getToken() {
    const t = localStorage.getItem("token") ||
      localStorage.getItem("partnerToken") ||
      localStorage.getItem("privatoToken") ||
      localStorage.getItem("adminToken");
    return isTokenValid(t) ? t : null;
  }

  function requireConcessionario() {
    const token = localStorage.getItem("token");
    const ruolo = getTipoUtente();

    if (!isTokenValid(token) || ruolo !== "concessionario") {
      clearAllTokens();
      redirect("/login.html");
      return;
    }
    localStorage.setItem("tipoUtente", "concessionario");
  }

  function requirePartner() {
    const token = localStorage.getItem("partnerToken");
    const ruolo = getTipoUtente();

    if (!isTokenValid(token) || ruolo !== "partner") {
      clearAllTokens();
      redirect("/login.html");
      return;
    }
    localStorage.setItem("tipoUtente", "partner");
  }

  function requireBuyer() {
    const ruolo = getTipoUtente();
    const token =
      ruolo === "privato"
        ? localStorage.getItem("privatoToken")
        : localStorage.getItem("token");

    if (!isTokenValid(token) || (ruolo !== "concessionario" && ruolo !== "privato")) {
      clearAllTokens();
      redirect("/login.html");
      return;
    }
    localStorage.setItem("tipoUtente", ruolo);
  }

  function requireAuth() {
    if (!getToken()) {
      clearAllTokens();
      redirect("/login.html");
    }
  }

  function requireAdmin() {
    const token = localStorage.getItem("adminToken");
    const ruolo = getTipoUtente();

    if (!isTokenValid(token) || ruolo !== "admin") {
      clearAllTokens();
      redirect("/login.html");
    }
  }

  function logoutConcessionario() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("tipoUtente");
    localStorage.removeItem("garanziaSelezionata");
    localStorage.removeItem("ultimoOrdine");

    redirect("/login.html");
  }

  function logoutPartner() {
    localStorage.removeItem("partnerToken");
    localStorage.removeItem("partnerUser");
    localStorage.removeItem("tipoUtente");

    redirect("/login.html");
  }

  function logoutAdmin() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("tipoUtente");

    redirect("/admin.html");
  }

  window.AuthGuard = {
    requireAuth,
    requireConcessionario,
    requirePartner,
    requireBuyer,
    requireAdmin,
    logoutConcessionario,
    logoutPartner,
    logoutAdmin
  };
})();
