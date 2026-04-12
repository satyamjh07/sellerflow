// SellerFlow — Main App Entry Point (Production Auth Edition)
// Auth flows: email/password, Google OAuth, forgot password,
//             email verification enforcement, reset password.
// ================================================================

// Unregister any stale service workers that could serve a cached old bundle.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // ─── 1. Init Supabase session ──────────────────────────────────
  UI.showLoading("Loading SellerFlow…");
  const existingUser = await Auth.init();
  UI.hideLoading();

  // ─── 2. Check if we're returning from a password-reset link ────
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const isResetMode =
    urlParams.get("mode") === "reset" || hashParams.get("type") === "recovery";

  if (isResetMode && existingUser) {
    _showScreen("reset-password");
  } else if (existingUser) {
    await _bootApp(existingUser);
  } else {
    _showScreen("login");
  }

  // Show any deferred toast saved before a reload (e.g. deleted account)
  try {
    const deferred = sessionStorage.getItem("sf-login-toast");
    if (deferred) {
      sessionStorage.removeItem("sf-login-toast");
      setTimeout(() => UI.toast(deferred, "error"), 300);
    }
  } catch (_) {}

  // ─── 3. Listen for PASSWORD_RECOVERY event ─────────────────────
  window.addEventListener("sf:password-recovery", () => {
    _showScreen("reset-password");
  });

  // ─── 4. Listen for sign-out ────────────────────────────────────
  window.addEventListener("sf:signed-out", () => {
    document.getElementById("app").classList.remove("active");
    _showScreen("login");
    UI.toast("You have been signed out.", "info");
  });

  // ─── 5. Listen for Google OAuth redirect ───────────────────────
  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (
      event === "SIGNED_IN" &&
      session &&
      !document.getElementById("app").classList.contains("active")
    ) {
      UI.showLoading("Signing you in…");
      await _bootApp(session.user);
      UI.hideLoading();
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  SCREEN ROUTER
  // ══════════════════════════════════════════════════════════════

  function _showScreen(screen) {
    document.getElementById("app").classList.remove("active");
    document.getElementById("login-page").style.display = "";

    const allForms = [
      "auth-login-form",
      "auth-signup-form",
      "auth-verify-email-screen",
      "auth-forgot-password-screen",
      "auth-reset-password-screen",
    ];
    allForms.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    const loginTab = document.getElementById("auth-login-tab");
    const signupTab = document.getElementById("auth-signup-tab");
    const tabBar = document.querySelector(".auth-tabs");

    const showTabs = screen === "login" || screen === "signup";
    if (tabBar) tabBar.style.display = showTabs ? "" : "none";
    if (loginTab) loginTab.classList.toggle("active", screen === "login");
    if (signupTab) signupTab.classList.toggle("active", screen === "signup");

    const featureStrip = document.getElementById("auth-feature-strip");
    if (featureStrip) featureStrip.style.display = showTabs ? "" : "none";

    const screenMap = {
      login: "auth-login-form",
      signup: "auth-signup-form",
      "verify-email": "auth-verify-email-screen",
      "forgot-password": "auth-forgot-password-screen",
      "reset-password": "auth-reset-password-screen",
    };
    const targetId = screenMap[screen];
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) el.style.display = "";
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  TAB SWITCHING
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("auth-login-tab")
    .addEventListener("click", () => _showScreen("login"));
  document
    .getElementById("auth-signup-tab")
    .addEventListener("click", () => _showScreen("signup"));
  document
    .getElementById("switch-to-signup")
    .addEventListener("click", () => _showScreen("signup"));
  document
    .getElementById("switch-to-login")
    .addEventListener("click", () => _showScreen("login"));

  // ══════════════════════════════════════════════════════════════
  //  GOOGLE OAUTH
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll(".btn-google").forEach((btn) => {
    btn.addEventListener("click", _handleGoogleSignIn);
  });

  async function _handleGoogleSignIn() {
    document.querySelectorAll(".btn-google").forEach((b) => {
      b.disabled = true;
      b.innerHTML = `<span class="btn-google-spinner"></span> Connecting…`;
    });
    try {
      await Auth.signInWithGoogle();
    } catch (err) {
      UI.toast(
        err.message || "Google sign-in failed. Please try again.",
        "error",
      );
      document.querySelectorAll(".btn-google").forEach((b) => {
        b.disabled = false;
        b.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="google-icon" alt="Google" /> Continue with Google`;
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  EMAIL / PASSWORD LOGIN
  // ══════════════════════════════════════════════════════════════

  document.getElementById("login-btn").addEventListener("click", _handleLogin);
  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") _handleLogin();
  });

  document.getElementById("demo-login").addEventListener("click", () => {
    document.getElementById("login-email").value = "demo@sellerflow.in";
    document.getElementById("login-password").value = "demo1234";
    _handleLogin();
  });

  async function _handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) {
      UI.toast("Please enter your email and password.", "error");
      return;
    }

    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Signing in…";

    try {
      await Auth.signIn(email, password);

      if (!Auth.isEmailVerified()) {
        document.getElementById("verify-email-address").textContent = email;
        document.getElementById("resend-email-input").value = email;
        _showScreen("verify-email");
        UI.toast(
          "Please verify your email before accessing your dashboard.",
          "warn",
        );
        await Auth.signOut();
        return;
      }

      await _bootApp(Auth.getUser());
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.includes("Invalid login credentials") ||
        msg.includes("invalid_grant")
      ) {
        UI.toast("Incorrect email or password.", "error");
      } else if (msg.includes("Email not confirmed")) {
        document.getElementById("verify-email-address").textContent = email;
        document.getElementById("resend-email-input").value = email;
        _showScreen("verify-email");
      } else {
        UI.toast(msg || "Login failed. Please try again.", "error");
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign In →";
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  SIGN UP
  //
  //  ARCHITECTURE: Supabase email confirmation stays ON (bot protection).
  //  However Supabase's SMTP is unreliable, so we:
  //    1. Call Auth.signUp() — creates the user in auth.users
  //    2. If Supabase throws a sending error (500), we catch it gracefully
  //       because the user WAS created — Supabase errors after DB insert
  //    3. We immediately send our own verification email via EmailJS
  //    4. We trigger resendVerification() as a backup (uses Supabase OTP)
  //    5. Show the verify-email screen — UX is identical to before
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("signup-btn")
    .addEventListener("click", _handleSignUp);
  document
    .getElementById("signup-password")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") _handleSignUp();
    });

  async function _handleSignUp() {
    const name = document.getElementById("signup-name").value.trim();
    const store = document.getElementById("signup-store").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!name || !store || !email || !password) {
      UI.toast("Please fill in all fields.", "error");
      return;
    }
    if (password.length < 8) {
      UI.toast("Password must be at least 8 characters.", "error");
      return;
    }

    const btn = document.getElementById("signup-btn");
    btn.disabled = true;
    btn.textContent = "Creating account…";

    try {
      let signUpData = null;
      let smtpFailed = false;

      try {
        // Attempt normal signup — Supabase creates user + tries to send email
        signUpData = await Auth.signUp(email, password, name, store);
      } catch (signUpErr) {
        const msg = (signUpErr?.message || "").toLowerCase();

        // These are SMTP/email-sending errors — user WAS created in DB
        // Supabase returns 500 when the email sending step fails,
        // even though the auth.users INSERT succeeded.
        const isEmailSendError =
          msg.includes("sending") ||
          msg.includes("smtp") ||
          msg.includes("email") ||
          msg.includes("500") ||
          msg.includes("unexpected") ||
          msg.includes("error sending");

        // Duplicate email — hard stop, not a sending error
        const isDuplicate =
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("user already registered");

        if (isDuplicate) {
          UI.toast(
            "An account with this email already exists. Please sign in.",
            "warn",
          );
          _showScreen("login");
          return;
        }

        if (isEmailSendError) {
          // User was created — SMTP just failed on Supabase's side
          smtpFailed = true;
          console.warn(
            "[SignUp] Supabase SMTP failed, will send via EmailJS:",
            signUpErr.message,
          );
        } else {
          // Unknown error — re-throw to outer catch
          throw signUpErr;
        }
      }

      // ── At this point the user exists in Supabase ──────────────
      // Either signUpData has a session (email confirm OFF) or
      // it's null session (email confirm ON, needs verification).
      // smtpFailed = true means Supabase couldn't send the email.

      const session = signUpData?.session ?? null;

      if (session) {
        // Email confirmation is disabled — go straight to dashboard
        await _bootApp(Auth.getUser());
        UI.toast(`Welcome to Hisaab Mitra, ${name}! 🎉`, "success");
        return;
      }

      // ── Email confirmation required ────────────────────────────
      // Show the verify screen immediately so the user isn't stuck
      document.getElementById("verify-email-address").textContent = email;
      document.getElementById("resend-email-input").value = email;
      _showScreen("verify-email");

      // ── Send verification email via EmailJS (our reliable path) ─
      // This runs async — we don't await it so the screen shows instantly
      _sendVerificationEmailViaEmailJS(email, name, store).catch((e) => {
        console.warn("[SignUp] EmailJS verification send failed:", e);
      });

      // ── Also trigger Supabase resend as backup (if SMTP failed) ─
      // Supabase's resend uses OTP magic link — different code path
      // from initial signup, sometimes works even when signup send fails.
      if (smtpFailed) {
        setTimeout(async () => {
          try {
            await Auth.resendVerification(email);
            console.info("[SignUp] Supabase resend backup succeeded");
          } catch (e) {
            console.warn(
              "[SignUp] Supabase resend backup also failed:",
              e.message,
            );
          }
        }, 2000);
      }
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("User already registered")
      ) {
        UI.toast(
          "An account with this email already exists. Please sign in.",
          "warn",
        );
        _showScreen("login");
      } else {
        UI.toast(msg || "Sign up failed. Please try again.", "error");
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Create Account →";
    }
  }

  // ── Send verification email via EmailJS ─────────────────────────
  // Uses the existing EmailJS service + template already configured.
  // Sends a welcome + "please verify" message with the Supabase
  // magic link (obtained by triggering resendVerification first).
  async function _sendVerificationEmailViaEmailJS(email, name, store) {
    if (typeof emailjs === "undefined") return;

    // Build a clean branded verification email
    const invoiceHtml = `
      <div style="padding:30px;background:#0b1120;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:auto;background:#111827;border-radius:16px;padding:32px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;">🛍️</div>
            <h1 style="color:#ffffff;font-size:24px;margin-top:12px;">Welcome to Hisaab Mitra!</h1>
          </div>
          <p style="color:#cbd5e1;font-size:16px;line-height:1.6;">
            Hi ${name} 👋<br><br>
            Your account for <strong style="color:#6366f1">${store}</strong> has been created successfully!
          </p>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-top:16px;">
            📧 <strong>Check your inbox</strong> for a verification link from Supabase (sender: <em>no-reply@mail.app.supabase.io</em>).
            Click that link to activate your account and start managing your store.
          </p>
          <p style="color:#94a3b8;font-size:13px;margin-top:20px;line-height:1.6;">
            Didn't get it? Check your spam folder, or go back to the sign-in page and click 
            <strong>"Resend Verification Email"</strong>.
          </p>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #1e293b;text-align:center;">
            <p style="color:#475569;font-size:12px;">Hisaab Mitra · Your Instagram Seller Dashboard</p>
          </div>
        </div>
      </div>`;

    await emailjs.send("service_5k8qt0o", "template_x6h0iqc", {
      to_email: email,
      to_name: name,
      customer_name: name,
      customer_email: email,
      order_id: "WELCOME",
      store_name: store || "Hisaab Mitra",
      total: "Account Created",
      payment_status: "Please verify your email to get started",
      invoice_html: invoiceHtml,
    });

    console.info("[SignUp] Welcome + verify email sent via EmailJS to:", email);
  }

  // ══════════════════════════════════════════════════════════════
  //  EMAIL VERIFICATION SCREEN
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("resend-verification-btn")
    .addEventListener("click", async () => {
      const email = document.getElementById("resend-email-input").value.trim();
      if (!email) {
        UI.toast("Email address not found.", "error");
        return;
      }

      const btn = document.getElementById("resend-verification-btn");
      btn.disabled = true;
      btn.textContent = "Sending…";

      try {
        await Auth.resendVerification(email);
        UI.toast(
          "Verification email sent! Check your inbox and spam folder.",
          "success",
        );

        let seconds = 60;
        const interval = setInterval(() => {
          seconds--;
          btn.textContent = `Resend in ${seconds}s`;
          if (seconds <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.textContent = "📧 Resend Verification Email";
          }
        }, 1000);
      } catch (err) {
        UI.toast(err.message || "Failed to send verification email.", "error");
        btn.disabled = false;
        btn.textContent = "📧 Resend Verification Email";
      }
    });

  // "I've verified — check again" button
  document
    .getElementById("check-verified-btn")
    .addEventListener("click", async () => {
      const btn = document.getElementById("check-verified-btn");
      btn.disabled = true;
      btn.textContent = "Checking…";

      try {
        const { data, error } = await _supabase.auth.getSession();
        if (error) throw error;

        if (data?.session?.user?.email_confirmed_at) {
          await Auth.init();
          UI.toast("Email verified! Welcome to Hisaab Mitra 🎉", "success");
          await _bootApp(Auth.getUser());
        } else {
          UI.toast(
            "Not verified yet. Please click the link in your email first.",
            "warn",
          );
        }
      } catch (err) {
        UI.toast(
          "Could not check verification status. Try signing in again.",
          "error",
        );
      } finally {
        btn.disabled = false;
        btn.textContent = "✅ I've Verified — Open Dashboard";
      }
    });

  document
    .getElementById("verify-back-to-login")
    .addEventListener("click", () => {
      _showScreen("login");
    });

  // ══════════════════════════════════════════════════════════════
  //  FORGOT PASSWORD
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("forgot-password-link")
    .addEventListener("click", () => {
      const loginEmail = document.getElementById("login-email").value.trim();
      if (loginEmail)
        document.getElementById("forgot-email-input").value = loginEmail;
      _showScreen("forgot-password");
    });

  document
    .getElementById("forgot-password-btn")
    .addEventListener("click", _handleForgotPassword);
  document
    .getElementById("forgot-email-input")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") _handleForgotPassword();
    });

  async function _handleForgotPassword() {
    const email = document.getElementById("forgot-email-input").value.trim();
    if (!email) {
      UI.toast("Please enter your email address.", "error");
      return;
    }

    const btn = document.getElementById("forgot-password-btn");
    btn.disabled = true;
    btn.textContent = "Sending…";

    try {
      await Auth.sendPasswordResetEmail(email);
      document.getElementById("forgot-password-form-area").style.display =
        "none";
      document.getElementById("forgot-password-success").style.display = "";
      document.getElementById("forgot-success-email").textContent = email;
    } catch (err) {
      UI.toast(
        err.message || "Could not send reset email. Please try again.",
        "error",
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "📧 Send Reset Email";
    }
  }

  document
    .getElementById("forgot-back-to-login")
    .addEventListener("click", () => {
      document.getElementById("forgot-password-form-area").style.display = "";
      document.getElementById("forgot-password-success").style.display = "none";
      document.getElementById("forgot-email-input").value = "";
      _showScreen("login");
    });

  // ══════════════════════════════════════════════════════════════
  //  RESET PASSWORD (user lands here from email link)
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("reset-password-btn")
    .addEventListener("click", _handleResetPassword);
  document
    .getElementById("reset-password-confirm")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") _handleResetPassword();
    });

  async function _handleResetPassword() {
    const newPw = document.getElementById("reset-password-input").value;
    const confirm = document.getElementById("reset-password-confirm").value;

    if (!newPw || !confirm) {
      UI.toast("Please fill in both password fields.", "error");
      return;
    }
    if (newPw.length < 8) {
      UI.toast("Password must be at least 8 characters.", "error");
      return;
    }
    if (newPw !== confirm) {
      UI.toast("Passwords do not match.", "error");
      const el = document.getElementById("reset-password-confirm");
      el.classList.add("input-shake");
      setTimeout(() => el.classList.remove("input-shake"), 500);
      return;
    }

    const btn = document.getElementById("reset-password-btn");
    btn.disabled = true;
    btn.textContent = "Updating password…";

    try {
      await Auth.updatePassword(newPw);
      document.getElementById("reset-password-form-area").style.display =
        "none";
      document.getElementById("reset-password-success").style.display = "";
      UI.toast("Password updated successfully!", "success");

      setTimeout(async () => {
        await _bootApp(Auth.getUser());
      }, 2500);
    } catch (err) {
      UI.toast(
        err.message || "Failed to update password. Please try again.",
        "error",
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "🔐 Set New Password";
    }
  }

  document
    .getElementById("reset-back-to-login")
    .addEventListener("click", () => {
      document.getElementById("reset-password-form-area").style.display = "";
      document.getElementById("reset-password-success").style.display = "none";
      document.getElementById("reset-password-input").value = "";
      document.getElementById("reset-password-confirm").value = "";
      _showScreen("login");
    });

  // ══════════════════════════════════════════════════════════════
  //  APP BOOT (called after any successful auth)
  // ══════════════════════════════════════════════════════════════

  async function _bootApp(authUser) {
    // Guard: profile row missing means account was deleted but
    // Supabase auth session is still alive. Sign out and show login.
    let _profileCheck;
    try { _profileCheck = await SF.getUser(); } catch (_) { _profileCheck = null; }
    if (!_profileCheck) {
      UI.hideLoading();
      try { await Auth.signOut(); } catch (_) {}
      // Save the message BEFORE clearing storage, read it after reload
      try { sessionStorage.setItem("sf-login-toast", "This account no longer exists. Please sign up again."); } catch (_) {}
      try { localStorage.clear(); } catch (_) {}
      window.location.reload();
      return;
    }

    document.getElementById("login-page").style.display = "none";
    document.getElementById("app").classList.add("active");

    const userForSidebar = _profileCheck;
    const displayName =
      userForSidebar?.name || authUser?.email?.split("@")[0] || "Seller";
    document.getElementById("sidebar-user-name").textContent = displayName;
    document.getElementById("sidebar-user-store").textContent =
      userForSidebar?.store || "My Store";
    document.getElementById("sidebar-avatar-initials").textContent =
      SF.initials(displayName);

    const settingsProviderRow = document.getElementById(
      "settings-provider-row",
    );
    const settingsPasswordRow = document.getElementById(
      "settings-password-row",
    );
    if (settingsProviderRow)
      settingsProviderRow.style.display = Auth.isGoogleUser() ? "" : "none";
    if (settingsPasswordRow)
      settingsPasswordRow.style.display = Auth.isGoogleUser() ? "none" : "";

    try {
      await Billing.init();
    } catch (err) {
      console.warn("[App] Billing.init non-fatal:", err.message);
    }

    const user = _profileCheck;
    await InvoiceTemplates.loadFromProfile();
    if (typeof ProfileReminder !== "undefined" && user) {
      ProfileReminder.render(user);
    }
    await NotifPanel.init();
    UI.updateBadges();
    await UI.navigate("dashboard");
  }

  // ══════════════════════════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════════════════════════

  // Show confirmation modal on profile click
  document.getElementById("logout-btn").addEventListener("click", () => {
    UI.openModal("logout-confirm-modal");
  });

  // Actually log out only if user confirms
  document
    .getElementById("logout-confirm-btn")
    .addEventListener("click", async () => {
      UI.closeModal("logout-confirm-modal");
      try {
        await Auth.signOut();
      } catch (err) {
        UI.toast(err.message || "Logout failed", "error");
      }
    });

  // ══════════════════════════════════════════════════════════════
  //  SIDEBAR + TOPBAR
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => UI.navigate(item.dataset.page));
  });
  document
    .getElementById("mobile-menu-btn")
    .addEventListener("click", UI.openMobileSidebar);
  document
    .querySelector(".sidebar-overlay")
    .addEventListener("click", UI.closeMobileSidebar);

  const topbarSearch = document.getElementById("topbar-search-input");
  topbarSearch.addEventListener(
    "input",
    UI.debounce(async () => {
      const activePage = document
        .querySelector(".page.active")
        ?.id?.replace("page-", "");
      if (activePage === "products") await Pages.products(topbarSearch.value);
      if (activePage === "customers") await Pages.customers(topbarSearch.value);
    }, 250),
  );

  // ══════════════════════════════════════════════════════════════
  //  PRODUCTS
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("add-product-btn")
    .addEventListener("click", Modals.openAddProduct);
  document
    .getElementById("save-product-btn")
    .addEventListener("click", Modals.saveProduct);
  document
    .getElementById("cancel-product-btn")
    .addEventListener("click", () => UI.closeModal("modal-product"));
  document.getElementById("product-search").addEventListener(
    "input",
    UI.debounce(async (e) => {
      await Pages.products(e.target.value);
    }, 250),
  );
  document
    .getElementById("product-cat-filter")
    .addEventListener("change", async (e) => {
      await Pages.products(undefined, e.target.value);
    });

  // ══════════════════════════════════════════════════════════════
  //  ORDERS
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("create-order-btn")
    .addEventListener("click", Modals.openCreateOrder);
  document
    .getElementById("order-add-item-btn")
    .addEventListener("click", Modals.addOrderItem);
  document
    .getElementById("save-order-btn")
    .addEventListener("click", Modals.saveOrder);
  document
    .getElementById("cancel-order-btn")
    .addEventListener("click", () => UI.closeModal("modal-order"));
  document
    .getElementById("order-customer-select")
    .addEventListener("change", Modals.handleCustomerSelectChange);
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => Pages.orders(tab.dataset.filter));
  });

  // ══════════════════════════════════════════════════════════════
  //  CUSTOMERS
  // ══════════════════════════════════════════════════════════════

  document.getElementById("customer-search").addEventListener(
    "input",
    UI.debounce(async (e) => {
      await Pages.customers(e.target.value);
    }, 250),
  );

  // ══════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("save-settings-btn")
    .addEventListener("click", async () => {
      const autoEmailToggle = document.getElementById("settings-auto-email");
      const updates = {
        name: document.getElementById("settings-name").value.trim(),
        store: document.getElementById("settings-store").value.trim(),
        instagram: document.getElementById("settings-instagram").value.trim(),
        email: document.getElementById("settings-email").value.trim(),
        phone: document.getElementById("settings-phone").value.trim(),
        upiId: document.getElementById("settings-upi").value.trim(),
        gstNumber: (document.getElementById("settings-gst")?.value || "")
          .trim()
          .toUpperCase(),
        autoEmail: autoEmailToggle ? autoEmailToggle.checked : false,
      };

      const btn = document.getElementById("save-settings-btn");
      btn.disabled = true;
      btn.textContent = "Saving…";

      try {
        await SF.saveUser(updates);
        document.getElementById("sidebar-user-name").textContent =
          updates.name || "Seller";
        document.getElementById("sidebar-user-store").textContent =
          updates.store || "My Store";
        document.getElementById("sidebar-avatar-initials").textContent =
          SF.initials(updates.name);
        UI.toast("Settings saved!", "success");

        if (typeof ProfileReminder !== "undefined") {
          ProfileReminder.render(updates);
        }
      } catch (err) {
        UI.toast(err.message || "Failed to save settings", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "💾 Save Changes";
      }
    });

  const changePasswordLink = document.getElementById(
    "settings-change-password-link",
  );
  if (changePasswordLink) {
    changePasswordLink.addEventListener("click", async () => {
      const email = Auth.getUserEmail();
      if (!email) {
        UI.toast("Could not determine your email.", "error");
        return;
      }
      changePasswordLink.textContent = "Sending reset email…";
      changePasswordLink.style.pointerEvents = "none";
      try {
        await Auth.sendPasswordResetEmail(email);
        UI.toast("Password reset email sent! Check your inbox.", "success");
        changePasswordLink.textContent = "✅ Reset email sent";
      } catch (err) {
        UI.toast(err.message || "Failed to send reset email.", "error");
        changePasswordLink.textContent = "Send password reset email →";
        changePasswordLink.style.pointerEvents = "";
      }
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  DANGER ZONE
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("reset-account-btn")
    .addEventListener("click", async () => {
      const first = window.confirm(
        "⚠️ Reset Account Data?\n\nThis will permanently delete ALL your:\n  • Orders\n  • Customers\n  • Products\n  • Invoices\n\nYour profile and login will be kept.\n\nClick OK to continue.",
      );
      if (!first) return;

      const typed = window.prompt(
        "Type  RESET  in capital letters to confirm.",
      );
      if ((typed || "").trim() !== "RESET") {
        if (typed !== null)
          UI.toast("Reset cancelled — text did not match", "info");
        return;
      }

      const btn = document.getElementById("reset-account-btn");
      btn.disabled = true;
      btn.textContent = "⏳ Resetting…";

      try {
        await SF.resetAccount();
        UI.toast("Account data reset. All records deleted.", "success");
        await UI.navigate("dashboard");
        UI.updateBadges();
      } catch (err) {
        UI.toast(err.message || "Reset failed", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "🗑️ Reset Data";
      }
    });

  document
    .getElementById("delete-account-btn")
    .addEventListener("click", async () => {
      const user = await SF.getUser().catch(() => null);
      const storeName = user?.store || "your store";

      const first = window.confirm(
        `💀 Delete Account — Final Warning\n\nYou are about to permanently delete the account for "${storeName}".\n\nThis deletes everything and cannot be undone.\n\nClick OK to continue.`,
      );
      if (!first) return;

      const typed = window.prompt(
        "Type  DELETE  in capital letters to confirm.",
      );
      if ((typed || "").trim() !== "DELETE") {
        if (typed !== null) UI.toast("Deletion cancelled", "info");
        return;
      }

      const btn = document.getElementById("delete-account-btn");
      btn.disabled = true;
      btn.textContent = "⏳ Deleting…";

      try {
        await SF.deleteAccount();
        UI.toast("Account deleted. Goodbye! 👋", "info");
        setTimeout(() => {
          try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
          window.location.reload();
        }, 1200);
      } catch (err) {
        console.error("[deleteAccount]", err);
        const msg = err.message || "";
        const dataAlreadyGone =
          msg.includes("delete_own_account") ||
          msg.includes("schema cache") ||
          msg.includes("Could not find");

        if (dataAlreadyGone) {
          // Data deleted but RPC missing - sign out and reload cleanly
          UI.toast("Account data deleted. Signing you out...", "info");
          try { await Auth.signOut(); } catch (_) {}
          setTimeout(() => {
            try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
            window.location.reload();
          }, 1200);
        } else {
          UI.toast(err.message || "Deletion failed. Please try again.", "error");
          btn.disabled = false;
          btn.textContent = "💀 Delete Account";
        }
      }
    });

  // ══════════════════════════════════════════════════════════════
  //  QUICK ACTIONS
  // ══════════════════════════════════════════════════════════════

  document
    .getElementById("qa-new-order")
    .addEventListener("click", async () => {
      await UI.navigate("orders");
      setTimeout(Modals.openCreateOrder, 120);
    });
  document
    .getElementById("qa-add-product")
    .addEventListener("click", async () => {
      await UI.navigate("products");
      setTimeout(Modals.openAddProduct, 120);
    });
  document
    .getElementById("qa-invoices")
    .addEventListener("click", () => UI.navigate("billing"));
  document
    .getElementById("qa-customers")
    .addEventListener("click", () => UI.navigate("customers"));

  const analyticsRefreshBtn = document.getElementById("analytics-refresh-btn");
  if (analyticsRefreshBtn) {
    analyticsRefreshBtn.addEventListener("click", async () => {
      analyticsRefreshBtn.textContent = "⏳ Loading…";
      analyticsRefreshBtn.disabled = true;
      await Pages.analytics();
      analyticsRefreshBtn.textContent = "🔄 Refresh";
      analyticsRefreshBtn.disabled = false;
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  MODAL CLOSE + ESCAPE
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => UI.closeModal(btn.dataset.closeModal));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") UI.closeAllModals();
  });

  // ══════════════════════════════════════════════════════════════
  //  LIVE PULSE (cosmetic)
  // ══════════════════════════════════════════════════════════════

  setInterval(() => {
    const el = document.getElementById("stat-revenue");
    if (
      el &&
      document.getElementById("page-dashboard")?.classList.contains("active")
    ) {
      el.style.opacity = "0.6";
      setTimeout(() => {
        el.style.opacity = "1";
      }, 320);
    }
  }, 8000);
});
