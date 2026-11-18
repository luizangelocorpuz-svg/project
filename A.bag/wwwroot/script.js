
(() => {
  "use strict";

  // =========================================================
  // SPORTSHUB - LANDING PAGE, DEMO LOGIN, AND ADMIN DASHBOARD
  // =========================================================

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const SESSION_KEY = "sportshub-demo-session";

  let supabaseClient = null;
  let supabaseSetupError =
    "Supabase is not configured. Set Supabase:Url and Supabase:PublishableKey in appsettings.json.";

  function getSupabaseSetupError() {
    return supabaseSetupError;
  }

  async function configureSupabase() {
    const response = await fetch("/api/config", {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`App configuration request failed (${response.status}).`);
    }

    const config = await response.json();
    const url = config.supabaseUrl?.trim();
    const publishableKey = config.supabasePublishableKey?.trim();

    if (!url || !publishableKey) return;

    if (!window.supabase?.createClient) {
      supabaseSetupError =
        "The Supabase JavaScript library did not load. Check your internet connection and try again.";
      return;
    }

    supabaseClient = window.supabase.createClient(url, publishableKey);
  }

  // Demo-only credentials. Do not use these for a real website.
  const DEMO_USERNAME = "admin";
  const DEMO_PASSWORD = "admin123";

  const landingPage = $("#home");
  const loginModal = $("#login-modal");
  const loginForm = $("#login-form");
  const signupForm = $("#signup-form");
  const loginError = $("#login-error");
  const loginStatus = $("#login-status");
  const signupError = $("#signup-error");
  const adminApp = $("#admin-app");

  const today = () => {
    const date = new Date();
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().slice(0, 10);
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return escapeHTML(dateString);
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  // ---------------------------------------------------------
  // LANDING PAGE
  // ---------------------------------------------------------

  function setupLandingPage() {
    const menuToggle = $(".menu-toggle");
    const navMenu = $(".nav-menu");
    const loginButton = $(".login-button");
    const currentYear = $("#current-year");
    const revealElements = $$(".reveal");

    if (currentYear) {
      currentYear.textContent = String(new Date().getFullYear());
    }

    // Mobile navigation
    if (menuToggle && navMenu) {
      menuToggle.addEventListener("click", () => {
        const isExpanded =
          menuToggle.getAttribute("aria-expanded") === "true";

        menuToggle.setAttribute("aria-expanded", String(!isExpanded));
        menuToggle.setAttribute(
          "aria-label",
          isExpanded ? "Open navigation menu" : "Close navigation menu"
        );

        navMenu.classList.toggle("is-open", !isExpanded);
      });

      $$("a", navMenu).forEach((link) => {
        link.addEventListener("click", () => {
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.setAttribute("aria-label", "Open navigation menu");
          navMenu.classList.remove("is-open");
        });
      });
    }

    // Login button opens the login modal instead of showing an alert.
    if (loginButton) {
      loginButton.addEventListener("click", openLogin);
    }

    // Reveal animations
    const prefersReducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
      prefersReducedMotion ||
      !("IntersectionObserver" in window)
    ) {
      revealElements.forEach((element) => {
        element.classList.add("is-visible");
      });
    } else {
      document.documentElement.classList.add("has-reveal");

      const observer = new IntersectionObserver(
        (entries, currentObserver) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              currentObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );

      revealElements.forEach((element) => observer.observe(element));
    }
  }

  // ---------------------------------------------------------
  // LOGIN MODAL
  // ---------------------------------------------------------

  function openLogin() {
    if (!loginModal) return;

    loginModal.setAttribute("aria-hidden", "false");
    loginModal.classList.add("is-open");

    showAuthView("login");

    document.body.classList.add("login-open");

    window.setTimeout(() => {
      $("#admin-username")?.focus();
    }, 50);
  }

  function closeLogin() {
    if (!loginModal) return;

    loginModal.setAttribute("aria-hidden", "true");
    loginModal.classList.remove("is-open");
    document.body.classList.remove("login-open");

    if (loginForm) loginForm.reset();
    if (signupForm) signupForm.reset();
    showAuthView("login");

    if (loginError) {
      loginError.textContent = "";
      loginError.classList.remove("visible");
    }

    if (loginStatus) {
      loginStatus.textContent = "";
      loginStatus.classList.remove("visible");
    }

    if (signupError) {
      signupError.textContent = "";
      signupError.classList.remove("visible");
    }

    resetPasswordVisibility();
  }

  function showAuthView(view) {
    const showLogin = view === "login";
    $("#login-view").hidden = !showLogin;
    $("#signup-view").hidden = showLogin;
    $(".login-panel").setAttribute(
      "aria-labelledby",
      showLogin ? "login-title" : "signup-title"
    );

    if (loginError) {
      loginError.textContent = "";
      loginError.classList.remove("visible");
    }

    if (signupError) {
      signupError.textContent = "";
      signupError.classList.remove("visible");
    }

    if (loginStatus) {
      loginStatus.textContent = "";
      loginStatus.classList.remove("visible");
    }
  }

  function showLoginError(message) {
    if (!loginError) {
      window.alert(message);
      return;
    }

    loginError.textContent = message;
    loginError.classList.add("visible");
  }

  function showSignupError(message) {
    signupError.textContent = message;
    signupError.classList.add("visible");
  }

  function showLoginStatus(message) {
    loginStatus.textContent = message;
    loginStatus.classList.add("visible");
  }

  function setAccountSignedIn(isSignedIn) {
    const loginButton = $(".login-button");
    const logoutButton = $("#account-logout-button");

    if (loginButton) loginButton.hidden = isSignedIn;
    if (logoutButton) logoutButton.hidden = !isSignedIn;
  }

  function resetPasswordVisibility() {
    $$("[data-password-target]").forEach((button) => {
      const input = $(`#${button.dataset.passwordTarget}`);
      if (input) input.type = "password";
      button.textContent = "Show";
      button.setAttribute("aria-label", "Show password");
      button.setAttribute("aria-pressed", "false");
    });
  }

  $$("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(`#${button.dataset.passwordTarget}`);
      if (!input) return;

      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.textContent = shouldShow ? "Hide" : "Show";
      button.setAttribute(
        "aria-label",
        shouldShow ? "Hide password" : "Show password"
      );
      button.setAttribute("aria-pressed", String(shouldShow));
    });
  });

  $("#show-signup")?.addEventListener("click", () => {
    showAuthView("signup");
    window.setTimeout(() => $("#signup-full-name")?.focus(), 0);
  });

  $("#show-login")?.addEventListener("click", () => {
    showAuthView("login");
    window.setTimeout(() => $("#admin-username")?.focus(), 0);
  });

  async function login(event) {
    event.preventDefault();

    const emailOrUsername = $("#admin-username")?.value.trim() ?? "";
    const password = $("#admin-password")?.value ?? "";

    if (
      emailOrUsername === DEMO_USERNAME &&
      password === DEMO_PASSWORD
    ) {
      // This flag is for a local demonstration only.
      sessionStorage.setItem(SESSION_KEY, "true");

      closeLogin();
      showDashboard();
      showToast("Demo login successful.");

      return;
    }

    if (!supabaseClient) {
      showLoginError(getSupabaseSetupError());
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrUsername)) {
      showLoginError("Enter the email address used to create your account.");
      return;
    }

    const submitButton = $("#login-form button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailOrUsername,
        password
      });

      if (error) throw error;

      setAccountSignedIn(Boolean(data.user));
      closeLogin();
      showLandingPage();
      showToast(
        "Signed in. Registered accounts do not have administrator dashboard access."
      );
    } catch (error) {
      showLoginError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please check your connection and try again."
      );
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Sign in <span aria-hidden="true">↗</span>';
    }
  }

  async function signup(event) {
    event.preventDefault();

    const fullName = $("#signup-full-name").value.trim();
    const email = $("#signup-email").value.trim().toLowerCase();
    const username = $("#signup-username").value.trim();
    const password = $("#signup-password").value;
    const confirmPassword = $("#signup-confirm-password").value;

    if (!fullName || !email || !username || !password || !confirmPassword) {
      showSignupError("Complete all fields to create your account.");
      return;
    }

    if (password !== confirmPassword) {
      showSignupError("The passwords do not match.");
      return;
    }

    if (!supabaseClient) {
      showSignupError(getSupabaseSetupError());
      return;
    }

    const submitButton = $("#signup-form button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;

      signupForm.reset();
      resetPasswordVisibility();

      if (data.session && data.user) {
        setAccountSignedIn(true);
        closeLogin();
        showLandingPage();
        showToast(
          "Account created and signed in. Administrator dashboard access is restricted."
        );
        return;
      }

      showAuthView("login");
      $("#admin-username").value = email;
      showLoginStatus(
        "Account created. Check your email to confirm the address, then sign in."
      );
    } catch (error) {
      showSignupError(
        error instanceof Error
          ? error.message
          : "Unable to create your account. Please try again."
      );
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML =
        'Create account <span aria-hidden="true">↗</span>';
    }
  }

  // Close modal when clicking its close button or backdrop.
  $$("[data-close-login]").forEach((element) => {
    element.addEventListener("click", closeLogin);
  });

  if (loginForm) {
    loginForm.addEventListener("submit", login);
  }

  if (signupForm) {
    signupForm.addEventListener("submit", signup);
  }

  async function signOutAccount() {
    const logoutButton = $("#account-logout-button");
    if (logoutButton) logoutButton.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      setAccountSignedIn(false);
      showToast("You have logged out.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to log out. Please try again.";
      console.error("Supabase sign-out failed:", error);
      showToast(`Sign out failed: ${message}`);
    } finally {
      if (logoutButton) logoutButton.disabled = false;
    }
  }

  $("#account-logout-button")?.addEventListener("click", signOutAccount);

  function initializeSupabaseAuth() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      setAccountSignedIn(Boolean(session?.user));
    });

    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Unable to restore the Supabase session:", error);
        showToast("Unable to restore your account session. Please sign in again.");
        return;
      }

      setAccountSignedIn(Boolean(data.session?.user));
    }).catch((error) => {
      console.error("Unable to restore the Supabase session:", error);
      showToast("Unable to restore your account session. Please sign in again.");
    });
  }

  let data = { equipment: [] };
  let editingEquipmentId = null;

  function normalizeEquipment(item) {
    return {
      id: String(item.id),
      name: item.name,
      category: item.category,
      quantity: Number(item.quantity),
      condition: item.condition,
      availability: item.status
    };
  }

  async function requestEquipment(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });

    if (!response.ok) {
      let message = `Equipment request failed (${response.status}).`;
      try {
        const error = await response.json();
        if (error.error) message = error.error;
      } catch {
        // Keep the HTTP status message when the server does not return JSON.
      }
      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  async function loadEquipment() {
    const records = await requestEquipment("/api/equipment");
    if (!Array.isArray(records)) {
      throw new Error("The equipment endpoint returned an invalid response.");
    }

    data.equipment = records.map(normalizeEquipment);
    renderDashboard();
  }

  // ---------------------------------------------------------
  // DASHBOARD DISPLAY AND NAVIGATION
  // ---------------------------------------------------------

  function showDashboard() {
    if (!adminApp) return;

    if (landingPage) {
      landingPage.closest("main")?.setAttribute("hidden", "");
      $(".site-header")?.setAttribute("hidden", "");
      $(".site-footer")?.setAttribute("hidden", "");
    }

    adminApp.hidden = false;

    renderDashboard();
    showPage("overview");
    loadEquipment().catch((error) => {
      console.error("Unable to load equipment from the database:", error);
      showToast(error.message || "Unable to load equipment from the database.");
    });

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showLandingPage() {
    if (adminApp) adminApp.hidden = true;

    if (landingPage) {
      landingPage.closest("main")?.removeAttribute("hidden");
      $(".site-header")?.removeAttribute("hidden");
      $(".site-footer")?.removeAttribute("hidden");
    }
  }

  function showPage(pageName) {
    const allowedPages = [
      "overview",
      "inventory",
      "facilities",
      "borrowings",
      "maintenance"
    ];

    if (!allowedPages.includes(pageName)) return;

    $$(".admin-page").forEach((page) => {
      page.hidden = page.id !== `page-${pageName}`;
    });

    $$(".admin-nav-link").forEach((button) => {
      const active = button.dataset.page === pageName;

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    const titles = {
      overview: "Overview",
      inventory: "Equipment Inventory",
      facilities: "Facility Schedule",
      borrowings: "Borrowing & Returns",
      maintenance: "Maintenance"
    };

    const pageTitle = $("#page-title");

    if (pageTitle) {
      pageTitle.textContent = titles[pageName];
    }

    renderDashboard();
  }

  $$(".admin-nav-link").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  $$("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.goto);
    });
  });

  // ---------------------------------------------------------
  // DASHBOARD STATISTICS
  // ---------------------------------------------------------

  function renderDashboard() {
    const equipment = data.equipment;

    const totalQuantity = equipment.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const availableQuantity = equipment
      .filter((item) => item.availability === "Available")
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const borrowedQuantity = equipment
      .filter((item) => item.availability === "Borrowed")
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const maintenanceCount = equipment.filter(
      (item) =>
        item.availability === "Maintenance" ||
        item.condition === "Needs repair" ||
        item.condition === "Damaged"
    ).length;

    setText("#stat-equipment", totalQuantity);
    setText("#stat-facilities", "4");
    setText("#stat-borrowings", borrowedQuantity);
    setText("#stat-maintenance", maintenanceCount);

    setText("#available-count", availableQuantity);
    setText("#borrowed-count", borrowedQuantity);
    setText(
      "#repair-count",
      equipment
        .filter((item) => item.availability === "Maintenance")
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    );

    setText("#dashboard-year", new Date().getFullYear());

    renderEquipment();
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = String(value);
  }

  // ---------------------------------------------------------
  // EQUIPMENT INVENTORY
  // ---------------------------------------------------------

  function renderEquipment() {
    const tableBody = $("#inventory-table-body");
    const searchInput = $("#inventory-search");
    const countLabel = $("#inventory-count");
    const emptyMessage = $("#inventory-empty");

    if (!tableBody) return;

    const search = (searchInput?.value ?? "").trim().toLowerCase();

    const filtered = data.equipment.filter((item) => {
      return [
        item.name,
        item.category,
        item.condition,
        item.availability
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(search)
      );
    });

    tableBody.innerHTML = filtered.map((item) => {
      const statusClass =
        item.availability === "Available"
          ? "good"
          : item.availability === "Maintenance"
            ? "repair"
            : "booked";

      const conditionClass =
        item.condition === "Good"
          ? "good"
          : item.condition === "Fair"
            ? "booked"
            : "repair";

      return `
        <tr>
          <td>
            <strong>${escapeHTML(item.name)}</strong>
          </td>
          <td>${escapeHTML(item.category)}</td>
          <td>${escapeHTML(item.quantity)}</td>
          <td>
            <span class="pill-status ${conditionClass}">
              ${escapeHTML(item.condition)}
            </span>
          </td>
          <td>
            <span class="pill-status ${statusClass}">
              ${escapeHTML(item.availability)}
            </span>
          </td>
          <td>
            <button
              class="small-action"
              type="button"
              data-edit-equipment="${escapeHTML(item.id)}"
            >Edit</button>
            <button
              class="small-action danger-action"
              type="button"
              data-delete-equipment="${escapeHTML(item.id)}"
            >Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    if (countLabel) {
      countLabel.textContent =
        `${filtered.length} ${filtered.length === 1 ? "item" : "items"}`;
    }

    if (emptyMessage) {
      emptyMessage.hidden = filtered.length > 0;
    }
  }

  const equipmentForm = $("#equipment-form");

  function openEquipmentForm(item = null) {
    if (!equipmentForm) return;

    editingEquipmentId = item ? item.id : null;

    setText(
      "#equipment-form-title",
      item ? "Edit equipment" : "Add equipment"
    );

    $("#equipment-name").value = item?.name ?? "";
    $("#equipment-category").value = item?.category ?? "";
    $("#equipment-quantity").value = item?.quantity ?? 1;
    $("#equipment-condition").value = item?.condition ?? "Good";

    equipmentForm.hidden = false;

    $("#equipment-name")?.focus();
    equipmentForm.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function closeEquipmentForm() {
    if (!equipmentForm) return;

    equipmentForm.reset();
    equipmentForm.hidden = true;
    editingEquipmentId = null;
  }

  $("#add-equipment-button")?.addEventListener("click", () => {
    openEquipmentForm();
  });

  $("#cancel-equipment")?.addEventListener("click", closeEquipmentForm);

  $("#inventory-search")?.addEventListener("input", renderEquipment);

  if (equipmentForm) {
    equipmentForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = $("#equipment-name").value.trim();
      const category = $("#equipment-category").value.trim();
      const quantity = Number($("#equipment-quantity").value);
      const condition = $("#equipment-condition").value;

      if (!name || !category || !Number.isInteger(quantity) || quantity < 1) {
        showToast("Enter a name, category, and valid quantity.");
        return;
      }

      const existing = editingEquipmentId
        ? data.equipment.find((item) => item.id === editingEquipmentId)
        : null;

      if (editingEquipmentId && !existing) {
        showToast("That equipment record could not be found.");
        closeEquipmentForm();
        return;
      }

      const availability = condition === "Needs repair"
        ? "Maintenance"
        : existing?.availability === "Maintenance"
          ? "Available"
          : existing?.availability ?? "Available";
      const saveButton = $("#equipment-form button[type='submit']");
      saveButton.disabled = true;

      try {
        const saved = await requestEquipment(
          existing
            ? `/api/equipment/${encodeURIComponent(existing.id)}`
            : "/api/equipment",
          {
            method: existing ? "PUT" : "POST",
            body: JSON.stringify({
              name,
              category,
              quantity,
              condition,
              status: availability
            })
          }
        );

        if (existing) {
          data.equipment = data.equipment.map((item) =>
            item.id === existing.id ? normalizeEquipment(saved) : item
          );
          showToast("Equipment updated.");
        } else {
          data.equipment.unshift(normalizeEquipment(saved));
          showToast("Equipment added.");
        }

        closeEquipmentForm();
        renderDashboard();
      } catch (error) {
        console.error("Unable to save equipment:", error);
        showToast(error.message || "Unable to save equipment.");
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-equipment]");

    if (editButton) {
      const item = data.equipment.find(
        (equipment) =>
          equipment.id === editButton.dataset.editEquipment
      );

      if (item) openEquipmentForm(item);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-equipment]");

    if (deleteButton) {
      const item = data.equipment.find(
        (equipment) =>
          equipment.id === deleteButton.dataset.deleteEquipment
      );

      if (!item) return;

      const confirmed = window.confirm(
        `Delete "${item.name}" from the equipment inventory?`
      );

      if (!confirmed) return;

      requestEquipment(`/api/equipment/${encodeURIComponent(item.id)}`, {
        method: "DELETE"
      }).then(() => {
        data.equipment = data.equipment.filter(
          (equipment) => equipment.id !== item.id
        );

        renderDashboard();
        showToast("Equipment deleted.");
      }).catch((error) => {
        console.error("Unable to delete equipment:", error);
        showToast(error.message || "Unable to delete equipment.");
      });
    }
  });

  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);

    closeEquipmentForm();
    closeLogin();
    showLandingPage();

    showToast("You have logged out.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$(".logout-button, #logout-button-mobile").forEach((button) => {
    button.addEventListener("click", logout);
  });

  // ---------------------------------------------------------
  // TOAST MESSAGE
  // ---------------------------------------------------------

  let toastTimeout;

  function showToast(message) {
    let toast = $("#sportshub-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sportshub-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      Object.assign(toast.style, {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "99999",
        maxWidth: "calc(100vw - 40px)",
        padding: "13px 18px",
        borderRadius: "10px",
        background: "#202820",
        color: "#ffffff",
        fontSize: "14px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
        opacity: "0",
        transform: "translateY(8px)",
        transition: "opacity 180ms ease, transform 180ms ease"
      });

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    window.clearTimeout(toastTimeout);

    toastTimeout = window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
    }, 2600);
  }

  // ---------------------------------------------------------
  // KEYBOARD SUPPORT
  // ---------------------------------------------------------

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLogin();
      closeEquipmentForm();
    }
  });

  // ---------------------------------------------------------
  // STARTUP
  // ---------------------------------------------------------

  setupLandingPage();
  configureSupabase()
    .then(initializeSupabaseAuth)
    .catch((error) => {
      console.error("Unable to load Supabase configuration:", error);
      supabaseSetupError =
        "Unable to load app configuration. Start the app through its ASP.NET Core server and try again.";
    });

  // Allow the demo dashboard to remain open during this browser tab's
  // session if the page is refreshed after logging in.
  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    showDashboard();
  } else {
    showLandingPage();
  }
})();
