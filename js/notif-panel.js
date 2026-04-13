// Hisaab Mitra — Notification Panel Module
// ════════════════════════════════════════════════════════════════
// FEATURES
//   • Bell icon opens a floating panel below it (dropdown style)
//   • Automatic stock alerts (empty / low stock) from products table
//   • Admin-to-seller broadcast notifications (stored in Supabase)
//   • Broadcasts appear as a pop-up toast AND in the panel
//   • Red dot on bell when unread notifications exist
//   • Mark all as read on panel open
//   • Admin broadcast composer (only visible to admin UID)
//
// SUPABASE SETUP — run once in SQL Editor:
//
//   CREATE TABLE IF NOT EXISTS seller_notifications (
//     id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
//     target_user   TEXT        NOT NULL DEFAULT 'all',  -- 'all' OR specific user_id
//     title         TEXT        NOT NULL,
//     body          TEXT        NOT NULL,
//     type          TEXT        NOT NULL DEFAULT 'info', -- info | warn | success | danger
//     icon          TEXT,
//     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
//     expires_at    TIMESTAMPTZ
//   );
//
//   -- Anyone authenticated can read (needed for all sellers)
//   ALTER TABLE seller_notifications ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Sellers can read their notifications"
//     ON seller_notifications FOR SELECT TO authenticated
//     USING (target_user = 'all' OR target_user = auth.uid()::text);
//
//   -- Only service role / admin can insert (Phase 1: use Supabase Dashboard)
//   -- Phase 2: Add a server-side admin API route that checks uid before inserting
//
// ════════════════════════════════════════════════════════════════

const NotifPanel = (() => {

  // ── Config ────────────────────────────────────────────────────
  // Replace with your actual admin Supabase user ID
  const ADMIN_UID = '3def6a27-3f35-4949-872b-6a70b735e92e';

  // Low stock threshold override — products with stock <= this show a warning
  const LOW_STOCK_WARN  = 5;
  const ZERO_STOCK_CRIT = 0;

  // Realtime polling interval for broadcast notifications (ms)
  const POLL_INTERVAL_MS = 60_000; // 1 minute

  // LocalStorage key for tracking read notifications
  const READ_KEY = 'hm_notif_read';

  // ── State ─────────────────────────────────────────────────────
  let _isOpen         = false;
  let _notifications  = [];   // merged stock + broadcast notifications
  let _broadcastNotifs = [];  // from Supabase
  let _pollTimer      = null;
  let _lastBroadcastId = null; // for pop-up dedup

  // ── Read tracking (localStorage) ──────────────────────────────
  function _getReadIds() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
  }
  function _markAllRead(ids) {
    try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])); } catch {}
  }
  function _clearOldReadIds(validIds) {
    // Prune localStorage so it doesn't grow forever
    const current = _getReadIds();
    const pruned  = [...current].filter(id => validIds.has(id));
    try { localStorage.setItem(READ_KEY, JSON.stringify(pruned)); } catch {}
  }

  // ── Initialization ────────────────────────────────────────────
  async function init() {
    _attachBellListener();
    _attachOutsideClickListener();
    await refresh();
    _startPolling();
  }

  function _attachBellListener() {
    const btn = document.getElementById('notif-bell-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
  }

  function _attachOutsideClickListener() {
    document.addEventListener('click', (e) => {
      if (!_isOpen) return;
      const panel = document.getElementById('notif-panel');
      const btn   = document.getElementById('notif-bell-btn');
      if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
        close();
      }
    });
  }

  // ── Panel toggle ──────────────────────────────────────────────
  function toggle() {
    _isOpen ? close() : open();
  }

  function open() {
    _isOpen = true;
    _ensurePanel();
    _renderPanel();
    const panel = document.getElementById('notif-panel');
    if (panel) {
      panel.classList.add('np-open');
      // Mark all as read
      const allIds = new Set(_notifications.map(n => n.id));
      _markAllRead(allIds);
      _clearOldReadIds(allIds);
      _updateDot();
    }
  }

  function close() {
    _isOpen = false;
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.remove('np-open');
  }

  // ── Ensure panel DOM exists ───────────────────────────────────
  function _ensurePanel() {
    if (document.getElementById('notif-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.className = 'np-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notifications');
    // Anchor to the bell button's parent
    const bell = document.getElementById('notif-bell-btn');
    if (bell?.parentElement) {
      bell.parentElement.style.position = 'relative';
      bell.parentElement.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  // ── Render panel content ──────────────────────────────────────
  function _renderPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;

    const isAdmin  = Auth.getUserId() === ADMIN_UID;
    const unread   = _unreadCount();
    const isEmpty  = _notifications.length === 0;

    panel.innerHTML = `
      <div class="np-header">
        <div class="np-header-left">
          <span class="np-header-title">Notifications</span>
          ${unread > 0 ? `<span class="np-unread-badge">${unread}</span>` : ''}
        </div>
        <div class="np-header-right">
          ${isAdmin ? `<button class="np-admin-btn" onclick="NotifPanel.openBroadcastComposer()" title="Send broadcast">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Broadcast
          </button>` : ''}
          <button class="np-close-btn" onclick="NotifPanel.close()" aria-label="Close notifications">✕</button>
        </div>
      </div>

      <div class="np-body">
        ${isEmpty
          ? `<div class="np-empty">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;opacity:0.3;margin-bottom:10px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <div class="np-empty-title">All caught up!</div>
              <div class="np-empty-sub">No notifications right now.</div>
            </div>`
          : _notifications.map(n => _notifItemHTML(n)).join('')
        }
      </div>

      ${!isEmpty ? `<div class="np-footer">
        <button class="np-mark-read-btn" onclick="NotifPanel._markAllReadAndRefresh()">Mark all as read</button>
      </div>` : ''}
    `;
  }

  function _notifItemHTML(n) {
    const readIds  = _getReadIds();
    const isUnread = !readIds.has(n.id);
    const typeIcons = {
      danger:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      warn:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      info:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };
    const icon = typeIcons[n.type] || typeIcons.info;
    const timeAgo = _timeAgo(n.createdAt);

    return `
      <div class="np-item np-item--${n.type}${isUnread ? ' np-item--unread' : ''}">
        <div class="np-item-icon np-icon--${n.type}">${icon}</div>
        <div class="np-item-content">
          <div class="np-item-title">${n.title}</div>
          <div class="np-item-body">${n.body}</div>
          <div class="np-item-time">${timeAgo}</div>
        </div>
        ${isUnread ? '<div class="np-item-dot"></div>' : ''}
      </div>`;
  }

  // ── Data: fetch & merge ───────────────────────────────────────
  async function refresh() {
    const [stockNotifs, broadcasts] = await Promise.all([
      _fetchStockAlerts(),
      _fetchBroadcasts(),
    ]);

    _broadcastNotifs = broadcasts;
    _notifications   = [...broadcasts, ...stockNotifs].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    _updateDot();

    // Re-render panel if open
    if (_isOpen) _renderPanel();

    // Show pop-up for new broadcasts not yet popped
    _showNewBroadcastPopups(broadcasts);
  }

  // ── Stock alerts ──────────────────────────────────────────────
  async function _fetchStockAlerts() {
    try {
      const products = await SF.getProducts();
      const alerts   = [];
      const now      = new Date().toISOString();

      products.forEach(p => {
        if (p.stock === ZERO_STOCK_CRIT) {
          alerts.push({
            id:        `stock-out-${p.id}`,
            type:      'danger',
            title:     `${p.emoji || '📦'} Out of stock: ${p.name}`,
            body:      'This product has 0 units left. Restock to continue selling.',
            createdAt: now,
            source:    'stock',
          });
        } else if (p.stock <= (p.lowStockThreshold || LOW_STOCK_WARN)) {
          alerts.push({
            id:        `stock-low-${p.id}`,
            type:      'warn',
            title:     `${p.emoji || '📦'} Low stock: ${p.name}`,
            body:      `Only ${p.stock} unit${p.stock === 1 ? '' : 's'} remaining. Consider restocking soon.`,
            createdAt: now,
            source:    'stock',
          });
        }
      });

      return alerts;
    } catch (e) {
      console.warn('[NotifPanel] Stock fetch failed:', e.message);
      return [];
    }
  }

  // ── Broadcast notifications from Supabase ─────────────────────
  async function _fetchBroadcasts() {
    try {
      const { data, error } = await _supabase
        .from('seller_notifications')
        .select('*')
        .or(`target_user.eq.all,target_user.eq.${Auth.getUserId()}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || [])
        .filter(row => !row.expires_at || new Date(row.expires_at) > new Date())
        .map(row => ({
          id:        row.id,
          type:      row.type || 'info',
          title:     row.title,
          body:      row.body,
          createdAt: row.created_at,
          source:    'broadcast',
        }));
    } catch (e) {
      console.warn('[NotifPanel] Broadcast fetch failed:', e.message);
      return [];
    }
  }

  // ── Pop-up for new broadcasts ─────────────────────────────────
  function _showNewBroadcastPopups(broadcasts) {
    const readIds = _getReadIds();
    broadcasts.forEach(n => {
      if (!readIds.has(n.id) && n.id !== _lastBroadcastId) {
        _lastBroadcastId = n.id;
        _showBroadcastPopup(n);
      }
    });
  }

  function _showBroadcastPopup(n) {
    // Remove existing popup if any
    document.getElementById('np-popup')?.remove();

    const typeConfig = {
      danger:  { bar: '#ef4444', icon: '🚨' },
      warn:    { bar: '#f59e0b', icon: '⚠️' },
      success: { bar: '#10b981', icon: '✅' },
      info:    { bar: 'var(--accent)', icon: '📢' },
    };
    const cfg = typeConfig[n.type] || typeConfig.info;

    const popup = document.createElement('div');
    popup.id = 'np-popup';
    popup.className = 'np-popup np-popup--hidden';
    popup.innerHTML = `
      <div class="np-popup-bar" style="background:${cfg.bar}"></div>
      <div class="np-popup-content">
        <div class="np-popup-icon">${cfg.icon}</div>
        <div class="np-popup-text">
          <div class="np-popup-title">${n.title}</div>
          <div class="np-popup-body">${n.body}</div>
        </div>
        <button class="np-popup-close" onclick="document.getElementById('np-popup')?.remove()" aria-label="Dismiss">✕</button>
      </div>
    `;
    document.body.appendChild(popup);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popup.classList.remove('np-popup--hidden');
        popup.classList.add('np-popup--visible');
      });
    });

    // Auto-dismiss after 8s
    setTimeout(() => {
      popup.classList.remove('np-popup--visible');
      popup.classList.add('np-popup--hiding');
      setTimeout(() => popup.remove(), 400);
    }, 8000);
  }

  // ── Bell dot ──────────────────────────────────────────────────
  function _unreadCount() {
    const readIds = _getReadIds();
    return _notifications.filter(n => !readIds.has(n.id)).length;
  }

  function _updateDot() {
    const dot   = document.querySelector('#notif-bell-btn .notif-dot');
    const count = _unreadCount();
    if (!dot) return;
    dot.style.display = count > 0 ? '' : 'none';
    // Show count badge on bell if > 1
    let badge = document.getElementById('notif-bell-count');
    if (count > 1) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'notif-bell-count';
        badge.className = 'np-bell-count';
        document.getElementById('notif-bell-btn')?.appendChild(badge);
      }
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      badge?.remove();
    }
  }

  function _markAllReadAndRefresh() {
    const allIds = new Set(_notifications.map(n => n.id));
    _markAllRead(allIds);
    _updateDot();
    _renderPanel();
  }

  // ── Polling ───────────────────────────────────────────────────
  function _startPolling() {
    _pollTimer = setInterval(() => { refresh(); }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ── Time ago ──────────────────────────────────────────────────
  function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  // ── Admin Broadcast Composer ──────────────────────────────────
  function openBroadcastComposer() {
    close(); // close the panel first

    // Remove existing composer
    document.getElementById('np-composer-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'np-composer-overlay';
    overlay.className = 'np-composer-overlay';
    overlay.innerHTML = `
      <div class="np-composer" role="dialog" aria-label="Send notification broadcast">
        <div class="np-composer-header">
          <div class="np-composer-title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Notification to Sellers
          </div>
          <button class="np-close-btn" onclick="document.getElementById('np-composer-overlay')?.remove()" aria-label="Close">✕</button>
        </div>

        <div class="np-composer-body">
          <div class="np-field">
            <label class="np-label">Target</label>
            <select class="np-select" id="npc-target">
              <option value="all">All Sellers</option>
              <option value="specific">Specific User ID</option>
            </select>
          </div>

          <div class="np-field" id="npc-uid-field" style="display:none">
            <label class="np-label">User ID</label>
            <input class="np-input" id="npc-uid" placeholder="Supabase user UUID" />
          </div>

          <div class="np-field">
            <label class="np-label">Type</label>
            <div class="np-type-grid">
              <label class="np-type-option np-type-info">
                <input type="radio" name="npc-type" value="info" checked>
                <span>📢 Info</span>
              </label>
              <label class="np-type-option np-type-success">
                <input type="radio" name="npc-type" value="success">
                <span>✅ Success</span>
              </label>
              <label class="np-type-option np-type-warn">
                <input type="radio" name="npc-type" value="warn">
                <span>⚠️ Warning</span>
              </label>
              <label class="np-type-option np-type-danger">
                <input type="radio" name="npc-type" value="danger">
                <span>🚨 Alert</span>
              </label>
            </div>
          </div>

          <div class="np-field">
            <label class="np-label">Title <span style="color:var(--danger)">*</span></label>
            <input class="np-input" id="npc-title" placeholder="e.g. System maintenance tonight" maxlength="80" />
            <div class="np-char-count" id="npc-title-count">0 / 80</div>
          </div>

          <div class="np-field">
            <label class="np-label">Message <span style="color:var(--danger)">*</span></label>
            <textarea class="np-textarea" id="npc-body" placeholder="Enter your message to sellers…" rows="3" maxlength="280"></textarea>
            <div class="np-char-count" id="npc-body-count">0 / 280</div>
          </div>

          <div class="np-field">
            <label class="np-label">Expires after</label>
            <select class="np-select" id="npc-expires">
              <option value="">Never</option>
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </select>
          </div>
        </div>

        <div class="np-composer-footer">
          <button class="np-cancel-btn" onclick="document.getElementById('np-composer-overlay')?.remove()">Cancel</button>
          <button class="np-send-btn" id="npc-send-btn" onclick="NotifPanel._sendBroadcast()">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Notification
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire up target toggle
    document.getElementById('npc-target').addEventListener('change', (e) => {
      document.getElementById('npc-uid-field').style.display =
        e.target.value === 'specific' ? '' : 'none';
    });

    // Char counters
    ['title', 'body'].forEach(field => {
      const el    = document.getElementById(`npc-${field}`);
      const count = document.getElementById(`npc-${field}-count`);
      if (el && count) {
        el.addEventListener('input', () => {
          count.textContent = `${el.value.length} / ${el.maxLength}`;
        });
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('np-composer-overlay--open'));
  }

  async function _sendBroadcast() {
    const titleEl  = document.getElementById('npc-title');
    const bodyEl   = document.getElementById('npc-body');
    const targetEl = document.getElementById('npc-target');
    const uidEl    = document.getElementById('npc-uid');
    const sendBtn  = document.getElementById('npc-send-btn');
    const typeEl   = document.querySelector('input[name="npc-type"]:checked');
    const expiresEl = document.getElementById('npc-expires');

    const title   = titleEl?.value?.trim();
    const body    = bodyEl?.value?.trim();
    const target  = targetEl?.value === 'specific' ? (uidEl?.value?.trim() || 'all') : 'all';
    const type    = typeEl?.value || 'info';
    const hours   = expiresEl?.value ? parseInt(expiresEl.value) : null;

    if (!title) { UI.toast('Title is required', 'warn'); titleEl?.focus(); return; }
    if (!body)  { UI.toast('Message is required', 'warn'); bodyEl?.focus(); return; }

    sendBtn.disabled    = true;
    sendBtn.textContent = 'Sending…';

    try {
      const expires_at = hours
        ? new Date(Date.now() + hours * 3600_000).toISOString()
        : null;

      const { error } = await _supabase
        .from('seller_notifications')
        .insert({ title, body, target_user: target, type, expires_at });

      if (error) throw error;

      UI.toast('Notification sent to sellers ✓', 'success');
      document.getElementById('np-composer-overlay')?.remove();

      // Refresh panel so sender also sees it
      await refresh();

    } catch (e) {
      UI.toast(e.message || 'Failed to send', 'error');
      sendBtn.disabled    = false;
      sendBtn.textContent = 'Send Notification';
    }
  }

  // Public API
  return {
    init,
    refresh,
    toggle,
    open,
    close,
    stopPolling,
    openBroadcastComposer,
    _sendBroadcast,
    _markAllReadAndRefresh,
    _showBroadcastPopup, // exposed for testing
  };
})();


// ── Auto-init after DOM ready ─────────────────────────────────────
// Call this from app.js after login, e.g.: await NotifPanel.init();
// If you prefer manual init, remove this block.
window.addEventListener('sf:app-ready', () => {
  NotifPanel.init().catch(e => console.warn('[NotifPanel] init failed:', e));
});
