// SellerFlow — Pages Module (Async / Supabase Edition)
// All render functions are now async. They fetch data from Supabase
// and render components. Error handling is delegated to UI.safeRender().
// ================================================================

const Pages = (() => {

  // ─── Chart instances (destroy before recreating) ──────────────
  let revenueChart  = null;
  let categoryChart = null;

  // ─── Dashboard ────────────────────────────────────────────────
  async function dashboard() {
    // Show skeletons for stat values immediately
    ['stat-revenue','stat-orders','stat-pending','stat-customers'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="skeleton-line" style="width:60px;height:28px;display:inline-block"></span>';
    });

    const stats    = await SF.getDashStats();
    const orders   = stats._orders;
    const products = stats._products;

    // Stats
    document.getElementById('stat-revenue').textContent   = SF.formatCurrency(stats.totalRevenue);
    document.getElementById('stat-orders').textContent    = stats.totalOrders;
    document.getElementById('stat-pending').textContent   = stats.pendingPayments;
    document.getElementById('stat-customers').textContent = stats.totalCustomers;
    document.getElementById('stat-repeat').textContent    = stats.repeatCustomers;

    // Recent orders
    const recentEl = document.getElementById('recent-orders-list');
    const recent   = orders.slice(0, 6);
    if (recent.length === 0) {
      recentEl.innerHTML = UI.emptyState('📦', 'No orders yet', 'Create your first order to see activity here');
    } else {
      recentEl.innerHTML = recent.map(o => `
        <div class="recent-order-item">
          <div class="order-avatar">${SF.initials(o.customerName)}</div>
          <div class="order-info">
            <div class="order-name">${o.customerName}</div>
            <div class="order-meta">${o.id} · ${SF.formatDate(o.date)}</div>
          </div>
          ${UI.paymentBadge(o.payment)}
          <div class="order-amount">${SF.formatCurrency(o.total)}</div>
        </div>
      `).join('');
    }

    // Low stock alerts
    const lowStockEl = document.getElementById('low-stock-list');
    const low        = products.filter(p => p.stock <= p.lowStockThreshold);
    if (low.length === 0) {
      lowStockEl.innerHTML = `<div class="text-muted" style="font-size:13px;padding:16px;text-align:center">✅ All products are well-stocked!</div>`;
    } else {
      lowStockEl.innerHTML = low.map(p => `
        <div class="low-stock-alert">
          <div class="lsa-icon">${p.emoji || '📦'}</div>
          <div class="lsa-info">
            <div class="lsa-name">${p.name}</div>
            <div class="lsa-stock">⚠️ Only ${p.stock} left in stock</div>
          </div>
          <button class="lsa-btn" onclick="UI.navigate('products')">Restock</button>
        </div>
      `).join('');
    }

    // Charts — fetch analytics in background (non-blocking)
    SF.getAnalytics().then(analytics => {
      _renderRevenueChart(analytics);
      _renderCategoryChart(analytics);
    });
  }

  function _renderRevenueChart(analytics) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: analytics.months,
        datasets: [{
          label: 'Revenue (₹)',
          data: analytics.monthlyRevenue,
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#6366F1',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827', titleColor: '#94A3B8',
            bodyColor: '#F1F5F9', borderColor: 'rgba(99,102,241,0.3)',
            borderWidth: 1, padding: 10,
            callbacks: { label: ctx => '  ₹' + ctx.parsed.y.toLocaleString('en-IN') }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#475569', font: { size: 11 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }
          }
        }
      }
    });
  }

  function _renderCategoryChart(analytics) {
    const ctx2 = document.getElementById('categoryChart');
    if (!ctx2) return;
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx2.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: analytics.topCategories.labels,
        datasets: [{
          data: analytics.topCategories.data,
          backgroundColor: ['#6366F1','#22D3EE','#F59E0B','#10B981','#EF4444','#8B5CF6'],
          borderColor: '#111827', borderWidth: 3, hoverBorderWidth: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94A3B8', padding: 14, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 }
          },
          tooltip: {
            backgroundColor: '#111827', titleColor: '#94A3B8',
            bodyColor: '#F1F5F9', borderColor: 'rgba(99,102,241,0.3)',
            borderWidth: 1, padding: 10,
            callbacks: { label: ctx => `  ${ctx.label}: ${ctx.parsed}%` }
          }
        }
      }
    });
  }

  // ─── Products ─────────────────────────────────────────────────
  let productQuery     = '';
  let productCatFilter = '';

  async function products(query, catFilter) {
    if (query !== undefined)     productQuery = query;
    if (catFilter !== undefined) productCatFilter = catFilter;

    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    // Show skeleton while loading
    UI.showSkeleton('products-tbody', 6, 5);

    let list = await SF.getProducts();

    if (productQuery) {
      const q = productQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    if (productCatFilter) {
      list = list.filter(p => p.category === productCatFilter);
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">${UI.emptyState('📦', 'No products found', 'Add your first product or clear your filters')}</td></tr>`;
    } else {
      tbody.innerHTML = list.map(p => Components.ProductRow(p)).join('');
    }

    // Populate category filter (only first time or after reset)
    const catSel = document.getElementById('product-cat-filter');
    if (catSel && catSel.options.length <= 1) {
      const allProducts = await SF.getProducts();
      const cats = [...new Set(allProducts.map(p => p.category))];
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        catSel.appendChild(opt);
      });
    }
  }

  // ─── Orders ───────────────────────────────────────────────────
  let orderFilter = 'all';

  async function orders(filter) {
    if (filter !== undefined) orderFilter = filter;

    // Update active filter tab
    document.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === orderFilter);
    });

    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    UI.showSkeleton('orders-tbody', 8, 5);

    let list = await SF.getOrders();
    if (orderFilter === 'pending')   list = list.filter(o => o.payment === 'pending');
    if (orderFilter === 'paid')      list = list.filter(o => o.payment === 'paid');
    if (orderFilter === 'shipped')   list = list.filter(o => o.status === 'shipped');
    if (orderFilter === 'delivered') list = list.filter(o => o.status === 'delivered');
    if (orderFilter === 'cancelled') list = list.filter(o => o.status === 'cancelled');

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8">${UI.emptyState('📋', 'No orders found', 'Create a new order or change your filter')}</td></tr>`;
    } else {
      tbody.innerHTML = list.map(o => Components.OrderRow(o)).join('');
    }
  }

  // ─── Customers ────────────────────────────────────────────────
  let customerQuery = '';

  async function customers(query) {
    if (query !== undefined) customerQuery = query;

    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    UI.showSkeleton('customers-tbody', 6, 5);

    let list = await SF.getCustomers();
    if (customerQuery) {
      const q = customerQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.instagram || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q)
      );
    }

    // Update customer count badge
    const badge = document.getElementById('customer-count-badge');
    if (badge) badge.textContent = `${list.length} customer${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">${UI.emptyState('👤', 'No customers found', 'Customers are created automatically when you add orders')}</td></tr>`;
    } else {
      tbody.innerHTML = list.map(c => Components.CustomerRow(c)).join('');
    }
  }

  // ─── Billing ──────────────────────────────────────────────────
  async function billing() {
    const container = document.getElementById('billing-grid');
    if (!container) return;

    UI.showCardSkeleton('billing-grid', 6);

    const orderList = await SF.getOrders();
    const pendingSum = orderList.filter(o => o.payment === 'pending').reduce((s, o) => s + o.total, 0);
    const paidSum    = orderList.filter(o => o.payment === 'paid').reduce((s, o) => s + o.total, 0);

    document.getElementById('billing-pending-total').textContent  = SF.formatCurrency(pendingSum);
    document.getElementById('billing-paid-total').textContent     = SF.formatCurrency(paidSum);
    document.getElementById('billing-total-invoices').textContent = orderList.length;

    if (orderList.length === 0) {
      container.innerHTML = UI.emptyState('🧾', 'No invoices yet', 'Orders will appear here automatically');
    } else {
      container.innerHTML = orderList.map(o => `
        <div class="billing-card" onclick="Modals.showInvoice('${o.id}')">
          <div class="billing-order-num">${o.id}</div>
          <div class="billing-customer">👤 ${o.customerName}</div>
          <div class="billing-amount">${SF.formatCurrency(o.total)}</div>
          <div class="billing-footer">
            <span class="billing-date">📅 ${SF.formatDate(o.date)}</span>
            ${UI.paymentBadge(o.payment)}
          </div>
        </div>
      `).join('');
    }
  }

  // ─── Settings ─────────────────────────────────────────────────
  async function settings() {
    const user = await SF.getUser();
    if (!user) return;

    document.getElementById('settings-name').value      = user.name      || '';
    document.getElementById('settings-store').value     = user.store     || '';
    document.getElementById('settings-instagram').value = user.instagram || '';
    document.getElementById('settings-email').value     = user.email     || '';
    document.getElementById('settings-phone').value     = user.phone     || '';
    document.getElementById('settings-upi').value       = user.upiId     || '';

    const autoEmailToggle = document.getElementById('settings-auto-email');
    if (autoEmailToggle) autoEmailToggle.checked = !!user.autoEmail;

    // Render subscription / plan section
    if (typeof Billing !== 'undefined') {
      await Billing.renderSubscriptionSection(user);
    }
  }

  // ─── Analytics ────────────────────────────────────────────────
  async function analytics() {
    const container = document.getElementById('analytics-content');
    if (!container) return;
    if (typeof Analytics !== 'undefined') {
      await Analytics.render(container);
    } else {
      container.innerHTML = '<div class="an-error">Analytics module not loaded.</div>';
    }
  }

  return { dashboard, products, orders, customers, billing, settings, analytics };
})();
