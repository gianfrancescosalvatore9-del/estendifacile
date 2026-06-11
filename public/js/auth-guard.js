(function () {
  function redirect(path) {
    window.location.replace(path);
  }

  function getTipoUtente() {
    const stored = localStorage.getItem("tipoUtente");
    if (stored) return stored;
    if (localStorage.getItem("partnerToken")) return "partner";
    if (localStorage.getItem("privatoToken")) return "privato";
    if (localStorage.getItem("token")) return "concessionario";
    if (localStorage.getItem("adminToken")) return "admin";
    return "";
  }

  function getToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("partnerToken") ||
      localStorage.getItem("privatoToken") ||
      localStorage.getItem("adminToken")
    );
  }

  function requireConcessionario() {
    const token = localStorage.getItem("token");
    const ruolo = getTipoUtente();

    if (!token || ruolo !== "concessionario") {
      redirect("/login.html");
      return;
    }
    localStorage.setItem("tipoUtente", "concessionario");
  }

  function requirePartner() {
    const token = localStorage.getItem("partnerToken");
    const ruolo = getTipoUtente();

    if (!token || ruolo !== "partner") {
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

    if (!token || (ruolo !== "concessionario" && ruolo !== "privato")) {
      redirect("/login.html");
      return;
    }
    localStorage.setItem("tipoUtente", ruolo);
  }

  function requireAuth() {
    if (!getToken()) {
      redirect("/login.html");
    }
  }

  function requireAdmin() {
    const token = localStorage.getItem("adminToken");
    const ruolo = getTipoUtente();

    if (!token || ruolo !== "admin") {
      redirect("/admin.html");
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
