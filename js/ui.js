// SellerFlow — UI Utilities Module
// Handles: toasts, modals, sidebar, navigation, loading states, auth errors
// ================================================================

const UI = (() => {
  // ─── Toast Notifications ─────────────────────────────────────
  function toast(msg, type = "info") {
    const icons = { success: "✅", error: "❌", warn: "⚠️", info: "ℹ️" };
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || "ℹ️"}</span>
      <span class="toast-msg">${msg}</span>
      <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add("removing");
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  // ─── Loading Overlay ─────────────────────────────────────────
  function showLoading(msg = "Loading…") {
    let overlay = document.getElementById("sf-loading-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sf-loading-overlay";
      overlay.innerHTML = `
        <div class="sf-loading-inner">
          <div class="sf-spinner"></div>
          <div class="sf-loading-msg" id="sf-loading-msg">${msg}</div>
        </div>`;
      document.body.appendChild(overlay);
    } else {
      const msgEl = document.getElementById("sf-loading-msg");
      if (msgEl) msgEl.textContent = msg;
    }
    overlay.classList.add("active");
  }

  function hideLoading() {
    const overlay = document.getElementById("sf-loading-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  // ─── Skeleton loaders ────────────────────────────────────────
  function showSkeleton(tbodyId, cols = 5, rows = 4) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const cells = Array(cols)
      .fill('<td><div class="skeleton-line"></div></td>')
      .join("");
    tbody.innerHTML = Array(rows).fill(`<tr>${cells}</tr>`).join("");
  }

  function showCardSkeleton(containerId, count = 6) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array(count).fill(`
      <div class="billing-card skeleton-card">
        <div class="skeleton-line" style="width:60%;height:14px;margin-bottom:10px"></div>
        <div class="skeleton-line" style="width:40%;height:11px;margin-bottom:16px"></div>
        <div class="skeleton-line" style="width:50%;height:24px;margin-bottom:12px"></div>
        <div class="skeleton-line" style="width:70%;height:11px"></div>
      </div>`).join("");
  }

  // ─── Async error boundary ─────────────────────────────────────
  async function safeRender(fn, label = "page") {
    try {
      await fn();
    } catch (err) {
      console.error(`[UI:safeRender:${label}]`, err);
      const msg = err?.message || "";
      if (
        msg.includes("JWT") ||
        msg.includes("not authenticated") ||
        msg.includes("invalid claim")
      ) {
        toast("Session expired. Please log in again.", "error");
        setTimeout(() => window.dispatchEvent(new Event("sf:signed-out")), 1200);
      } else {
        toast(`Failed to load ${label}. Please try again.`, "error");
      }
    }
  }

  // ─── Modals ──────────────────────────────────────────────────
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add("open");
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(id);
    }, { once: true });
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove("open");
  }

  function closeAllModals() {
    document.querySelectorAll(".modal-overlay.open")
      .forEach((m) => m.classList.remove("open"));
  }

  // ─── Navigation (async-aware) ─────────────────────────────────
  async function navigate(page) {
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add("active");

    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add("active");

    const titles = {
      dashboard: "Dashboard",
      products:  "Products",
      orders:    "Orders",
      customers: "Customers",
      billing:   "Billing & Invoices",
      settings:  "Settings",
      analytics: "Analytics",
    };
    const titleEl = document.getElementById("topbar-title");
    if (titleEl) titleEl.textContent = titles[page] || "SellerFlow";

    closeMobileSidebar();

    if (typeof Pages !== "undefined" && Pages[page]) {
      await safeRender(() => Pages[page](), page);
    }
  }

  // ─── Mobile Sidebar ──────────────────────────────────────────
  function openMobileSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    if (!sidebar || !overlay) return;
    sidebar.classList.add("open");
    overlay.classList.add("open");
    if (!document.getElementById("sidebar-close-btn")) {
      const header = sidebar.querySelector(".sidebar-header");
      if (header) {
        const btn = document.createElement("button");
        btn.id = "sidebar-close-btn";
        btn.className = "sidebar-close-btn";
        btn.setAttribute("aria-label", "Close navigation");
        btn.textContent = "✕";
        btn.addEventListener("click", closeMobileSidebar);
        header.appendChild(btn);
      }
    }
    document.body.style.overflow = "hidden";
  }

  function closeMobileSidebar() {
    document.querySelector(".sidebar")?.classList.remove("open");
    document.querySelector(".sidebar-overlay")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  // ─── Confirm Dialog ──────────────────────────────────────────
  function confirm(msg) { return window.confirm(msg); }

  // ─── Badges ──────────────────────────────────────────────────
  async function updateBadges() {
    try {
      const stats = await SF.getDashStats();
      const pendingBadge = document.getElementById("badge-pending");
      if (pendingBadge) {
        pendingBadge.textContent  = stats.pendingPayments;
        pendingBadge.style.display = stats.pendingPayments > 0 ? "" : "none";
      }
      const stockBadge = document.getElementById("badge-lowstock");
      if (stockBadge) {
        stockBadge.textContent  = stats.lowStockCount;
        stockBadge.style.display = stats.lowStockCount > 0 ? "" : "none";
      }
      const notifDot = document.querySelector(".notif-dot");
      if (notifDot) {
        notifDot.style.display =
          stats.pendingPayments > 0 || stats.lowStockCount > 0 ? "" : "none";
      }
    } catch (_) { /* badges are non-critical */ }
  }

  // ─── Empty State ─────────────────────────────────────────────
  function emptyState(icon, title, desc) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-desc">${desc}</div>
      </div>`;
  }

  // ─── Status Badges ────────────────────────────────────────────
  function orderStatusBadge(status) {
    const map = {
      processing: ["badge-info",    "🔄 Processing"],
      shipped:    ["badge-cyan",    "🚚 Shipped"],
      delivered:  ["badge-success", "✅ Delivered"],
      cancelled:  ["badge-danger",  "❌ Cancelled"],
    };
    const [cls, label] = map[status] || ["badge-muted", status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function paymentBadge(status) {
    const map = {
      paid:     ["badge-success", "✅ Paid"],
      pending:  ["badge-warn",    "⏳ Pending"],
      refunded: ["badge-muted",   "↩️ Refunded"],
    };
    const [cls, label] = map[status] || ["badge-muted", status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // ─── Invoice WhatsApp Message ────────────────────────────────
  function generateInvoiceMessage(order, user) {
    const firstName = (order.customerName || "Customer").split(" ")[0];
    const storeName = user.store || "Our Store";
    const amount    = SF.formatCurrency(order.total);
    const status    = order.payment === "paid" ? "PAID" : "PENDING";
    const upiLine   = user.upiId ? `\nUPI: ${user.upiId}\n` : "";
    return `Hi ${firstName} 👋\nThank you for shopping with ${storeName} 💜\n\nYour order invoice #${order.id} is ready.\nTotal amount: ${amount}\nPayment status: ${status}\n${upiLine}\nThank you for your order ✨`;
  }

  // ─── Debounce ─────────────────────────────────────────────────
  function debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Public API
  return {
    toast,
    showLoading, hideLoading,
    showSkeleton, showCardSkeleton,
    safeRender,
    openModal, closeModal, closeAllModals,
    navigate,
    openMobileSidebar, closeMobileSidebar,
    confirm,
    updateBadges,
    emptyState,
    orderStatusBadge, paymentBadge,
    generateInvoiceMessage,
    debounce,
  };
})();
