// SellerFlow — UI Utilities Module
// Handles: toasts, modals, sidebar, navigation, loading states, auth errors
// ================================================================

const UI = (() => {
  // ─── Toast Notifications ─────────────────────────────────────
  function toast(msg, type = "info") {
    const icons = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      warn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };
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
    el.innerHTML = Array(count)
      .fill(
        `
      <div class="billing-card skeleton-card">
        <div class="skeleton-line" style="width:60%;height:14px;margin-bottom:10px"></div>
        <div class="skeleton-line" style="width:40%;height:11px;margin-bottom:16px"></div>
        <div class="skeleton-line" style="width:50%;height:24px;margin-bottom:12px"></div>
        <div class="skeleton-line" style="width:70%;height:11px"></div>
      </div>`,
      )
      .join("");
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
        setTimeout(
          () => window.dispatchEvent(new Event("sf:signed-out")),
          1200,
        );
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
    overlay.addEventListener(
      "click",
      (e) => {
        if (e.target === overlay) closeModal(id);
      },
      { once: true },
    );
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove("open");
  }

  function closeAllModals() {
    document
      .querySelectorAll(".modal-overlay.open")
      .forEach((m) => m.classList.remove("open"));
  }

  // ─── Navigation (async-aware) ─────────────────────────────────
  async function navigate(page) {
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add("active");

    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.remove("active"));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add("active");

    const titles = {
      dashboard: "Dashboard",
      products: "Products",
      orders: "Orders",
      customers: "Customers",
      billing: "Billing & Invoices",
      settings: "Settings",
      analytics: "Analytics",
      "invoice-templates": "Invoice Templates", // ← ADD THIS LINE
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
  function confirm(msg) {
    return window.confirm(msg);
  }

  // ─── Badges ──────────────────────────────────────────────────
  async function updateBadges() {
    try {
      const stats = await SF.getDashStats();
      const pendingBadge = document.getElementById("badge-pending");
      if (pendingBadge) {
        pendingBadge.textContent = stats.pendingPayments;
        pendingBadge.style.display = stats.pendingPayments > 0 ? "" : "none";
      }
      const stockBadge = document.getElementById("badge-lowstock");
      if (stockBadge) {
        stockBadge.textContent = stats.lowStockCount;
        stockBadge.style.display = stats.lowStockCount > 0 ? "" : "none";
      }
      const notifDot = document.querySelector(".notif-dot");
      if (notifDot) {
        notifDot.style.display =
          stats.pendingPayments > 0 || stats.lowStockCount > 0 ? "" : "none";
      }
    } catch (_) {
      /* badges are non-critical */
    }
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
  // out_for_delivery added to match the new status option in ViewOrderContent
  function orderStatusBadge(status) {
    const map = {
      processing: [
        "badge-info",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Processing`,
      ],
      shipped: [
        "badge-cyan",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Shipped`,
      ],
      out_for_delivery: [
        "badge-warn",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Out for Delivery`,
      ],
      delivered: [
        "badge-success",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Delivered`,
      ],
      cancelled: [
        "badge-danger",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancelled`,
      ],
    };
    const [cls, label] = map[status] || ["badge-muted", status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function paymentBadge(status) {
    const map = {
      paid: [
        "badge-success",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg> Paid`,
      ],
      pending: [
        "badge-warn",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pending`,
      ],
      refunded: [
        "badge-muted",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Refunded`,
      ],
    };
    const [cls, label] = map[status] || ["badge-muted", status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  // ─── Invoice WhatsApp Message ────────────────────────────────
  function generateInvoiceMessage(order, user) {
    const firstName = (order.customerName || "Customer").split(" ")[0];
    const storeName = user.store || "Our Store";
    const amount = SF.formatCurrency(order.total);
    const status = order.payment === "paid" ? "PAID" : "PENDING";
    const upiLine = user.upiId ? `\nUPI: ${user.upiId}\n` : "";
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
    showLoading,
    hideLoading,
    showSkeleton,
    showCardSkeleton,
    safeRender,
    openModal,
    closeModal,
    closeAllModals,
    navigate,
    openMobileSidebar,
    closeMobileSidebar,
    confirm,
    updateBadges,
    emptyState,
    orderStatusBadge,
    paymentBadge,
    generateInvoiceMessage,
    debounce,
  };
})();
