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
      icon: "🏪",
      check: (u) => !!(u.store && u.store.trim()),
    },
    {
      key: "phone",
      label: "Phone number",
      icon: "📱",
      check: (u) => !!(u.phone && u.phone.trim()),
    },
    {
      key: "email",
      label: "Business email",
      icon: "📧",
      check: (u) => !!(u.email && u.email.trim()),
    },
    {
      key: "upiId",
      label: "UPI ID for payments",
      icon: "💳",
      check: (u) => !!(u.upiId && u.upiId.trim()),
    },
    {
      key: "gstNumber",
      label: "GST number",
      icon: "🧾",
      check: (u) => !!(u.gstNumber && u.gstNumber.trim()),
    },
  ];

  // Logo is a bonus field — only shown as a checklist item for
  // Platinum and Trial users who can actually upload it.
  const LOGO_FIELD = {
    key: "logoUrl",
    label: "Store logo (Platinum)",
    icon: "🖼️",
    check: (u) => !!u.logoUrl,
  };

  // ── Public: render ────────────────────────────────────────────
  // Accepts a plain user object from SF.getUser() or the settings
  // save handler. Idempotent — safe to call multiple times.
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
              ${isAlmostDone ? "🎯" : "👋"} Complete your business profile
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
