// Hisaab Mitra — Profile Completion Reminder Module
// Renders a beautiful onboarding card on the dashboard when critical
// business profile fields are missing. Disappears automatically once
// all required fields are filled and saved.
//
// DESIGN
//   • Matches the dark SaaS aesthetic — indigo glow border, card bg
//   • Progress bar + checklist of missing fields
//   • Single CTA: "Complete Profile →" opens Settings directly
//   • Mobile responsive — full width, thumb-friendly button
//
// ARCHITECTURE
//   ProfileReminder.render(user)  — call with the SF user object
//   ProfileReminder.dismiss()     — manually hide (used by animation)
//
// FIELDS CHECKED
//   Required:  store, phone, upiId, email, gstNumber
//   Optional:  logoUrl (only shown as a checklist item for Platinum/Trial)
//
// REACT MIGRATION NOTE
//   render() is a pure function of `user` — no global state.
//   Replace the DOM injection with a React component that takes `user`
//   as a prop and returns JSX. The field config array is already
//   structured to map cleanly to component props.
// ================================================================

const ProfileReminder = (() => {
  // ── Field definitions ─────────────────────────────────────────
  // Each entry: { key, label, icon, check(user) → bool }
  // check() returns true when the field IS complete (field is present).
  // We show entries where check() is false (field is missing).
  const FIELDS = [
    {
      key: "store",
      label: "Store name",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      check: (u) => !!(u.store && u.store.trim()),
    },
    {
      key: "phone",
      label: "Phone number",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.32 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
      check: (u) => !!(u.phone && u.phone.trim()),
    },
    {
      key: "email",
      label: "Business email",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      check: (u) => !!(u.email && u.email.trim()),
    },
    {
      key: "upiId",
      label: "UPI ID for payments",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      check: (u) => !!(u.upiId && u.upiId.trim()),
    },
    {
      key: "gstNumber",
      label: "GST number",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      check: (u) => !!(u.gstNumber && u.gstNumber.trim()),
    },
  ];

  // Logo is a bonus field — only shown as a checklist item for
  // Platinum and Trial users who can actually upload it.
  const LOGO_FIELD = {
    key: "logoUrl",
    label: "Store logo (Platinum)",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    check: (u) => !!u.logoUrl,
  };

  // ── Public: render ────────────────────────────────────────────
  // Accepts a plain user object from SF.getUser() or the settings
  // save handler. Idempotent — safe to call multiple times.
  //
  // ROOT CAUSE NOTE (fixed in app.js):
  //   render() was called once before UI.navigate('dashboard').
  //   Pages.dashboard() does NOT clear the reminder container, but
  //   app.js now also calls render() AFTER navigate() so the reminder
  //   is guaranteed to show on-screen for new users on first boot.
  function render(user) {
    const container = document.getElementById("profile-reminder-container");
    if (!container) return;

    // Build the active field list (add logo for eligible plans)
    const fields = [...FIELDS];
    if (typeof Billing !== "undefined" && Billing.canUploadLogo()) {
      fields.push(LOGO_FIELD);
    }

    const total = fields.length;
    const complete = fields.filter((f) => f.check(user)).length;
    const missing = fields.filter((f) => !f.check(user));

    // All fields complete → hide the reminder entirely
    if (missing.length === 0) {
      container.innerHTML = "";
      return;
    }

    const pct = Math.round((complete / total) * 100);
    const isAlmostDone = complete >= total - 1; // one field left

    // Colour the progress bar based on completion
    const barColor =
      pct >= 80
        ? "#10B981" // green
        : pct >= 50
          ? "#6366F1" // indigo
          : "#F59E0B"; // amber

    const missingItems = missing
      .map(
        (f) => `
      <div class="pr-item">
        <span class="pr-item-icon">${f.icon}</span>
        <span class="pr-item-label">${f.label}</span>
      </div>`,
      )
      .join("");

    container.innerHTML = `
      <div class="pr-card" id="pr-card" role="complementary" aria-label="Profile setup reminder">

        <div class="pr-top">
          <div class="pr-left">
            <div class="pr-title">
              ${isAlmostDone ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`} Complete your business profile
            </div>
            <div class="pr-subtitle">
              ${
                isAlmostDone
                  ? "Just one more step to a fully verified business profile."
                  : "Add these details to build customer trust and appear on invoices."
              }
            </div>
          </div>
          <button class="pr-dismiss" onclick="ProfileReminder.dismiss()" aria-label="Dismiss reminder" title="Dismiss">✕</button>
        </div>

        <!-- Progress -->
        <div class="pr-progress-row">
          <span class="pr-progress-label">Profile setup</span>
          <span class="pr-progress-fraction">${complete}/${total} complete</span>
        </div>
        <div class="pr-progress-track">
          <div class="pr-progress-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>

        <!-- Missing fields checklist -->
        <div class="pr-missing-label">Missing:</div>
        <div class="pr-items">${missingItems}</div>

        <!-- CTA -->
        <button
          class="btn pr-cta-btn"
          onclick="UI.navigate('settings')"
        >
          Complete Profile →
        </button>

      </div>`;
  }

  // ── Public: dismiss ───────────────────────────────────────────
  // Animates the card out and empties the container.
  // The reminder will re-appear on next page load if fields are
  // still missing — it is not permanently dismissed.
  function dismiss() {
    const card = document.getElementById("pr-card");
    if (!card) return;
    card.style.transition =
      "opacity 0.25s ease, transform 0.25s ease, max-height 0.3s ease, margin 0.3s ease, padding 0.3s ease";
    card.style.opacity = "0";
    card.style.transform = "translateY(-6px)";
    card.style.maxHeight = "0";
    card.style.overflow = "hidden";
    card.style.marginBottom = "0";
    card.style.paddingTop = "0";
    card.style.paddingBottom = "0";
    setTimeout(() => {
      const container = document.getElementById("profile-reminder-container");
      if (container) container.innerHTML = "";
    }, 320);
  }

  return { render, dismiss };
})();
