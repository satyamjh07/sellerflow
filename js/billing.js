// Hisaab Mitra — Billing & Subscription Module
// Manages plan state, expiry checking, feature gating, logo upload,
// expiry reminder emails, and dashboard warning banners.
//
// PLAN HIERARCHY
//   free     → basic access, Hisaab Mitra branding, order limits
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
      badge:     'Free',
      price:     0,
      priceText: 'Always free',
      color:     '#6B7280',
      colorDim:  'rgba(107,114,128,0.12)',
      features: [
        'Core dashboard',
        'Up to 20 orders/month',
        'Customer management',
        'Basic invoices',
        'Basic invoice templates',
        'Hisaab Mitra branding on invoices',
      ],
      limits: { ordersPerMonth: 20 },
      branding: true,         // Hisaab Mitra footer on invoices
      customLogo: false,
      analytics: false,
    },
    trial: {
      id:        'trial',
      name:      'Trial',
      badge:     'Trial',
      price:     0,
      priceText: 'Free · 24 Hours',
      color:     '#8B5CF6',
      colorDim:  'rgba(139,92,246,0.12)',
      durationMinutes: 1440,
      features: [
        'Full Platinum access',
        'Unlimited orders',
        'Custom store logo',
        'Remove Hisaab Mitra branding',
        'Advanced AI analytics dashboard',
        'Valid for 24 Hours only',
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
      badge:     'Bronze',
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
        'Hisaab Mitra branding on invoices',
      ],
      limits: { ordersPerMonth: Infinity },
      branding: true,
      customLogo: false,
      analytics: false,
    },
    platinum: {
      id:        'platinum',
      name:      'Platinum',
      badge:     'Platinum',
      price:     99,
      priceText: '₹99 / month + 1 Month Free',
      color:     '#6366F1',
      colorDim:  'rgba(99,102,241,0.12)',
      features: [
        'Everything in Bronze',
        'Remove Hisaab Mitra branding',
        'Custom store logo on invoices',
        'Premium invoice branding',
        'Premium only invoice templates',
        'Advanced AI analytics (ready)',
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
  // Dedicated template for admin upgrade-request notifications.
  // Create this template in EmailJS dashboard (see setup guide).
  // Template "To" must be hardcoded to hisaabmitra@gmail.com.
  const EMAILJS_UPGRADE_TEMPLATE_ID = 'template_u0etbcl'; // ← paste your new template ID here

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
      UI.toast(`Your ${planName} expires in 10 minutes! Upgrade to keep access.`, 'warn');
    } else if (label === '3days') {
      UI.toast(`Your ${planName} expires in 3 days. Renew now to avoid interruption.`, 'warn');
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
          ${urgency === 'danger' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="none" style="width:12px;height:12px"><circle cx="12" cy="12" r="10"/></svg>` : urgency === 'warn' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`}
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
        '10min':   `Your Hisaab Mitra ${planMeta.name} expires in 10 minutes`,
        '3days':   `Your Hisaab Mitra ${planMeta.name} renews in 3 days`,
        'expired': `Your Hisaab Mitra ${planMeta.name} has expired`,
      };

      const bodies = {
        '10min': `Hi ${profile.name || 'Seller'},\n\nYour Hisaab Mitra ${planMeta.name} plan (${planMeta.priceText}) expires in 10 minutes.\n\nTo keep your full access, please renew your plan via Settings → Subscription.\n\nThank you for using Hisaab Mitra!`,
        '3days': `Hi ${profile.name || 'Seller'},\n\nYour Hisaab Mitra ${planMeta.name} plan expires in 3 days.\n\nRenew now from Settings → Subscription to avoid any interruption.\n\nThank you!`,
        'expired': `Hi ${profile.name || 'Seller'},\n\nYour Hisaab Mitra ${planMeta.name} plan has expired. You've been moved to the Free plan.\n\nUpgrade any time from Settings → Subscription.\n\nThank you for using Hisaab Mitra!`,
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        customer_name:  profile.name  || 'Seller',
        customer_email: profile.email,
        order_id:       `PLAN-${eventType.toUpperCase()}`,
        store_name:     profile.store || 'Hisaab Mitra Store',
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

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

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

    UI.toast('Trial activated! You have 24 hours of full Platinum access.', 'success');
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
        getCurrentPlan,
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
          ${expired ? 'Expired' : `Active until ${fmt}`}
        </div>`;
    }

    // ── Feature list ──────────────────────────────────────────
    const featureList = plan.features.map(f =>
      `<li class="sub-feature-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="20 6 9 17 4 12"/></svg> ${f}</li>`
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
      <div class="sub-upgrade-card" data-plan-id="${p.id}" style="border-color:${p.color};--plan-color:${p.color}">
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
        <div class="sub-section-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Store Logo</div>
        <div class="sub-section-desc">
          ${canUploadLogo()
            ? 'Upload your store logo — it appears on invoices and emails.'
            : '🔒 Custom logo is available on Platinum and Trial plans.'}
        </div>
        ${canUploadLogo() ? `
          <div class="sub-logo-preview" id="sub-logo-preview">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="Store Logo" class="sub-logo-img" id="current-logo-img">
                 <button class="btn btn-sm btn-danger sub-logo-delete" onclick="Billing._handleDeleteLogo()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Remove</button>`
              : `<div class="sub-logo-placeholder">No logo uploaded</div>`
            }
          </div>
          <div class="sub-logo-upload-row">
            <label class="btn btn-secondary btn-sm sub-logo-label" for="logo-file-input">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;margin-right:5px"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg> Choose Image
            </label>
            <input type="file" id="logo-file-input" accept="image/jpeg,image/png,image/webp,image/gif"
              style="display:none" onchange="Billing._handleLogoUpload(this)">
            <span class="sub-logo-hint">JPG, PNG or WebP · Max 2 MB</span>
          </div>
        ` : `
          <div class="sub-logo-locked">
            <span class="sub-lock-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
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
        <div class="sub-section-title" style="margin-top:24px;margin-bottom:14px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> Available Plans</div>
        <div class="sub-upgrade-grid">${upgradeCards}</div>
      ` : `
        <div class="sub-active-msg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg> You're on the <strong>${plan.name}</strong> plan. Enjoying full access!
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
  // Checks for an existing pending request first so we can show
  // "Verification Pending" instead of re-opening the modal.
  async function _handleUpgradeClick(planId) {
    const plan = PLANS[planId];
    if (!plan) return;

    // Disable the clicked button immediately to prevent double-clicks
    const btn = document.querySelector(`.sub-upgrade-btn[onclick*="${planId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

    try {
      const uid     = Auth.getUserId();
      const pending = uid ? await _getPendingRequest(uid, planId) : null;

      if (pending) {
        // Already submitted — show pending state instead of re-opening modal
        _showPendingBadge(planId, pending.created_at);
      } else {
        _showUpgradeModal(plan);
      }
    } catch (err) {
      console.warn('[Billing] _handleUpgradeClick:', err);
      _showUpgradeModal(plan); // fallback: show modal even if DB check failed
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = `Upgrade to ${plan.name} →`; }
    }
  }

  // ─── Internal: check for existing pending request ─────────────
  async function _getPendingRequest(uid, planId) {
    const { data } = await _supabase
      .from('subscription_requests')
      .select('id, created_at, status')
      .eq('user_id', uid)
      .eq('plan_name', planId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  }

  // ─── Internal: show "Verification Pending" in place of button ──
  function _showPendingBadge(planId, createdAt) {
    // Find and update the upgrade card for this plan
    const card = document.querySelector(`.sub-upgrade-card[data-plan-id="${planId}"]`);
    const btn  = card?.querySelector('.sub-upgrade-btn');
    if (btn) {
      btn.disabled = true;
      btn.className = 'btn sub-upgrade-btn sub-upgrade-btn-pending';
      btn.textContent = 'Verification Pending';
      btn.style.cssText = 'background:#F59E0B;color:#fff;cursor:default;opacity:1';
    }

    const fmt = createdAt
      ? new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';

    UI.toast(
      `Your ${PLANS[planId]?.name} upgrade request is under review${fmt ? ` (submitted ${fmt})` : ''}. We'll activate within 2 hours.`,
      'info'
    );
  }

  // ─── Internal: NEW upgrade modal — QR + screenshot upload ──────
  //
  // PHASE 1 UPGRADE FLOW:
  //   1. Seller sees the plan's Google Pay QR image + amount
  //   2. Seller pays and uploads a screenshot from their gallery
  //   3. Screenshot is stored in Supabase Storage:
  //        subscription-proofs/{uid}/{timestamp}.{ext}
  //   4. A row is inserted into subscription_requests table
  //   5. Admin notification email is sent via EmailJS with:
  //        - seller name, email, store, plan, amount
  //        - screenshot public URL (no attachment needed)
  //   6. Upgrade button switches to "Verification Pending" state
  //   7. Admin reviews screenshot and manually updates plan in Supabase
  //
  // FUTURE PHASE 2: Replace step 1-4 with Razorpay/PhonePe SDK call.
  //   The _handleUpgradeClick entry-point and _showPendingBadge remain unchanged.
  //
  // QR IMAGES: Host your Google Pay QR at a stable public URL and set
  // the constants below. Use any image CDN or Supabase storage.
  //
  const QR_IMAGES = {
    bronze:   '../bronze plan.jfif',   // ← replace with your QR URL
    platinum: '../platinum plan.jfif',  // ← replace with your QR URL
  };

  // Admin email — receives notification for every upgrade request.
  // Must be an email registered as a recipient in your EmailJS template.
  const ADMIN_EMAIL = 'hisaabmitra@gmail.com'; // ← replace with your admin email

  function _showUpgradeModal(plan) {
    document.getElementById('upgrade-modal')?.remove();

    const qrUrl  = QR_IMAGES[plan.id] || '';
    const hasQR  = !!qrUrl && !qrUrl.includes('your-cdn.com');

    const modal = document.createElement('div');
    modal.id        = 'upgrade-modal';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal upgrade-modal-inner" style="max-width:460px">
        <div class="modal-header">
          <div class="modal-title">Upgrade to ${plan.name}</div>
          <button class="modal-close" onclick="document.getElementById('upgrade-modal').remove()">✕</button>
        </div>

        <!-- Plan summary pill -->
        <div class="payment-plan-summary">
          <div class="payment-plan-badge" style="background:${plan.colorDim};color:${plan.color}">${plan.badge}</div>
          <div class="payment-plan-price">${plan.priceText}</div>
        </div>

        <!-- Step 1: QR code or fallback UPI text -->
        <div class="upg-step">
          <div class="upg-step-num" style="background:${plan.colorDim};color:${plan.color}">1</div>
          <div class="upg-step-body">
            <div class="upg-step-title">Pay ₹${plan.price} via Google Pay</div>
            <div class="upg-step-desc">Scan the QR code with any UPI app</div>
            ${hasQR ? `
              <div class="upg-qr-wrap">
                <img src="${qrUrl}" alt="Google Pay QR for ₹${plan.price}"
                     class="upg-qr-img"
                     onerror="this.parentElement.innerHTML='<div class=upg-qr-fallback>QR unavailable — pay to: <strong>hisaabmitra@upi</strong></div>'">
                <div class="upg-qr-amount">₹${plan.price}</div>
              </div>` : `
              <div class="upg-qr-fallback">
                Pay via UPI: <strong style="color:var(--accent)">hisaabmitra@upi</strong>
              </div>`}
          </div>
        </div>

        <!-- Step 2: Screenshot upload -->
        <div class="upg-step">
          <div class="upg-step-num" style="background:${plan.colorDim};color:${plan.color}">2</div>
          <div class="upg-step-body">
            <div class="upg-step-title">Upload Payment Screenshot</div>
            <div class="upg-step-desc">Take a screenshot of your payment confirmation</div>
            <div class="upg-upload-area" id="upg-upload-area" onclick="document.getElementById('upg-screenshot-input').click()">
              <div class="upg-upload-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
              <div class="upg-upload-label">Tap to select screenshot</div>
              <div class="upg-upload-hint">JPG or PNG · max 5 MB</div>
            </div>
            <input type="file" id="upg-screenshot-input" accept="image/jpeg,image/png,image/webp"
              style="display:none" onchange="Billing._handleScreenshotSelect(this, '${plan.id}')">
            <div id="upg-preview-wrap" style="display:none">
              <img id="upg-preview-img" class="upg-preview-img" alt="Payment screenshot">
              <button class="upg-remove-btn" onclick="Billing._clearScreenshot()">✕ Remove</button>
            </div>
          </div>
        </div>

        <!-- Step 3: Submit -->
        <div class="upg-step" style="border-bottom:none;padding-bottom:0">
          <div class="upg-step-num" style="background:${plan.colorDim};color:${plan.color}">3</div>
          <div class="upg-step-body">
            <div class="upg-step-title">Submit for Verification</div>
            <div class="upg-step-desc">We'll review and activate your plan within 2 hours</div>
            <button class="btn btn-primary upg-submit-btn" id="upg-submit-btn"
              onclick="Billing._submitUpgradeRequest('${plan.id}')" disabled>
              Submit Request →
            </button>
          </div>
        </div>

        <p class="upg-footer-note">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Your screenshot is stored securely. We'll notify you once verified.
        </p>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.remove();
    });
  }

  // ─── Internal: screenshot file selected ──────────────────────
  // Updates the preview image and enables the submit button.
  function _handleScreenshotSelect(input, planId) {
    const file = input?.files?.[0];
    if (!file) return;

    // Validate size (5 MB max for screenshots)
    if (file.size > 5 * 1024 * 1024) {
      UI.toast('Screenshot must be under 5 MB.', 'error');
      input.value = '';
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = e => {
      const previewImg  = document.getElementById('upg-preview-img');
      const previewWrap = document.getElementById('upg-preview-wrap');
      const uploadArea  = document.getElementById('upg-upload-area');
      const submitBtn   = document.getElementById('upg-submit-btn');

      if (previewImg)  previewImg.src = e.target.result;
      if (previewWrap) previewWrap.style.display = 'flex';
      if (uploadArea)  uploadArea.style.display  = 'none';
      if (submitBtn)   submitBtn.disabled         = false;
    };
    reader.readAsDataURL(file);
  }

  // ─── Internal: clear screenshot selection ─────────────────────
  function _clearScreenshot() {
    const input      = document.getElementById('upg-screenshot-input');
    const previewWrap = document.getElementById('upg-preview-wrap');
    const uploadArea  = document.getElementById('upg-upload-area');
    const submitBtn   = document.getElementById('upg-submit-btn');

    if (input)       input.value = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (uploadArea)  uploadArea.style.display  = '';
    if (submitBtn)   submitBtn.disabled         = true;
  }

  // ─── Internal: submit upgrade request ────────────────────────
  async function _submitUpgradeRequest(planId) {
    const plan  = PLANS[planId];
    if (!plan) return;

    const uid   = Auth.getUserId();
    if (!uid) { UI.toast('Not authenticated. Please log in again.', 'error'); return; }

    const input = document.getElementById('upg-screenshot-input');
    const file  = input?.files?.[0];
    if (!file) { UI.toast('Please select a payment screenshot first.', 'error'); return; }

    // ── Show loading state on submit button ──────────────────
    const submitBtn = document.getElementById('upg-submit-btn');
    if (submitBtn) {
      submitBtn.disabled   = true;
      submitBtn.innerHTML  = '<span style="display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:6px"></span>Uploading…';
    }

    try {
      // ── 1. Upload screenshot to Supabase Storage ─────────────
      //
      // Path: subscription-proofs/{uid}/{timestamp}.{ext}
      // Bucket must be PUBLIC for the URL to be accessible by admin.
      //
      const ext       = file.name.split('.').pop().toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const path      = `${uid}/${timestamp}.${ext}`;

      const { error: uploadErr } = await _supabase.storage
        .from('subscription-proofs')
        .upload(path, file, {
          upsert:      false,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadErr) {
        console.error('[Billing] Screenshot upload error:', uploadErr);
        // Provide specific error guidance
        if (uploadErr.statusCode === '403' || uploadErr.message?.includes('security')) {
          UI.toast(
            'Upload blocked — run the storage RLS SQL for "subscription-proofs" bucket. See billing.js header.',
            'error'
          );
        } else if (uploadErr.message?.includes('bucket') || uploadErr.message?.includes('not found')) {
          UI.toast(
            'Bucket "subscription-proofs" not found. Create it in Supabase → Storage (set to Public).',
            'error'
          );
        } else {
          UI.toast(`Upload failed: ${uploadErr.message || 'Unknown error'}`, 'error');
        }
        return;
      }

      // ── 2. Get public URL ─────────────────────────────────────
      const { data: urlData } = _supabase.storage
        .from('subscription-proofs')
        .getPublicUrl(path);

      const screenshotUrl = urlData?.publicUrl || null;
      if (!screenshotUrl) {
        UI.toast('Could not get screenshot URL. Make sure the bucket is set to Public.', 'error');
        return;
      }

      // ── 3. Insert row into subscription_requests ──────────────
      //
      // SQL to create this table (run once in Supabase SQL editor):
      //
      //   CREATE TABLE IF NOT EXISTS public.subscription_requests (
      //     id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      //     user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      //     plan_name      TEXT        NOT NULL,
      //     amount         NUMERIC     NOT NULL,
      //     screenshot_url TEXT        NOT NULL,
      //     status         TEXT        NOT NULL DEFAULT 'pending',
      //     created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      //   );
      //
      //   ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
      //
      //   CREATE POLICY "Users manage own requests"
      //   ON public.subscription_requests FOR ALL
      //   USING (auth.uid() = user_id);
      //
      const { error: dbErr } = await _supabase
        .from('subscription_requests')
        .insert({
          user_id:        uid,
          plan_name:      planId,
          amount:         plan.price,
          screenshot_url: screenshotUrl,
          status:         'pending',
        });

      if (dbErr) {
        console.error('[Billing] subscription_requests insert error:', dbErr);
        UI.toast(
          `Failed to save request: ${dbErr.message}. Make sure you ran the subscription_requests table SQL.`,
          'error'
        );
        return;
      }

      // ── 4. Send admin notification email via EmailJS ──────────
      //
      // Email contains the screenshot URL — no file attachment needed.
      // The admin clicks the link to view the screenshot in their browser.
      //
      // EmailJS template variables used:
      //   customer_name    — seller's name
      //   customer_email   — ADMIN email (so admin receives this)
      //   order_id         — "SUB-REQUEST-BRONZE" etc. (for subject line)
      //   store_name       — seller's store name
      //   total            — plan price string
      //   payment_status   — human summary line
      //   invoice_html     — full email body HTML (no attachment)
      //
      await _sendUpgradeRequestEmail(planId, screenshotUrl);

      // ── 5. Success UX ─────────────────────────────────────────
      document.getElementById('upgrade-modal')?.remove();
      UI.toast(`Request submitted! We'll activate ${plan.name} within 2 hours.`, 'success');

      // Re-render subscription section to show pending badge
      const profile = await SF.getUser();
      await renderSubscriptionSection(profile);

    } catch (err) {
      console.error('[Billing] _submitUpgradeRequest failed:', err);
      UI.toast('Something went wrong. Please try again.', 'error');
    } finally {
      if (submitBtn && document.contains(submitBtn)) {
        submitBtn.disabled  = false;
        submitBtn.innerHTML = 'Submit Request →';
      }
    }
  }

  // ─── Internal: send admin notification email ──────────────────
  async function _sendUpgradeRequestEmail(planId, screenshotUrl) {
    if (typeof emailjs === 'undefined') return;
    if (EMAILJS_SERVICE_ID.startsWith('YOUR_') || EMAILJS_UPGRADE_TEMPLATE_ID.startsWith('template_REPLACE')) return;

    try {
      const profile     = await _getRawProfile();
      const plan        = PLANS[planId] || {};
      const sellerName  = profile?.name  || 'Unknown Seller';
      const sellerEmail = profile?.email || 'No email';
      const storeName   = profile?.store || 'Unknown Store';
      const now         = new Date().toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      // Uses the dedicated upgrade-request template whose "To" is
      // hardcoded to hisaabmitra@gmail.com in the EmailJS dashboard.
      // Variable names match that template exactly.
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_UPGRADE_TEMPLATE_ID, {
        seller_name:    sellerName,
        seller_email:   sellerEmail,
        store_name:     storeName,
        plan_name:      plan.name  || planId,
        plan_id:        planId,
        amount:         plan.price || 0,
        submitted_at:   now,
        screenshot_url: screenshotUrl || 'Not provided',
      });
    } catch (err) {
      // Email failure is non-fatal — request is already saved in DB
      console.warn('[Billing] Admin notification email failed:', err);
    }
  }

  // ─── Internal: copy UPI ID ────────────────────────────────────
  function _copyUPI() {
    const upi = 'hisaabmitra@upi';
    navigator.clipboard?.writeText(upi).then(() => {
      UI.toast('UPI ID copied!', 'success');
    }).catch(() => UI.toast('UPI: hisaabmitra@upi', 'info'));
  }

  // ─── Internal: "I've paid" confirmation (legacy — kept for compat)
  async function _handlePaymentConfirm(planId) {
    // This function is now superseded by _submitUpgradeRequest.
    // Kept here so any existing onclick references don't break.
    document.getElementById('payment-modal')?.remove();
    document.getElementById('upgrade-modal')?.remove();
    UI.toast('Please use the new upgrade flow in Settings → Subscription.', 'info');
  }

  // ─── Internal: logo upload handler ──────────────────────────
  async function _handleLogoUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;

    // ── Show loading state ───────────────────────────────────
    const uploadLabel = document.querySelector('.sub-logo-label');
    const preview     = document.getElementById('sub-logo-preview');

    if (uploadLabel) {
      uploadLabel.textContent = 'Uploading…';
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
    // Upgrade flow — exposed for inline onclick use in dynamically rendered HTML
    _handleTrialActivate,
    _handleUpgradeClick,
    _handleScreenshotSelect,
    _clearScreenshot,
    _submitUpgradeRequest,
    _handlePaymentConfirm,   // kept for backward-compat; now a no-op redirect
    _handleLogoUpload,
    _handleDeleteLogo,
    _copyUPI,
    _renderPlanBanner,
  };
})();
