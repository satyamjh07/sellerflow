// Hisaab Mitra — Invoice Templates Module
// Scalable template registry + selection UI + Supabase persistence.
//
// ══════════════════════════════════════════════════════════════════
// SUPABASE SETUP (run once in SQL Editor):
//
//   ALTER TABLE profiles
//     ADD COLUMN IF NOT EXISTS invoice_template TEXT NOT NULL DEFAULT 'classic_pro';
//
// ══════════════════════════════════════════════════════════════════
//
// ARCHITECTURE
//   InvoiceTemplates.REGISTRY          — all template definitions
//   InvoiceTemplates.getActive()       — returns current template id (string)
//   InvoiceTemplates.setActive(id)     — update in memory + re-render UI
//   InvoiceTemplates.loadFromProfile() — fetch from Supabase on login
//   InvoiceTemplates.save()            — persist to Supabase
//   InvoiceTemplates.renderPage()      — mount the full templates page
//   InvoiceTemplates.apply(o, user)    — generate invoice HTML using active template
//
// ADDING NEW TEMPLATES
//   1. Add an entry to REGISTRY below.
//   2. Add a render function in TemplateRenderers (components.js or here).
//   3. Done — the UI picks it up automatically.
//
// ══════════════════════════════════════════════════════════════════

const InvoiceTemplates = (() => {

  // ── Template Registry ─────────────────────────────────────────
  // Single source of truth. Each template is a pure config object.
  // tier: 'free' | 'bronze' | 'platinum'  (for future gating)
  const REGISTRY = [
    {
      id:          'classic_pro',
      name:        'Classic Professional',
      tagline:     'Clean & trusted — for every seller',
      tier:        'free',
      personality: 'professional',
      palette:     { accent: '#6366F1', surface: '#f8f8f8', text: '#1a1a1a', border: '#e8e8e8' },
      preview: {
        headerStyle:  'left-logo',
        accentBar:    false,
        fontStyle:    'serif-modern',
        labelStyle:   'uppercase-muted',
        totalStyle:   'accent-bold',
        footerStyle:  'center-simple',
      },
      thumbColors: { bg: '#ffffff', accent: '#6366F1', surface: '#f0f0ff', text: '#333' },
      description: 'Timeless layout. Left-aligned branding, clean tables, indigo totals. Works for any business.',
    },
    {
      id:          'modern_minimal',
      name:        'Modern Minimal',
      tagline:     'Less noise, more elegance',
      tier:        'free',
      personality: 'minimal',
      palette:     { accent: '#111111', surface: '#fafafa', text: '#111111', border: '#eeeeee' },
      preview: {
        headerStyle:  'center-logo',
        accentBar:    false,
        fontStyle:    'geometric',
        labelStyle:   'light-gray',
        totalStyle:   'bold-black',
        footerStyle:  'right-minimal',
      },
      thumbColors: { bg: '#ffffff', accent: '#111111', surface: '#f5f5f5', text: '#111' },
      description: 'Whitespace-first. Centered header, hairline borders, dark typography. For founders who value restraint.',
    },
    {
      id:          'gst_business',
      name:        'GST Business',
      tagline:     'Fully GST-compliant, audit-ready',
      tier:        'bronze',
      personality: 'formal',
      palette:     { accent: '#1d4ed8', surface: '#eff6ff', text: '#1e3a5f', border: '#dbeafe' },
      preview: {
        headerStyle:  'left-logo',
        accentBar:    true,
        fontStyle:    'traditional',
        labelStyle:   'blue-caps',
        totalStyle:   'blue-bold',
        footerStyle:  'gst-footer',
      },
      thumbColors: { bg: '#f0f7ff', accent: '#1d4ed8', surface: '#dbeafe', text: '#1e3a5f' },
      description: 'GSTIN front-and-center. Blue official palette, HSN fields, tax breakdown ready. Perfect for registered businesses.',
    },
    {
      id:          'boutique_premium',
      name:        'Boutique Premium',
      tagline:     'Jewellery, fashion & luxury sellers',
      tier:        'bronze',
      personality: 'luxury',
      palette:     { accent: '#92400e', surface: '#fdf8f0', text: '#1c1917', border: '#e7d5b8' },
      preview: {
        headerStyle:  'center-logo',
        accentBar:    true,
        fontStyle:    'elegant',
        labelStyle:   'gold-caps',
        totalStyle:   'gold-bold',
        footerStyle:  'boutique-center',
      },
      thumbColors: { bg: '#fdf8f0', accent: '#92400e', surface: '#e7d5b8', text: '#1c1917' },
      description: 'Warm gold tones, elegant spacing, serif accents. Elevates every order for fashion & jewellery brands.',
    },
    {
      id:          'bold_startup',
      name:        'Bold Startup',
      tagline:     'Make your brand unforgettable',
      tier:        'platinum',
      personality: 'bold',
      palette:     { accent: '#d02752', surface: '#fff5f7', text: '#111827', border: '#fce7eb' },
      preview: {
        headerStyle:  'accent-band',
        accentBar:    true,
        fontStyle:    'display',
        labelStyle:   'white-on-accent',
        totalStyle:   'pink-xl',
        footerStyle:  'bold-cta',
      },
      thumbColors: { bg: '#fff5f7', accent: '#d02752', surface: '#fce7eb', text: '#111827' },
      description: 'Full-bleed accent header, punchy typography, brand-forward. Designed for D2C startups who want to be remembered.',
    },
    {
      id:          'festive_diwali',
      name:        'Festive Edition',
      tagline:     'Diwali • Navratri • Sale events',
      tier:        'platinum',
      personality: 'festive',
      palette:     { accent: '#b45309', surface: '#fffbeb', text: '#292524', border: '#fde68a' },
      preview: {
        headerStyle:  'festive-band',
        accentBar:    true,
        fontStyle:    'display',
        labelStyle:   'gold-festive',
        totalStyle:   'amber-bold',
        footerStyle:  'festive-footer',
      },
      thumbColors: { bg: '#fffbeb', accent: '#b45309', surface: '#fde68a', text: '#292524' },
      description: 'Warm amber festival palette, celebratory layout. Show customers you celebrate their special orders.',
    },
  ];

  // ── State ─────────────────────────────────────────────────────
  let _activeId    = 'classic_pro';
  let _savedId     = 'classic_pro'; // last persisted value
  let _isSaving    = false;

  // ── Getters ───────────────────────────────────────────────────
  function getActive()   { return _activeId; }
  function getTemplate() { return REGISTRY.find(t => t.id === _activeId) || REGISTRY[0]; }
  function getById(id)   { return REGISTRY.find(t => t.id === id); }
  function isDirty()     { return _activeId !== _savedId; }

  // ── Supabase load ─────────────────────────────────────────────
  async function loadFromProfile() {
    try {
      const uid = Auth.getUserId();
      if (!uid) return;
      const { data, error } = await _supabase
        .from('profiles')
        .select('invoice_template')
        .eq('id', uid)
        .single();
      if (error) throw error;
      if (data?.invoice_template) {
        const exists = REGISTRY.find(t => t.id === data.invoice_template);
        _activeId = exists ? data.invoice_template : 'classic_pro';
        _savedId  = _activeId;
      }
    } catch (e) {
      console.warn('[InvoiceTemplates] loadFromProfile:', e.message);
    }
  }

  // ── Supabase save ─────────────────────────────────────────────
  async function save() {
    if (_isSaving) return;
    if (!isDirty()) {
      UI.toast('This template is already active', 'info');
      return;
    }
    _isSaving = true;
    _setSaveBtnState('saving');
    try {
      const uid = Auth.getUserId();
      if (!uid) throw new Error('Not logged in');
      const { error } = await _supabase
        .from('profiles')
        .update({ invoice_template: _activeId })
        .eq('id', uid);
      if (error) throw error;
      _savedId = _activeId;
      UI.toast('Invoice template saved ✓', 'success');
      _setSaveBtnState('saved');
      _refreshCards(); // update "Currently Active" badge
    } catch (e) {
      UI.toast(e.message || 'Save failed', 'error');
      _setSaveBtnState('idle');
    } finally {
      _isSaving = false;
    }
  }

  // ── In-memory update (optimistic) ────────────────────────────
  function setActive(id) {
    const tpl = REGISTRY.find(t => t.id === id);
    if (!tpl) return;
    _activeId = id;
    _refreshCards();
    _setSaveBtnState(id === _savedId ? 'current' : 'idle');
  }

  // ── Invoice HTML generation ───────────────────────────────────
  // Delegates to TemplateRenderers map. Falls back to 'classic_pro'.
  function apply(order, user) {
    const tpl = getTemplate();
    const renderer = TemplateRenderers[tpl.id] || TemplateRenderers['classic_pro'];
    return renderer(order, user, tpl);
  }

  // ── Page renderer ─────────────────────────────────────────────
  function renderPage() {
    const container = document.getElementById('invoice-templates-page');
    if (!container) return;

    // Check plan for tier gating
    const plan = (typeof Billing !== 'undefined') ? Billing.getCurrentPlan() : 'platinum';

    container.innerHTML = `
      <div class="it-page">
        <!-- Header -->
        <div class="it-header">
          <div class="it-header-left">
            <h1 class="it-title">Invoice Templates</h1>
            <p class="it-subtitle">Choose how your invoices look to customers. Applied to all future invoices automatically.</p>
          </div>
          <div class="it-header-actions">
            <button class="it-save-btn" id="it-save-btn" onclick="InvoiceTemplates.save()">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span id="it-save-label">Save Template</span>
            </button>
          </div>
        </div>

        <!-- Skeleton or Grid -->
        <div class="it-grid" id="it-grid">
          ${REGISTRY.map(tpl => _cardHTML(tpl, plan)).join('')}
        </div>

        <!-- Mobile sticky CTA -->
        <div class="it-mobile-save" id="it-mobile-save">
          <div class="it-mobile-save-inner">
            <div class="it-mobile-active-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>
              <span id="it-mobile-active-name">${_activeName()}</span>
            </div>
            <button class="it-save-btn it-save-btn-mobile" onclick="InvoiceTemplates.save()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  function _activeName() {
    const t = getTemplate();
    return t ? t.name : 'Classic Professional';
  }

  function _cardHTML(tpl, plan) {
    const isActive   = tpl.id === _activeId;
    const isSaved    = tpl.id === _savedId;
    const isLocked   = _isLocked(tpl.tier, plan);
    const tierLabel  = { free: '', bronze: 'Bronze+', platinum: 'Platinum' }[tpl.tier] || '';

    return `
      <div
        class="it-card${isActive ? ' it-card--selected' : ''}${isLocked ? ' it-card--locked' : ''}"
        data-id="${tpl.id}"
        onclick="InvoiceTemplates._onCardClick('${tpl.id}')"
        role="button"
        tabindex="0"
        aria-label="Select ${tpl.name} template"
        onkeydown="if(event.key==='Enter'||event.key===' ')InvoiceTemplates._onCardClick('${tpl.id}')"
      >
        <!-- Tier badge -->
        ${tierLabel ? `<div class="it-tier-badge it-tier-${tpl.tier}">${tierLabel}</div>` : ''}

        <!-- Lock overlay -->
        ${isLocked ? `
          <div class="it-lock-overlay">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;margin-bottom:8px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div style="font-size:13px;font-weight:700">Upgrade to ${tierLabel}</div>
            <div style="font-size:11px;opacity:0.75;margin-top:3px">Unlock this template</div>
          </div>
        ` : ''}

        <!-- Currently active label -->
        ${isSaved ? `<div class="it-active-tag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg> Active</div>` : ''}

        <!-- Visual thumbnail -->
        <div class="it-thumb" style="--it-bg:${tpl.thumbColors.bg};--it-accent:${tpl.thumbColors.accent};--it-surface:${tpl.thumbColors.surface};--it-text:${tpl.thumbColors.text}">
          ${_thumbSVG(tpl)}
        </div>

        <!-- Card footer -->
        <div class="it-card-body">
          <div class="it-card-name">${tpl.name}</div>
          <div class="it-card-tagline">${tpl.tagline}</div>
          <div class="it-card-desc">${tpl.description}</div>
          <div class="it-card-select${isActive ? ' it-card-select--active' : ''}">
            ${isActive
              ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Selected`
              : 'Select Template'}
          </div>
        </div>
      </div>
    `;
  }

  function _thumbSVG(tpl) {
    const a = tpl.thumbColors.accent;
    const s = tpl.thumbColors.surface;
    const t = tpl.thumbColors.text;
    const bg = tpl.thumbColors.bg;

    // Shared mini-invoice SVG skeleton, styled per template personality
    const p = tpl.preview;

    // Header band for bold/festive styles
    const headerBand = (p.headerStyle === 'accent-band' || p.headerStyle === 'festive-band')
      ? `<rect x="0" y="0" width="260" height="38" fill="${a}" rx="0"/>`
      : '';

    const headerBandText = (p.headerStyle === 'accent-band' || p.headerStyle === 'festive-band')
      ? `<text x="14" y="24" font-family="Arial" font-size="11" font-weight="700" fill="white">INVOICE</text>`
      : '';

    const logoY = (p.headerStyle === 'accent-band' || p.headerStyle === 'festive-band') ? 48 : 14;
    const logoX = (p.headerStyle === 'center-logo') ? 100 : 14;
    const logoW = 60;
    const logoAnchor = (p.headerStyle === 'center-logo') ? 'middle' : 'start';

    const storeName = p.headerStyle === 'center-logo'
      ? `<text x="130" y="${logoY+8}" font-family="Arial" font-size="9" font-weight="700" fill="${a}" text-anchor="middle">STORE NAME</text>`
      : `<rect x="14" y="${logoY}" width="${logoW}" height="9" rx="2" fill="${a}" opacity="0.9"/>`;

    const invTitle = (p.headerStyle === 'accent-band' || p.headerStyle === 'festive-band')
      ? ''
      : `<text x="246" y="${logoY+7}" font-family="Arial" font-size="9" font-weight="700" fill="${t}" text-anchor="end" opacity="0.85">INVOICE</text>`;

    const dividerY = (p.headerStyle === 'accent-band' || p.headerStyle === 'festive-band') ? 44 : logoY + 18;

    return `
      <svg viewBox="0 0 260 178" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="border-radius:6px;display:block">
        <!-- bg -->
        <rect width="260" height="178" fill="${bg}" rx="6"/>
        <!-- accent band -->
        ${headerBand}
        ${headerBandText}

        <!-- store name / logo area -->
        ${storeName}
        ${invTitle}

        <!-- divider -->
        <line x1="14" y1="${dividerY+2}" x2="246" y2="${dividerY+2}" stroke="${a}" stroke-width="${p.accentBar ? 1.5 : 0.5}" opacity="${p.accentBar ? 0.6 : 0.25}"/>

        <!-- from / bill to labels -->
        <text x="14" y="${dividerY+14}" font-family="Arial" font-size="6" fill="${a}" font-weight="700" opacity="0.65" letter-spacing="0.5">FROM</text>
        <text x="150" y="${dividerY+14}" font-family="Arial" font-size="6" fill="${a}" font-weight="700" opacity="0.65" letter-spacing="0.5">BILL TO</text>

        <rect x="14" y="${dividerY+17}" width="50" height="5" rx="1.5" fill="${t}" opacity="0.35"/>
        <rect x="14" y="${dividerY+25}" width="35" height="3.5" rx="1" fill="${t}" opacity="0.18"/>
        <rect x="150" y="${dividerY+17}" width="45" height="5" rx="1.5" fill="${t}" opacity="0.35"/>
        <rect x="150" y="${dividerY+25}" width="30" height="3.5" rx="1" fill="${t}" opacity="0.18"/>

        <!-- table header -->
        <rect x="14" y="${dividerY+36}" width="232" height="13" fill="${s}" rx="2"/>
        <text x="18" y="${dividerY+46}" font-family="Arial" font-size="5.5" fill="${t}" opacity="0.55" font-weight="700">PRODUCT</text>
        <text x="180" y="${dividerY+46}" font-family="Arial" font-size="5.5" fill="${t}" opacity="0.55" font-weight="700" text-anchor="middle">QTY</text>
        <text x="242" y="${dividerY+46}" font-family="Arial" font-size="5.5" fill="${t}" opacity="0.55" font-weight="700" text-anchor="end">TOTAL</text>

        <!-- row 1 -->
        <rect x="14" y="${dividerY+52}" width="232" height="10" fill="${bg}" rx="1"/>
        <rect x="18" y="${dividerY+55}" width="55" height="4" rx="1" fill="${t}" opacity="0.22"/>
        <text x="180" y="${dividerY+62}" font-family="Arial" font-size="5" fill="${t}" opacity="0.4" text-anchor="middle">1</text>
        <rect x="210" y="${dividerY+55}" width="32" height="4" rx="1" fill="${t}" opacity="0.22"/>

        <!-- row 2 -->
        <rect x="14" y="${dividerY+64}" width="232" height="10" fill="${s}" opacity="0.6" rx="1"/>
        <rect x="18" y="${dividerY+67}" width="45" height="4" rx="1" fill="${t}" opacity="0.18"/>
        <text x="180" y="${dividerY+74}" font-family="Arial" font-size="5" fill="${t}" opacity="0.4" text-anchor="middle">2</text>
        <rect x="210" y="${dividerY+67}" width="28" height="4" rx="1" fill="${t}" opacity="0.18"/>

        <!-- divider before total -->
        <line x1="150" y1="${dividerY+78}" x2="246" y2="${dividerY+78}" stroke="${t}" stroke-width="0.5" opacity="0.15"/>

        <!-- total row -->
        <text x="156" y="${dividerY+89}" font-family="Arial" font-size="6.5" font-weight="700" fill="${t}" opacity="0.6">Total Due</text>
        <text x="246" y="${dividerY+89}" font-family="Arial" font-size="7.5" font-weight="800" fill="${a}" text-anchor="end">₹2,499</text>

        <!-- footer line -->
        <line x1="14" y1="${dividerY+98}" x2="246" y2="${dividerY+98}" stroke="${t}" stroke-width="0.4" opacity="0.1"/>
        <rect x="80" y="${dividerY+103}" width="100" height="3" rx="1" fill="${t}" opacity="0.1"/>
      </svg>
    `;
  }

  // ── Internal helpers ──────────────────────────────────────────
  function _isLocked(tier, plan) {
    if (!plan) return false;
    if (tier === 'free')     return false;
    if (tier === 'bronze')   return plan === 'free';
    if (tier === 'platinum') return plan === 'free' || plan === 'bronze';
    return false;
  }

  function _refreshCards() {
    const grid = document.getElementById('it-grid');
    if (!grid) return;
    const plan = (typeof Billing !== 'undefined') ? Billing.getCurrentPlan() : 'platinum';
    grid.innerHTML = REGISTRY.map(tpl => _cardHTML(tpl, plan)).join('');
    // Update mobile active name
    const mobileLabel = document.getElementById('it-mobile-active-name');
    if (mobileLabel) mobileLabel.textContent = _activeName();
  }

  function _setSaveBtnState(state) {
    const btn   = document.getElementById('it-save-btn');
    const label = document.getElementById('it-save-label');
    if (!btn || !label) return;
    btn.classList.remove('it-save-btn--saving', 'it-save-btn--saved', 'it-save-btn--current');
    if (state === 'saving') {
      label.textContent = 'Saving…';
      btn.classList.add('it-save-btn--saving');
      btn.disabled = true;
    } else if (state === 'saved') {
      label.textContent = 'Saved ✓';
      btn.classList.add('it-save-btn--saved');
      btn.disabled = false;
      setTimeout(() => { label.textContent = 'Save Template'; }, 2200);
    } else if (state === 'current') {
      label.textContent = 'Already Active';
      btn.classList.add('it-save-btn--current');
      btn.disabled = false;
      setTimeout(() => { label.textContent = 'Save Template'; btn.classList.remove('it-save-btn--current'); }, 1800);
    } else {
      label.textContent = 'Save Template';
      btn.disabled = false;
    }
  }

  // Public: card click handler (exposed so onclick="" works)
  function _onCardClick(id) {
    const plan = (typeof Billing !== 'undefined') ? Billing.getCurrentPlan() : 'platinum';
    const tpl  = REGISTRY.find(t => t.id === id);
    if (!tpl) return;
    if (_isLocked(tpl.tier, plan)) {
      UI.toast(`Upgrade to ${tpl.tier === 'bronze' ? 'Bronze' : 'Platinum'} to use this template`, 'warn');
      return;
    }
    setActive(id);
  }

  return {
    REGISTRY,
    getActive,
    getTemplate,
    getById,
    isDirty,
    loadFromProfile,
    save,
    setActive,
    apply,
    renderPage,
    _onCardClick, // exposed for inline onclick
  };
})();


// ══════════════════════════════════════════════════════════════════
// Template Renderers
// Each renderer: (order, user, template) => HTML string
// Mirrors the existing Components.InvoiceTemplate() contract.
// ══════════════════════════════════════════════════════════════════

const TemplateRenderers = (() => {

  // ── Shared helpers ────────────────────────────────────────────
  function fc(v) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
  }
  function fd(d) {
    return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  function statusBadge(isPaid, accentColor, pendingColor) {
    return isPaid
      ? `<span style="display:inline-block;padding:4px 14px;border-radius:99px;background:#d1fae5;color:#059669;font-size:11px;font-weight:700;letter-spacing:0.5px">PAID</span>`
      : `<span style="display:inline-block;padding:4px 14px;border-radius:99px;background:#fef3c7;color:#d97706;font-size:11px;font-weight:700;letter-spacing:0.5px">PENDING</span>`;
  }
  function brandBlock(user, accentColor, showLogo) {
    const logoUrl = user.logoUrl || null;
    if (showLogo && logoUrl) {
      return `<img src="${logoUrl}" alt="${user.store || 'Store'}" style="max-height:52px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px">`;
    }
    return `<div style="font-size:22px;font-weight:800;color:${accentColor};letter-spacing:-0.8px;line-height:1">${user.store || 'Your Store'}</div>`;
  }
  function storeDetails(user, textColor) {
    return [
      user.instagram && `<p style="font-size:12px;color:${textColor};margin:3px 0;opacity:0.7">${user.instagram}</p>`,
      user.phone     && `<p style="font-size:12px;color:${textColor};margin:3px 0;opacity:0.7">${user.phone}</p>`,
      user.email     && `<p style="font-size:12px;color:${textColor};margin:3px 0;opacity:0.7">${user.email}</p>`,
      user.gstNumber && `<p style="font-size:11px;color:${textColor};margin:3px 0;opacity:0.7"><b>GSTIN:</b> ${user.gstNumber}</p>`,
    ].filter(Boolean).join('');
  }
  function itemsTable(o, C, evenBg, oddBg) {
    const rows = o.items.map((item, i) => `
      <tr style="background:${i % 2 === 0 ? evenBg : oddBg}">
        <td style="padding:11px 14px;font-size:12px;color:${C.muted};border-bottom:1px solid ${C.border}">${i+1}</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:600;color:${C.text};border-bottom:1px solid ${C.border}">
          ${item.name}${item.variant ? `<div style="font-size:11px;color:${C.muted};font-weight:400;margin-top:2px">${item.variant}</div>` : ''}
        </td>
        <td style="padding:11px 14px;font-size:13px;color:${C.muted};text-align:center;border-bottom:1px solid ${C.border}">${item.qty}</td>
        <td style="padding:11px 14px;font-size:13px;color:${C.muted};text-align:right;border-bottom:1px solid ${C.border}">${fc(item.price)}</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:700;color:${C.text};text-align:right;border-bottom:1px solid ${C.border}">${fc(item.price * item.qty)}</td>
      </tr>`).join('');
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:${C.surface}">
            <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.muted};border-bottom:1px solid ${C.border}">#</th>
            <th style="padding:9px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.muted};border-bottom:1px solid ${C.border}">Product</th>
            <th style="padding:9px 14px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.muted};border-bottom:1px solid ${C.border}">Qty</th>
            <th style="padding:9px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.muted};border-bottom:1px solid ${C.border}">Price</th>
            <th style="padding:9px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.muted};border-bottom:1px solid ${C.border}">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }
  function totalsBlock(o, C) {
    const subtotal = o.total + (o.discount || 0);
    const discountRow = o.discount ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:${C.muted}">Discount${o.coupon ? ` (${o.coupon})` : ''}</td>
        <td style="padding:4px 0;font-size:13px;color:#EF4444;text-align:right;font-weight:600">−${fc(o.discount)}</td>
      </tr>` : '';
    return `
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td width="55%"></td><td width="45%">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:${C.muted}">Subtotal</td>
              <td style="padding:4px 0;font-size:13px;color:${C.muted};text-align:right">${fc(subtotal)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td style="padding:4px 0;font-size:13px;color:${C.muted}">Shipping</td>
              <td style="padding:4px 0;font-size:13px;color:#10B981;text-align:right;font-weight:600">Free</td>
            </tr>
            <tr><td colspan="2" style="padding:0"><hr style="border:none;border-top:2px solid ${C.border};margin:7px 0"></td></tr>
            <tr>
              <td style="padding:8px 0;font-size:16px;font-weight:800;color:${C.text}">Total Due</td>
              <td style="padding:8px 0;font-size:17px;font-weight:800;color:${C.accent};text-align:right">${fc(o.total)}</td>
            </tr>
          </table>
        </td></tr>
      </table>`;
  }
  function showBrandingFooter() {
    return typeof Billing === 'undefined' || !Billing.hasNoBranding();
  }
  function canShowLogo() {
    return typeof Billing !== 'undefined' && Billing.canUploadLogo();
  }

  // ── 1. Classic Professional ───────────────────────────────────
  function classic_pro(o, user, tpl) {
    const C = { accent: '#6366F1', text: '#1a1a1a', muted: '#888', surface: '#f8f8f8', border: '#eeeeee', white: '#ffffff' };
    const isPaid   = o.payment === 'paid';
    const subtotal = o.total + (o.discount || 0);
    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:#fff;color:${C.text};padding:40px;font-family:DM Sans,Arial,sans-serif;border-radius:12px">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;padding-bottom:22px;border-bottom:2px solid ${C.border}">
          <tr>
            <td style="vertical-align:top;width:55%">
              ${brandBlock(user, C.accent, canShowLogo())}
              ${storeDetails(user, C.muted)}
            </td>
            <td style="vertical-align:top;text-align:right;width:45%">
              <div style="font-size:22px;font-weight:800;color:${C.text};letter-spacing:-0.5px">INVOICE</div>
              <p style="font-size:12px;color:${C.muted};margin:4px 0">#${o.id}</p>
              <p style="font-size:12px;color:${C.muted};margin:4px 0">${fd(o.date)}</p>
              <div style="margin-top:10px">${statusBadge(isPaid)}</div>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td style="vertical-align:top;width:48%;padding-right:16px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:8px">From</div>
              <div style="font-size:15px;font-weight:700;color:${C.text};margin-bottom:4px">${user.store || 'Your Store'}</div>
              ${user.email ? `<p style="font-size:12px;color:#555;margin:2px 0">${user.email}</p>` : ''}
              ${user.gstNumber ? `<p style="font-size:11px;color:#777;margin:3px 0"><b>GSTIN:</b> ${user.gstNumber}</p>` : ''}
            </td>
            <td width="4%"></td>
            <td style="vertical-align:top;width:48%">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:8px">Bill To</div>
              <div style="font-size:15px;font-weight:700;color:${C.text};margin-bottom:4px">${o.customerName}</div>
              <p style="font-size:12px;color:#555;margin:2px 0">${o.source || 'Order'}</p>
              ${o.shippingAddress ? `<p style="font-size:12px;color:#777;margin:2px 0;line-height:1.5">${o.shippingAddress}</p>` : ''}
            </td>
          </tr>
        </table>
        ${itemsTable(o, C, C.white, C.surface)}
        ${totalsBlock(o, C)}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid ${C.border};text-align:center;font-size:11px;color:#bbb">
          <p style="margin:0 0 4px">Thank you for your order!</p>
          ${user.upiId ? `<p style="margin:0 0 4px">Pay via UPI: <strong style="color:#555">${user.upiId}</strong></p>` : ''}
          ${showBrandingFooter() ? `<p style="margin:6px 0 0;font-size:10px">Generated by <a href="https://hisaabmitra.com" style="color:${C.accent};text-decoration:none">Hisaab Mitra</a></p>` : ''}
        </div>
      </div>`;
  }

  // ── 2. Modern Minimal ─────────────────────────────────────────
  function modern_minimal(o, user, tpl) {
    const C = { accent: '#111111', text: '#111111', muted: '#999', surface: '#f5f5f5', border: '#eeeeee', white: '#ffffff' };
    const isPaid = o.payment === 'paid';
    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:#fff;color:${C.text};padding:48px;font-family:DM Sans,Arial,sans-serif;border-radius:12px">
        <div style="text-align:center;margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid ${C.border}">
          ${brandBlock(user, C.accent, canShowLogo())}
          <div style="font-size:11px;color:${C.muted};letter-spacing:3px;text-transform:uppercase;margin-top:10px">Invoice · #${o.id} · ${fd(o.date)}</div>
          <div style="margin-top:12px">${statusBadge(isPaid)}</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr>
            <td style="vertical-align:top;width:48%;padding-right:16px">
              <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-bottom:10px">From</div>
              <div style="font-size:14px;font-weight:700;color:${C.text}">${user.store || 'Your Store'}</div>
              ${user.email ? `<p style="font-size:12px;color:${C.muted};margin:4px 0">${user.email}</p>` : ''}
            </td>
            <td width="4%"></td>
            <td style="vertical-align:top;width:48%">
              <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-bottom:10px">Bill To</div>
              <div style="font-size:14px;font-weight:700;color:${C.text}">${o.customerName}</div>
              ${o.shippingAddress ? `<p style="font-size:12px;color:${C.muted};margin:4px 0;line-height:1.6">${o.shippingAddress}</p>` : ''}
            </td>
          </tr>
        </table>
        ${itemsTable(o, C, C.white, '#fafafa')}
        ${totalsBlock(o, C)}
        <div style="margin-top:36px;text-align:right;font-size:11px;color:${C.muted}">
          ${user.upiId ? `UPI: ${user.upiId}` : ''}
          ${showBrandingFooter() ? `<span style="margin-left:12px">· Hisaab Mitra</span>` : ''}
        </div>
      </div>`;
  }

  // ── 3. GST Business ───────────────────────────────────────────
  function gst_business(o, user, tpl) {
    const C = { accent: '#1d4ed8', text: '#1e3a5f', muted: '#6b7eb8', surface: '#eff6ff', border: '#dbeafe', white: '#ffffff' };
    const isPaid = o.payment === 'paid';
    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:#fff;color:${C.text};padding:40px;font-family:DM Sans,Arial,sans-serif;border-radius:12px">
        <div style="background:${C.surface};border-radius:8px;padding:18px 22px;margin-bottom:24px;border-left:4px solid ${C.accent}">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;width:60%">
                ${brandBlock(user, C.accent, canShowLogo())}
                ${storeDetails(user, C.muted)}
              </td>
              <td style="vertical-align:top;text-align:right;width:40%">
                <div style="font-size:20px;font-weight:900;color:${C.accent};letter-spacing:-0.5px">TAX INVOICE</div>
                <p style="font-size:11px;color:${C.muted};margin:4px 0">Invoice No: <b>#${o.id}</b></p>
                <p style="font-size:11px;color:${C.muted};margin:4px 0">Date: <b>${fd(o.date)}</b></p>
                <div style="margin-top:8px">${statusBadge(isPaid)}</div>
              </td>
            </tr>
          </table>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td style="vertical-align:top;width:48%;padding:14px 16px 14px 0">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.accent};margin-bottom:8px">Seller</div>
              <div style="font-size:14px;font-weight:700;color:${C.text}">${user.store || 'Your Store'}</div>
              ${user.email ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">${user.email}</p>` : ''}
              ${user.phone ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">${user.phone}</p>` : ''}
              ${user.gstNumber ? `<p style="font-size:12px;color:${C.accent};margin:6px 0;font-weight:700;letter-spacing:0.5px">GSTIN: ${user.gstNumber}</p>` : '<p style="font-size:11px;color:#999;margin:6px 0;font-style:italic">GSTIN not provided</p>'}
            </td>
            <td style="width:4%"></td>
            <td style="vertical-align:top;width:48%;padding:14px 0 14px 16px;border-left:1px solid ${C.border}">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.accent};margin-bottom:8px">Buyer</div>
              <div style="font-size:14px;font-weight:700;color:${C.text}">${o.customerName}</div>
              ${o.shippingAddress ? `<p style="font-size:12px;color:${C.muted};margin:2px 0;line-height:1.5">${o.shippingAddress}</p>` : ''}
            </td>
          </tr>
        </table>
        ${itemsTable(o, C, C.white, C.surface)}
        ${totalsBlock(o, C)}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${C.border};font-size:11px;color:${C.muted}">
          <p style="margin:0 0 3px"><b>Declaration:</b> We declare that this invoice shows the actual price of the goods described.</p>
          ${user.upiId ? `<p style="margin:4px 0">UPI: <b>${user.upiId}</b></p>` : ''}
          ${showBrandingFooter() ? `<p style="margin:6px 0 0;font-size:10px;opacity:0.6">Generated by Hisaab Mitra</p>` : ''}
        </div>
      </div>`;
  }

  // ── 4. Boutique Premium ───────────────────────────────────────
  function boutique_premium(o, user, tpl) {
    const C = { accent: '#92400e', gold: '#d97706', text: '#1c1917', muted: '#a8937e', surface: '#fdf8f0', border: '#e7d5b8', white: '#fffdf9' };
    const isPaid = o.payment === 'paid';
    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:${C.white};color:${C.text};padding:48px;font-family:Georgia,'Times New Roman',serif;border-radius:12px">
        <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid ${C.border}">
          <div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:${C.muted};margin-bottom:12px">Premium Invoice</div>
          ${brandBlock(user, C.accent, canShowLogo())}
          ${user.instagram ? `<div style="font-size:12px;color:${C.muted};margin-top:6px;letter-spacing:1px">${user.instagram}</div>` : ''}
          <div style="margin-top:14px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${C.muted}">
            #${o.id} &nbsp;·&nbsp; ${fd(o.date)}
          </div>
          <div style="margin-top:12px">${statusBadge(isPaid)}</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr>
            <td style="vertical-align:top;width:48%;padding-right:20px">
              <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-bottom:10px">From</div>
              <div style="font-size:15px;font-weight:700;color:${C.text}">${user.store || 'Your Boutique'}</div>
              ${user.phone ? `<p style="font-size:12px;color:${C.muted};margin:4px 0">${user.phone}</p>` : ''}
              ${user.email ? `<p style="font-size:12px;color:${C.muted};margin:4px 0">${user.email}</p>` : ''}
            </td>
            <td style="width:4%"></td>
            <td style="vertical-align:top;width:48%">
              <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-bottom:10px">For</div>
              <div style="font-size:15px;font-weight:700;color:${C.text}">${o.customerName}</div>
              ${o.shippingAddress ? `<p style="font-size:12px;color:${C.muted};margin:4px 0;line-height:1.6">${o.shippingAddress}</p>` : ''}
            </td>
          </tr>
        </table>
        ${itemsTable(o, C, C.white, C.surface)}
        ${totalsBlock(o, C)}
        <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${C.border};text-align:center;font-size:11px;color:${C.muted};font-style:italic;letter-spacing:0.5px">
          <p style="margin:0 0 5px">Thank you for choosing us. Every piece is crafted with love. ✦</p>
          ${user.upiId ? `<p style="margin:3px 0">Pay via UPI: <span style="font-style:normal;font-weight:700;color:${C.accent}">${user.upiId}</span></p>` : ''}
          ${showBrandingFooter() ? `<p style="margin:8px 0 0;font-size:10px;opacity:0.5;font-style:normal">Powered by Hisaab Mitra</p>` : ''}
        </div>
      </div>`;
  }

  // ── 5. Bold Startup ───────────────────────────────────────────
  function bold_startup(o, user, tpl) {
    const C = { accent: '#d02752', text: '#111827', muted: '#6b7280', surface: '#fff5f7', border: '#fce7eb', white: '#ffffff' };
    const isPaid = o.payment === 'paid';
    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:${C.white};color:${C.text};font-family:DM Sans,Arial,sans-serif;border-radius:12px;overflow:hidden">
        <div style="background:${C.accent};padding:28px 40px 24px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle">
                <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1">${user.store || 'Your Brand'}</div>
                ${user.instagram ? `<div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px">${user.instagram}</div>` : ''}
              </td>
              <td style="vertical-align:middle;text-align:right">
                <div style="font-size:14px;font-weight:900;color:rgba(255,255,255,0.5);letter-spacing:3px;text-transform:uppercase">Invoice</div>
                <div style="font-size:22px;font-weight:900;color:#fff;margin-top:2px">#${o.id}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px">${fd(o.date)}</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:28px 40px">
          <div style="margin-bottom:24px">${statusBadge(isPaid)}</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="vertical-align:top;width:48%;padding-right:16px">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.accent};margin-bottom:8px">From</div>
                <div style="font-size:15px;font-weight:800;color:${C.text}">${user.store || 'Your Store'}</div>
                ${user.phone ? `<p style="font-size:12px;color:${C.muted};margin:3px 0">${user.phone}</p>` : ''}
                ${user.email ? `<p style="font-size:12px;color:${C.muted};margin:3px 0">${user.email}</p>` : ''}
              </td>
              <td width="4%"></td>
              <td style="vertical-align:top;width:48%">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.accent};margin-bottom:8px">To</div>
                <div style="font-size:15px;font-weight:800;color:${C.text}">${o.customerName}</div>
                ${o.shippingAddress ? `<p style="font-size:12px;color:${C.muted};margin:3px 0;line-height:1.5">${o.shippingAddress}</p>` : ''}
              </td>
            </tr>
          </table>
          ${itemsTable(o, C, C.white, C.surface)}
          ${totalsBlock(o, C)}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid ${C.border};font-size:12px;color:${C.muted};text-align:center">
            ${user.upiId ? `<p style="margin:0 0 4px">UPI: <b style="color:${C.text}">${user.upiId}</b></p>` : ''}
            ${showBrandingFooter() ? `<p style="margin:4px 0;font-size:10px;opacity:0.5">Powered by Hisaab Mitra</p>` : ''}
          </div>
        </div>
      </div>`;
  }

  // ── 6. Festive Diwali ─────────────────────────────────────────
  function festive_diwali(o, user, tpl) {
    const C = { accent: '#b45309', amber: '#d97706', text: '#292524', muted: '#a16207', surface: '#fffbeb', border: '#fde68a', white: '#fffdf4' };
    const isPaid = o.payment === 'paid';
    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:${C.white};color:${C.text};font-family:DM Sans,Arial,sans-serif;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#b45309 0%,#d97706 60%,#f59e0b 100%);padding:26px 40px 22px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle">
                <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:6px">✦ Festival Special ✦</div>
                <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px">${user.store || 'Your Store'}</div>
              </td>
              <td style="vertical-align:middle;text-align:right">
                <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase">Invoice</div>
                <div style="font-size:20px;font-weight:900;color:#fff">#${o.id}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px">${fd(o.date)}</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:28px 40px">
          <div style="margin-bottom:22px">${statusBadge(isPaid)}</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="vertical-align:top;width:48%;padding-right:16px">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.amber};margin-bottom:8px">From</div>
                <div style="font-size:14px;font-weight:700;color:${C.text}">${user.store || 'Your Store'}</div>
                ${storeDetails(user, C.muted)}
              </td>
              <td width="4%"></td>
              <td style="vertical-align:top;width:48%">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.amber};margin-bottom:8px">Bill To</div>
                <div style="font-size:14px;font-weight:700;color:${C.text}">${o.customerName}</div>
                ${o.shippingAddress ? `<p style="font-size:12px;color:${C.muted};margin:3px 0;line-height:1.5">${o.shippingAddress}</p>` : ''}
              </td>
            </tr>
          </table>
          ${itemsTable(o, C, C.white, C.surface)}
          ${totalsBlock(o, C)}
          <div style="margin-top:28px;padding-top:18px;border-top:2px solid ${C.border};text-align:center;font-size:12px;color:${C.muted}">
            <p style="margin:0 0 4px;font-size:13px">✦ शुभकामनाएं! Thank you for your order ✦</p>
            ${user.upiId ? `<p style="margin:4px 0">UPI: <b style="color:${C.accent}">${user.upiId}</b></p>` : ''}
            ${showBrandingFooter() ? `<p style="margin:8px 0 0;font-size:10px;opacity:0.5">Powered by Hisaab Mitra</p>` : ''}
          </div>
        </div>
      </div>`;
  }

  return {
    classic_pro,
    modern_minimal,
    gst_business,
    boutique_premium,
    bold_startup,
    festive_diwali,
  };
})();
