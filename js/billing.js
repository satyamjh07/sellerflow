// SellerFlow — Billing & Subscription Module
// Manages plan state, expiry checking, feature gating, logo upload,
// expiry reminder emails, and dashboard warning banners.
//
// PLAN HIERARCHY
//   free     → basic access, SellerFlow branding, order limits
//   trial    → full Platinum access, 30-minute validity, one-time use
//   bronze   → ₹49/month core features, branding on invoices
//   platinum → ₹199/month everything, no branding, custom logo
//
// PAYMENT ARCHITECTURE (Phase 1 — semi-manual)
//   Plans are activated by manually updating the profiles table in Supabase.
//   The upgrade flow shows payment instructions and a "I've paid" CTA.
//   Phase 2 will wire PhonePe / Razorpay webhooks to auto-activate.
//
// ════════════════════════════════════════════════════════════════
//  SUPABASE SETUP — run ALL of these in SQL Editor (one-time)
// ════════════════════════════════════════════════════════════════
//
//  STEP 1 — Profiles table columns (if not already done):
//
//   ALTER TABLE profiles
//     ADD COLUMN IF NOT EXISTS plan            TEXT        NOT NULL DEFAULT 'free',
//     ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
//     ADD COLUMN IF NOT EXISTS trial_used      BOOLEAN     NOT NULL DEFAULT false,
//     ADD COLUMN IF NOT EXISTS logo_url        TEXT;
//
//
//  STEP 2 — Storage bucket (do this in the Supabase Dashboard UI):
//   1. Go to Storage → New bucket
//   2. Name: store-logos
//   3. ✅ Toggle "Public bucket" ON  ← THIS IS CRITICAL
//      Without this, getPublicUrl() returns a URL that returns 403.
//
//
//  STEP 3 — Storage RLS policies (run in SQL Editor):
//   Supabase Storage uses RLS on the storage.objects table.
//   upsert=true requires BOTH INSERT and UPDATE policies.
//   Reading public URLs requires a SELECT policy.
//
//   -- Drop old incomplete policies first (safe to run even if they don't exist)
//   DROP POLICY IF EXISTS "Users upload own logo"  ON storage.objects;
//   DROP POLICY IF EXISTS "Users delete own logo"  ON storage.objects;
//   DROP POLICY IF EXISTS "Users update own logo"  ON storage.objects;
//   DROP POLICY IF EXISTS "Public read store logos" ON storage.objects;
//
//   -- INSERT: authenticated users can upload into their own UID folder
//   CREATE POLICY "Users upload own logo"
//   ON storage.objects FOR INSERT
//   TO authenticated
//   WITH CHECK (
//     bucket_id = 'store-logos'
//     AND auth.uid()::text = split_part(name, '/', 1)
//   );
//
//   -- UPDATE: required for upsert=true (re-uploading overwrites existing file)
//   CREATE POLICY "Users update own logo"
//   ON storage.objects FOR UPDATE
//   TO authenticated
//   USING (
//     bucket_id = 'store-logos'
//     AND auth.uid()::text = split_part(name, '/', 1)
//   );
//
//   -- DELETE: authenticated users can delete their own logo
//   CREATE POLICY "Users delete own logo"
//   ON storage.objects FOR DELETE
//   TO authenticated
//   USING (
//     bucket_id = 'store-logos'
//     AND auth.uid()::text = split_part(name, '/', 1)
//   );
//
//   -- SELECT: anyone can read (needed for public image URLs in invoices/emails)
//   CREATE POLICY "Public read store logos"
//   ON storage.objects FOR SELECT
//   TO public
//   USING ( bucket_id = 'store-logos' );
//
// ════════════════════════════════════════════════════════════════

const Billing = (() => {

  // ─── Plan definitions ─────────────────────────────────────────
  // Single source of truth for all plan metadata.
  // React migration note: export PLANS as a const and import where needed.
  const PLANS = {
    free: {
      id:        'free',
      name:      'Free',
      badge:     '⚪ Free',
      price:     0,
      priceText: 'Always free',
      color:     '#6B7280',
      colorDim:  'rgba(107,114,128,0.12)',
      features: [
        'Core dashboard',
        'Up to 20 orders/month',
        'Customer management',
        'Basic invoices',
        'SellerFlow branding on invoices',
      ],
      limits: { ordersPerMonth: 20 },
      branding: true,         // SellerFlow footer on invoices
      customLogo: false,
      analytics: false,
    },
    trial: {
      id:        'trial',
      name:      'Trial',
      badge:     '🧪 Trial',
      price:     0,
      priceText: 'Free · 30 minutes',
      color:     '#8B5CF6',
      colorDim:  'rgba(139,92,246,0.12)',
      durationMinutes: 30,
      features: [
        'Full Platinum access',
        'Unlimited orders',
        'Custom store logo',
        'Remove SellerFlow branding',
        'Advanced analytics',
        'Valid for 30 minutes only',
        'One-time use per account',
      ],
      limits: { ordersPerMonth: Infinity },
      branding: false,
      customLogo: true,
      analytics: true,
    },
    bronze: {
      id:        'bronze',
      name:      'Bronze',
      badge:     '🥉 Bronze',
      price:     49,
      priceText: '₹49 / month',
      color:     '#D97706',
      colorDim:  'rgba(217,119,6,0.12)',
      features: [
        'Core dashboard',
        'Unlimited customers',
        'Unlimited orders',
        'Invoices & billing',
        'Basic tracking page',
        'SellerFlow branding on invoices',
      ],
      limits: { ordersPerMonth: Infinity },
      branding: true,
      customLogo: false,
      analytics: false,
    },
    platinum: {
      id:        'platinum',
      name:      'Platinum',
      badge:     '🥇 Platinum',
      price:     199,
      priceText: '₹199 / month',
      color:     '#6366F1',
      colorDim:  'rgba(99,102,241,0.12)',
      features: [
        'Everything in Bronze',
        'Remove SellerFlow branding',
        'Custom store logo on invoices',
        'Premium invoice branding',
        'Advanced analytics (ready)',
        'Low stock email alerts',
        'Premium tracking page',
        'Priority support',
      ],
      limits: { ordersPerMonth: Infinity },
      branding: false,
      customLogo: true,
      analytics: true,
    },
  };

  // ─── EmailJS config ──────────────────────────────────────────
  // Reuse the same service/template IDs already configured in ui.js
  const EMAILJS_SERVICE_ID  = 'service_5k8qt0o';
  const EMAILJS_TEMPLATE_ID = 'template_x6h0iqc';

  // ─── In-memory state ─────────────────────────────────────────
  // Loaded once at boot via init(), refreshed after plan changes.
  let _currentPlan       = 'free';
  let _planExpiresAt     = null;   // ISO string or null
  let _trialUsed         = false;
  let _reminderScheduled = false;  // prevent duplicate timers per session

  // ─── Init ─────────────────────────────────────────────────────
  // Called in _bootApp (app.js) after the user profile is loaded.
  // Checks expiry, downgrades if needed, schedules reminder timers.
  // MUST be awaited in _bootApp so _currentPlan is set before any page renders.
  async function init() {
    try {
      const profile = await _getRawProfile();
      if (!profile) return;

      _currentPlan   = profile.plan         || 'free';
      _trialUsed     = profile.trial_used   || false;

      // ── Safe date parsing ─────────────────────────────────────
      // Supabase returns timestamptz as an ISO string (UTC offset included).
      // We parse it carefully so a malformed value never causes a false expiry.
      const rawExpiry = profile.plan_expires_at;
      if (rawExpiry) {
        const parsed = new Date(rawExpiry);
        // Only accept a valid, finite date
        _planExpiresAt = isNaN(parsed.getTime()) ? null : rawExpiry;
      } else {
        _planExpiresAt = null;
      }

      // ── Expiry check ──────────────────────────────────────────
      // Only downgrade if we have a valid expiry AND it has passed.
      // A paid plan with no expiry (null) is never downgraded here.
      if (_planExpiresAt) {
        const expiryDate = new Date(_planExpiresAt);
        const now        = new Date();
        if (expiryDate <= now) {
          await _downgradeToFree('expired');
        } else {
          _scheduleExpiryReminders();
        }
      }
      // Free plan or non-expiring paid plan — no timer needed.

      _renderPlanBanner();

    } catch (err) {
      console.warn('[Billing] init failed (non-fatal):', err.message);
    }
  }

  // ── Public: refresh plan state from DB ───────────────────────
  // Call this whenever you need the latest plan (e.g. after a manual
  // admin update in Supabase, or when the Settings page renders).
  // Resets reminder state so timers are re-scheduled correctly.
  async function refresh() {
    _reminderScheduled = false;
    await init();
  }

  // ─── Internal: fetch raw profile row ─────────────────────────
  async function _getRawProfile() {
    const uid = Auth.getUserId();
    if (!uid) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('plan, plan_expires_at, trial_used, logo_url, email, name, store')
      .eq('id', uid)
      .single();
    if (error) throw error;
    return data;
  }

  // ─── Internal: downgrade to free ─────────────────────────────
  async function _downgradeToFree(reason) {
    const uid = Auth.getUserId();
    if (!uid) return;
    await _supabase
      .from('profiles')
      .update({ plan: 'free', plan_expires_at: null })
      .eq('id', uid);

    const prevPlan = _currentPlan;
    _currentPlan   = 'free';
    _planExpiresAt = null;

    console.info(`[Billing] Plan downgraded to free. Reason: ${reason}`);

    if (reason === 'expired') {
      UI.toast(`Your ${PLANS[prevPlan]?.name || 'plan'} has expired — you're now on the Free plan.`, 'warn');
      _renderPlanBanner();

      // Send expiry notification email
      _sendPlanEmail('expired', prevPlan).catch(e => {
        console.warn('[Billing] Expiry email failed:', e.message);
      });
    }
  }

  // ─── Internal: schedule session timers ───────────────────────
  function _scheduleExpiryReminders() {
    if (!_planExpiresAt || _reminderScheduled) return;
    if (_currentPlan === 'free') return;

    const expiresMs = new Date(_planExpiresAt).getTime();
    const nowMs     = Date.now();
    const msLeft    = expiresMs - nowMs;

    if (msLeft <= 0) return; // already expired — handled above

    _reminderScheduled = true;

    // Reminder thresholds
    const reminders = [
      { label: '10min',  msBeforeExpiry: 10 * 60 * 1000 },  // 10 minutes
      { label: '3days',  msBeforeExpiry: 3 * 24 * 60 * 60 * 1000 },
      { label: 'expiry', msBeforeExpiry: 0 },
    ];

    reminders.forEach(({ label, msBeforeExpiry }) => {
      const fireAt = msLeft - msBeforeExpiry;
      if (fireAt > 0) {
        setTimeout(async () => {
          if (label === 'expiry') {
            await _downgradeToFree('expired');
          } else {
            _showExpiryToast(label, msBeforeExpiry);
            _sendPlanEmail(label, _currentPlan).catch(() => {});
            _renderPlanBanner(); // refresh banner with updated countdown
          }
        }, fireAt);
      }
    });
  }

  // ─── Internal: show expiry toast ─────────────────────────────
  function _showExpiryToast(label, msBeforeExpiry) {
    const planName = PLANS[_currentPlan]?.name || 'plan';
    if (label === '10min') {
      UI.toast(`⏰ Your ${planName} expires in 10 minutes! Upgrade to keep access.`, 'warn');
    } else if (label === '3days') {
      UI.toast(`📅 Your ${planName} expires in 3 days. Renew now to avoid interruption.`, 'warn');
    }
  }

  // ─── Internal: render dashboard warning banner ───────────────
  function _renderPlanBanner() {
    const container = document.getElementById('plan-banner-container');
    if (!container) return;

    container.innerHTML = '';

    if (_currentPlan === 'free') return; // no banner for free
    if (!_planExpiresAt) return;         // paid with no expiry (shouldn't happen in Phase 1)

    const expiresMs = new Date(_planExpiresAt).getTime();
    const nowMs     = Date.now();
    const msLeft    = expiresMs - nowMs;

    if (msLeft <= 0) return; // expired — already handled

    const minutesLeft = Math.floor(msLeft / 60000);
    const hoursLeft   = Math.floor(msLeft / 3600000);
    const daysLeft    = Math.floor(msLeft / 86400000);

    let urgency = 'info';    // green
    let timeStr = '';

    if (minutesLeft < 60) {
      urgency = 'danger';
      timeStr = `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
    } else if (hoursLeft < 24) {
      urgency = 'warn';
      timeStr = `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`;
    } else if (daysLeft <= 3) {
      urgency = 'warn';
      timeStr = `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
    } else {
      urgency = 'info';
      timeStr = `${daysLeft} days`;
    }

    const planMeta  = PLANS[_currentPlan] || PLANS.free;
    const bannerCls = urgency === 'danger' ? 'plan-banner-danger'
                    : urgency === 'warn'   ? 'plan-banner-warn'
                    :                        'plan-banner-info';

    container.innerHTML = `
      <div class="plan-banner ${bannerCls}">
        <span class="plan-banner-icon">
          ${urgency === 'danger' ? '🔴' : urgency === 'warn' ? '⚠️' : 'ℹ️'}
        </span>
        <span class="plan-banner-text">
          <strong>${planMeta.name}</strong> expires in <strong>${timeStr}</strong>.
          ${urgency !== 'info' ? ' Renew now to avoid losing access.' : ''}
        </span>
        <button class="plan-banner-btn" onclick="UI.navigate('settings')">
          Manage Plan →
        </button>
      </div>`;
  }

  // ─── Internal: send plan lifecycle emails via EmailJS ─────────
  // Uses the existing EmailJS integration. The template receives
  // a special `plan_event` variable the seller's template can use.
  async function _sendPlanEmail(eventType, planId) {
    if (typeof emailjs === 'undefined') return;
    if (!EMAILJS_SERVICE_ID || EMAILJS_SERVICE_ID.startsWith('YOUR_')) return;

    try {
      const profile = await _getRawProfile();
      if (!profile?.email) return;

      const planMeta = PLANS[planId] || PLANS.free;

      const subjects = {
        '10min':   `⏰ Your SellerFlow ${planMeta.name} expires in 10 minutes`,
        '3days':   `📅 Your SellerFlow ${planMeta.name} renews in 3 days`,
        'expired': `🔔 Your SellerFlow ${planMeta.name} has expired`,
      };

      const bodies = {
        '10min': `Hi ${profile.name || 'Seller'},\n\nYour SellerFlow ${planMeta.name} plan (${planMeta.priceText}) expires in 10 minutes.\n\nTo keep your full access, please renew your plan via Settings → Subscription.\n\nThank you for using SellerFlow!`,
        '3days': `Hi ${profile.name || 'Seller'},\n\nYour SellerFlow ${planMeta.name} plan expires in 3 days.\n\nRenew now from Settings → Subscription to avoid any interruption.\n\nThank you!`,
        'expired': `Hi ${profile.name || 'Seller'},\n\nYour SellerFlow ${planMeta.name} plan has expired. You've been moved to the Free plan.\n\nUpgrade any time from Settings → Subscription.\n\nThank you for using SellerFlow!`,
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        customer_name:  profile.name  || 'Seller',
        customer_email: profile.email,
        order_id:       `PLAN-${eventType.toUpperCase()}`,
        store_name:     profile.store || 'SellerFlow Store',
        total:          planMeta.priceText,
        payment_status: subjects[eventType] || 'Plan Update',
        invoice_html:   `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#374151">${(bodies[eventType] || '').replace(/\n/g, '<br>')}</p>`,
      });
    } catch (err) {
      console.warn('[Billing] _sendPlanEmail failed:', err.message);
    }
  }

  // ─── Public: activate trial ───────────────────────────────────
  async function activateTrial() {
    if (_trialUsed) {
      UI.toast('You have already used your free trial.', 'warn');
      return false;
    }
    if (_currentPlan !== 'free') {
      UI.toast('You already have an active plan.', 'info');
      return false;
    }

    const uid = Auth.getUserId();
    if (!uid) return false;

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    const { error } = await _supabase
      .from('profiles')
      .update({ plan: 'trial', plan_expires_at: expiresAt, trial_used: true })
      .eq('id', uid);

    if (error) {
      UI.toast('Failed to activate trial. Please try again.', 'error');
      console.error('[Billing] activateTrial:', error);
      return false;
    }

    _currentPlan   = 'trial';
    _planExpiresAt = expiresAt;
    _trialUsed     = true;
    _reminderScheduled = false;

    _scheduleExpiryReminders();
    _renderPlanBanner();

    UI.toast('🧪 Trial activated! You have 30 minutes of full Platinum access.', 'success');
    return true;
  }

  // ─── Public: get current plan metadata ───────────────────────
  function getCurrentPlan() {
    return {
      id:        _currentPlan,
      meta:      PLANS[_currentPlan] || PLANS.free,
      expiresAt: _planExpiresAt,
      trialUsed: _trialUsed,
      isExpired: _planExpiresAt ? new Date(_planExpiresAt) <= new Date() : false,
    };
  }

  // ─── Public: feature gate helpers ────────────────────────────
  // Use these everywhere to check access. Returns boolean.
  // React migration: import and call as Billing.can('customLogo')

  function can(feature) {
    const plan = PLANS[_currentPlan] || PLANS.free;
    // If plan has expired, treat as free
    if (_planExpiresAt && new Date(_planExpiresAt) <= new Date()) {
      return PLANS.free[feature] ?? false;
    }
    return plan[feature] ?? false;
  }

  function canUploadLogo()    { return can('customLogo'); }
  function hasNoBranding()    { return !can('branding'); }
  function canUseAnalytics()  { return can('analytics'); }

  function getMonthlyOrderLimit() {
    const plan = PLANS[_currentPlan] || PLANS.free;
    if (_planExpiresAt && new Date(_planExpiresAt) <= new Date()) {
      return PLANS.free.limits.ordersPerMonth;
    }
    return plan.limits.ordersPerMonth;
  }

  // Checks if adding one more order this month would exceed the limit.
  // Pass currentMonthOrderCount from getDashStats().
  function isOrderLimitReached(currentMonthOrderCount) {
    const limit = getMonthlyOrderLimit();
    if (limit === Infinity) return false;
    return currentMonthOrderCount >= limit;
  }

  // ─── Public: logo upload (Platinum / Trial only) ──────────────
  // Uploads a logo to Supabase Storage → store-logos bucket.
  // Path: <uid>/store-logo.<ext>  (one file per user, overwritten on re-upload)
  //
  // REQUIRES in Supabase (see file header for full SQL):
  //   • bucket "store-logos" set to PUBLIC
  //   • INSERT policy for authenticated users
  //   • UPDATE policy for authenticated users  ← needed for upsert
  //   • SELECT policy for public               ← needed for public URL to work
  //
  async function uploadLogo(file) {
    if (!canUploadLogo()) {
      UI.toast('Custom logo is a Platinum or Trial feature. Upgrade to upload your logo.', 'warn');
      return null;
    }

    if (!file) return null;

    const uid = Auth.getUserId();
    if (!uid) {
      UI.toast('Not authenticated. Please log in again.', 'error');
      return null;
    }

    // ── Validate file type ───────────────────────────────────
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      UI.toast('Please upload a JPG, PNG, WebP, or GIF image.', 'error');
      return null;
    }

    // ── Validate file size (2 MB max) ────────────────────────
    if (file.size > 2 * 1024 * 1024) {
      UI.toast('Logo must be under 2 MB.', 'error');
      return null;
    }

    const ext  = file.name.split('.').pop().toLowerCase() || 'png';
    const path = `${uid}/store-logo.${ext}`;

    // ── Delete any existing logo first ───────────────────────
    // This avoids needing an UPDATE policy — we DELETE then INSERT.
    // Errors here are intentionally ignored (file may not exist yet).
    const knownExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    await Promise.all(
      knownExts.map(e =>
        _supabase.storage
          .from('store-logos')
          .remove([`${uid}/store-logo.${e}`])
          .catch(() => {}) // 404 is fine
      )
    );

    // ── Upload the new file ──────────────────────────────────
    const { error: uploadErr } = await _supabase.storage
      .from('store-logos')
      .upload(path, file, {
        upsert:      false,        // false = pure INSERT after delete above
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadErr) {
      console.error('[Billing] Logo upload error:', uploadErr);

      // Provide specific, actionable error messages
      if (uploadErr.message?.includes('row-level security') ||
          uploadErr.statusCode === '403' ||
          uploadErr.error === 'Unauthorized') {
        UI.toast(
          'Upload blocked by Supabase storage policy. ' +
          'Run the RLS setup SQL from billing.js header in your Supabase SQL editor.',
          'error'
        );
      } else if (uploadErr.message?.includes('bucket') ||
                 uploadErr.message?.includes('not found')) {
        UI.toast(
          'Storage bucket "store-logos" not found. ' +
          'Create it in Supabase Dashboard → Storage → New bucket (set to Public).',
          'error'
        );
      } else {
        UI.toast(`Logo upload failed: ${uploadErr.message || 'Unknown error'}`, 'error');
      }
      return null;
    }

    // ── Get the public URL ────────────────────────────────────
    // This only works if the bucket is set to PUBLIC in Supabase Dashboard.
    // If the URL returns 403, the bucket is private — toggle it to public.
    const { data: urlData } = _supabase.storage
      .from('store-logos')
      .getPublicUrl(path);

    const logoUrl = urlData?.publicUrl || null;

    if (!logoUrl) {
      UI.toast('Got no public URL from storage. Make sure "store-logos" bucket is set to Public.', 'error');
      return null;
    }

    // ── Append cache-buster so <img> reloads after re-upload ─
    const logoUrlWithBust = `${logoUrl}?t=${Date.now()}`;

    // ── Persist URL to profile ────────────────────────────────
    const { error: profileErr } = await _supabase
      .from('profiles')
      .update({ logo_url: logoUrlWithBust })
      .eq('id', uid);

    if (profileErr) {
      console.warn('[Billing] Failed to save logo URL to profile:', profileErr);
      // Non-fatal — URL is valid even if profile save failed
    }

    return logoUrlWithBust;
  }

  // ─── Public: delete logo ─────────────────────────────────────
  async function deleteLogo() {
    const uid = Auth.getUserId();
    if (!uid) return;

    // Try removing both common extensions
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif']) {
      await _supabase.storage
        .from('store-logos')
        .remove([`${uid}/store-logo.${ext}`])
        .catch(() => {}); // ignore 404s
    }

    await _supabase
      .from('profiles')
      .update({ logo_url: null })
      .eq('id', uid);
  }

  // ─── Public: render settings subscription section ────────────
  // Called from Pages.settings() to inject the subscription UI.
  // All plan management UI lives here — settings page just calls this.
  async function renderSubscriptionSection(profile) {
    const container = document.getElementById('subscription-section');
    if (!container) return;

    // ── Always re-fetch plan from DB ──────────────────────────
    // This ensures a manual admin update in Supabase (e.g. activating a
    // paid plan via SQL) is reflected immediately without a full page reload.
    // refresh() resets reminder timers and re-runs init() against live DB.
    await refresh();

    const plan        = PLANS[_currentPlan] || PLANS.free;
    const expiresAt   = _planExpiresAt;
    const trialUsed   = _trialUsed;
    const logoUrl     = profile?.logoUrl || null;

    // ── Expiry display ────────────────────────────────────────
    let expiryHtml = '';
    if (expiresAt) {
      const d       = new Date(expiresAt);
      const expired = d <= new Date();
      const fmt     = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      expiryHtml = `
        <div class="sub-expiry ${expired ? 'sub-expiry-expired' : ''}">
          ${expired ? '❌ Expired' : `⏳ Active until ${fmt}`}
        </div>`;
    }

    // ── Feature list ──────────────────────────────────────────
    const featureList = plan.features.map(f =>
      `<li class="sub-feature-item">✅ ${f}</li>`
    ).join('');

    // ── Upgrade options ───────────────────────────────────────
    // Show plans that are above the current one
    const upgradePlans = Object.values(PLANS).filter(p => {
      if (p.id === 'free') return false;
      if (p.id === _currentPlan) return false;
      if (p.id === 'trial' && trialUsed) return false;
      return true;
    });

    const upgradeCards = upgradePlans.map(p => `
      <div class="sub-upgrade-card" style="border-color:${p.color};--plan-color:${p.color}">
        <div class="sub-upgrade-badge" style="background:${p.colorDim};color:${p.color}">${p.badge}</div>
        <div class="sub-upgrade-price">${p.priceText}</div>
        <ul class="sub-upgrade-features">
          ${p.features.slice(0, 4).map(f => `<li>✓ ${f}</li>`).join('')}
        </ul>
        ${p.id === 'trial'
          ? `<button class="btn sub-upgrade-btn" style="background:${p.color};color:#fff" onclick="Billing._handleTrialActivate()">
               Start Free Trial
             </button>`
          : `<button class="btn sub-upgrade-btn" style="background:${p.color};color:#fff" onclick="Billing._handleUpgradeClick('${p.id}')">
               Upgrade to ${p.name} →
             </button>`
        }
      </div>`).join('');

    // ── Logo section (Platinum/Trial only) ───────────────────
    const logoHtml = `
      <div class="sub-logo-section">
        <div class="sub-section-title">🖼️ Store Logo</div>
        <div class="sub-section-desc">
          ${canUploadLogo()
            ? 'Upload your store logo — it appears on invoices and emails.'
            : '🔒 Custom logo is available on Platinum and Trial plans.'}
        </div>
        ${canUploadLogo() ? `
          <div class="sub-logo-preview" id="sub-logo-preview">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="Store Logo" class="sub-logo-img" id="current-logo-img">
                 <button class="btn btn-sm btn-danger sub-logo-delete" onclick="Billing._handleDeleteLogo()">🗑️ Remove</button>`
              : `<div class="sub-logo-placeholder">No logo uploaded</div>`
            }
          </div>
          <div class="sub-logo-upload-row">
            <label class="btn btn-secondary btn-sm sub-logo-label" for="logo-file-input">
              📁 Choose Image
            </label>
            <input type="file" id="logo-file-input" accept="image/jpeg,image/png,image/webp,image/gif"
              style="display:none" onchange="Billing._handleLogoUpload(this)">
            <span class="sub-logo-hint">JPG, PNG or WebP · Max 2 MB</span>
          </div>
        ` : `
          <div class="sub-logo-locked">
            <span class="sub-lock-icon">🔒</span>
            <span>Upgrade to Platinum to upload your logo</span>
            <button class="btn btn-sm sub-upgrade-inline-btn" onclick="Billing._handleUpgradeClick('platinum')">
              Upgrade →
            </button>
          </div>
        `}
      </div>`;

    // ── Full render ───────────────────────────────────────────
    container.innerHTML = `
      <div class="sub-current-plan">
        <div class="sub-plan-header">
          <div>
            <div class="sub-plan-badge" style="background:${plan.colorDim};color:${plan.color}">${plan.badge}</div>
            <div class="sub-plan-name">Current Plan: <strong>${plan.name}</strong></div>
            <div class="sub-plan-price">${plan.priceText}</div>
            ${expiryHtml}
          </div>
          <div class="sub-plan-status-dot" style="background:${plan.color}"></div>
        </div>
        <ul class="sub-feature-list">${featureList}</ul>
      </div>

      ${upgradeCards.length > 0 ? `
        <div class="sub-section-title" style="margin-top:24px;margin-bottom:14px">⬆️ Available Plans</div>
        <div class="sub-upgrade-grid">${upgradeCards}</div>
      ` : `
        <div class="sub-active-msg">
          🎉 You're on the <strong>${plan.name}</strong> plan. Enjoying full access!
        </div>
      `}

      ${logoHtml}
    `;
  }

  // ─── Internal: handle trial button click ──────────────────────
  async function _handleTrialActivate() {
    const btn = document.querySelector('.sub-upgrade-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Activating…'; }

    const ok = await activateTrial();
    if (ok) {
      // Re-render the subscription section
      const profile = await SF.getUser();
      await renderSubscriptionSection(profile);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Start Free Trial'; }
    }
  }

  // ─── Internal: handle upgrade button click ───────────────────
  // Phase 1: show payment instructions modal
  function _handleUpgradeClick(planId) {
    const plan = PLANS[planId];
    if (!plan) return;
    _showPaymentModal(plan);
  }

  // ─── Internal: payment instructions modal ────────────────────
  // Phase 1 semi-manual flow. Phase 2: replace body with PhonePe SDK call.
  function _showPaymentModal(plan) {
    // Remove any existing modal
    document.getElementById('payment-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <div class="modal-title">Upgrade to ${plan.name}</div>
          <button class="modal-close" onclick="document.getElementById('payment-modal').remove()">✕</button>
        </div>

        <div class="payment-plan-summary">
          <div class="payment-plan-badge" style="background:${plan.colorDim};color:${plan.color}">${plan.badge}</div>
          <div class="payment-plan-price">${plan.priceText}</div>
        </div>

        <div class="payment-instructions">
          <div class="payment-step">
            <div class="payment-step-num">1</div>
            <div>
              <div class="payment-step-title">Pay via UPI</div>
              <div class="payment-step-desc">Send <strong>₹${plan.price}</strong> to:</div>
              <div class="payment-upi-id" id="payment-upi-display" onclick="Billing._copyUPI()">
                sellerflow@upi
                <span class="payment-copy-hint">tap to copy</span>
              </div>
            </div>
          </div>
          <div class="payment-step">
            <div class="payment-step-num">2</div>
            <div>
              <div class="payment-step-title">Note your Transaction ID</div>
              <div class="payment-step-desc">After payment, note the UPI transaction/reference ID from your payment app.</div>
            </div>
          </div>
          <div class="payment-step">
            <div class="payment-step-num">3</div>
            <div>
              <div class="payment-step-title">Send payment proof</div>
              <div class="payment-step-desc">
                DM us on Instagram 
                <a href="https://instagram.com/sellerflow.in" target="_blank" style="color:var(--accent)">@sellerflow.in</a>
                with your Transaction ID and registered email. We'll activate your plan within 2 hours.
              </div>
            </div>
          </div>
        </div>

        <div class="payment-txn-row">
          <input class="form-input" type="text" id="payment-txn-input"
            placeholder="Enter Transaction ID (optional)">
          <button class="btn btn-primary" style="width:100%;margin-top:10px"
            onclick="Billing._handlePaymentConfirm('${plan.id}')">
            ✅ I've Paid — Notify Team
          </button>
        </div>

        <p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:14px">
          Your plan will be activated manually within 2 hours after verification.<br>
          Questions? DM <a href="https://instagram.com/sellerflow.in" target="_blank" style="color:var(--accent)">@sellerflow.in</a>
        </p>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.remove();
    });
  }

  // ─── Internal: copy UPI ID ────────────────────────────────────
  function _copyUPI() {
    const upi = 'sellerflow@upi';
    navigator.clipboard?.writeText(upi).then(() => {
      UI.toast('UPI ID copied!', 'success');
    }).catch(() => UI.toast('UPI: sellerflow@upi', 'info'));
  }

  // ─── Internal: "I've paid" confirmation ──────────────────────
  async function _handlePaymentConfirm(planId) {
    const txnInput = document.getElementById('payment-txn-input');
    const txnId    = txnInput?.value.trim() || '(not provided)';

    // Send a notification email to the seller's account (acts as a paper trail)
    try {
      const profile = await _getRawProfile();
      if (profile?.email && typeof emailjs !== 'undefined') {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          customer_name:  profile.name  || 'Seller',
          customer_email: profile.email,
          order_id:       `UPGRADE-${planId.toUpperCase()}`,
          store_name:     profile.store || 'SellerFlow Store',
          total:          `₹${PLANS[planId]?.price || 0}`,
          payment_status: `Plan upgrade request: ${planId}`,
          invoice_html:   `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#374151">
            Hi ${profile.name || 'Seller'},<br><br>
            We've received your upgrade request for the <strong>${PLANS[planId]?.name}</strong> plan.<br>
            Transaction ID: <strong>${txnId}</strong><br><br>
            Your plan will be activated within 2 hours after verification.<br><br>
            Thank you for choosing SellerFlow! 🙏
          </p>`,
        });
      }
    } catch (e) {
      console.warn('[Billing] Payment confirm email failed:', e);
    }

    document.getElementById('payment-modal')?.remove();
    UI.toast('Payment noted! We\'ll activate your plan within 2 hours. 🙏', 'success');
  }

  // ─── Internal: logo upload handler ──────────────────────────
  async function _handleLogoUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;

    // ── Show loading state ───────────────────────────────────
    const uploadLabel = document.querySelector('.sub-logo-label');
    const preview     = document.getElementById('sub-logo-preview');

    if (uploadLabel) {
      uploadLabel.textContent = '⏳ Uploading…';
      uploadLabel.style.pointerEvents = 'none';
    }
    if (preview) {
      preview.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:12px;color:var(--text-muted);font-size:13px">
          <div class="sf-spinner" style="width:20px;height:20px;border-width:2px"></div>
          Uploading logo…
        </div>`;
    }

    const url = await uploadLogo(file);

    if (url) {
      // ── Success — show preview with remove button ─────────
      if (preview) {
        preview.innerHTML = `
          <img src="${url}" alt="Store Logo" class="sub-logo-img" id="current-logo-img"
               onerror="this.style.display='none';document.getElementById('sub-logo-preview').insertAdjacentHTML('afterbegin','<div class=sub-logo-placeholder>Image saved (preview unavailable)</div>')">
          <button class="btn btn-sm btn-danger sub-logo-delete" onclick="Billing._handleDeleteLogo()">🗑️ Remove</button>`;
      }
      UI.toast('Store logo uploaded successfully! ✅', 'success');
    } else {
      // ── Failure — restore previous state ──────────────────
      if (preview) {
        preview.innerHTML = `<div class="sub-logo-placeholder">Upload failed — see error above</div>`;
      }
    }

    // ── Always restore upload button ─────────────────────────
    if (uploadLabel) {
      uploadLabel.textContent = '📁 Choose Image';
      uploadLabel.style.pointerEvents = '';
    }
    input.value = ''; // reset so same file can be re-selected
  }

  // ─── Internal: delete logo handler ───────────────────────────
  async function _handleDeleteLogo() {
    if (!window.confirm('Remove your store logo?')) return;
    await deleteLogo();
    const preview = document.getElementById('sub-logo-preview');
    if (preview) {
      preview.innerHTML = `<div class="sub-logo-placeholder">No logo uploaded</div>`;
    }
    UI.toast('Logo removed.', 'info');
  }

  // ─── Public: expose internal handlers for inline onclick ──────
  // These are used by the dynamically rendered HTML above.
  // Keeping them on the Billing namespace avoids polluting window scope.

  // ─── Public: get logo URL for use in invoice/email ───────────
  async function getLogoUrl() {
    if (!canUploadLogo()) return null;
    try {
      const profile = await _getRawProfile();
      return profile?.logo_url || null;
    } catch {
      return null;
    }
  }

  // Public API
  return {
    PLANS,
    init,
    refresh,
    activateTrial,
    getCurrentPlan,
    can,
    canUploadLogo,
    hasNoBranding,
    canUseAnalytics,
    getMonthlyOrderLimit,
    isOrderLimitReached,
    uploadLogo,
    deleteLogo,
    getLogoUrl,
    renderSubscriptionSection,
    // Internal handlers exposed for inline onclick use
    _handleTrialActivate,
    _handleUpgradeClick,
    _handlePaymentConfirm,
    _handleLogoUpload,
    _handleDeleteLogo,
    _copyUPI,
    _renderPlanBanner,
  };
})();
