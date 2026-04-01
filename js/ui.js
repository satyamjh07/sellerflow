// SellerFlow — UI Utilities Module
// Handles: toasts, modals, sidebar, navigation, global interactions
// ================================================================

const UI = (() => {

  // ─── Toast Notifications ─────────────────────────
  function toast(msg, type = 'info') {
    const icons = { success:'✅', error:'❌', warn:'⚠️', info:'ℹ️' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type]||'ℹ️'}</span>
      <span class="toast-msg">${msg}</span>
      <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  // ─── Modals ──────────────────────────────────────
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.add('open');
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(id);
      }, { once: true });
    }
  }
  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('open');
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }

  // ─── Navigation ──────────────────────────────────
  function navigate(page) {
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Activate matching
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show target page
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Update topbar title
    const titles = {
      dashboard: 'Dashboard',
      products:  'Products',
      orders:    'Orders',
      customers: 'Customers',
      billing:   'Billing & Invoices',
      settings:  'Settings',
    };
    document.getElementById('topbar-title').textContent = titles[page] || 'SellerFlow';

    // Close mobile sidebar
    closeMobileSidebar();

    // Trigger page-specific render
    if (typeof Pages !== 'undefined' && Pages[page]) Pages[page]();
  }

  // ─── Mobile Sidebar ──────────────────────────────
  function openMobileSidebar() {
    document.querySelector('.sidebar').classList.add('open');
    document.querySelector('.sidebar-overlay').classList.add('open');
  }
  function closeMobileSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('open');
  }

  // ─── Confirm Dialog ──────────────────────────────
  function confirm(msg) {
    return window.confirm(msg);
  }

  // ─── Update Badges ───────────────────────────────
  function updateBadges() {
    const stats = SF.getDashStats();
    // Pending orders badge
    const pendingBadge = document.getElementById('badge-pending');
    if (pendingBadge) {
      if (stats.pendingPayments > 0) {
        pendingBadge.textContent = stats.pendingPayments;
        pendingBadge.style.display = '';
      } else {
        pendingBadge.style.display = 'none';
      }
    }
    // Low stock badge
    const stockBadge = document.getElementById('badge-lowstock');
    if (stockBadge) {
      if (stats.lowStockCount > 0) {
        stockBadge.textContent = stats.lowStockCount;
        stockBadge.style.display = '';
      } else {
        stockBadge.style.display = 'none';
      }
    }
    // Notification dot
    const notifDot = document.querySelector('.notif-dot');
    if (notifDot) {
      notifDot.style.display = (stats.pendingPayments > 0 || stats.lowStockCount > 0) ? '' : 'none';
    }
  }

  // ─── Empty State Helper ───────────────────────────
  function emptyState(icon, title, desc) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-desc">${desc}</div>
      </div>
    `;
  }

  // ─── Status Badge HTML ────────────────────────────
  function orderStatusBadge(status) {
    const map = {
      processing: ['badge-info',    '🔄 Processing'],
      shipped:    ['badge-cyan',    '🚚 Shipped'],
      delivered:  ['badge-success', '✅ Delivered'],
      cancelled:  ['badge-danger',  '❌ Cancelled'],
    };
    const [cls, label] = map[status] || ['badge-muted', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function paymentBadge(status) {
    const map = {
      paid:     ['badge-success', '✅ Paid'],
      pending:  ['badge-warn',    '⏳ Pending'],
      refunded: ['badge-muted',   '↩️ Refunded'],
    };
    const [cls, label] = map[status] || ['badge-muted', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // ─── Debounce ─────────────────────────────────────
  function debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Public API
  return {
    toast, openModal, closeModal, closeAllModals,
    navigate, openMobileSidebar, closeMobileSidebar,
    confirm, updateBadges, emptyState,
    orderStatusBadge, paymentBadge, debounce,
  };
})();