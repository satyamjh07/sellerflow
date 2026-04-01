// SellerFlow — Pages Module
// Renders each page section with dynamic data
// ================================================================

const Pages = (() => {

  // ─── Charts instances (to destroy/recreate) ───────
  let revenueChart = null;
  let categoryChart = null;

  // ─── Dashboard ────────────────────────────────────
  function dashboard() {
    const stats    = SF.getDashStats();
    const orders   = SF.getOrders();
    const products = SF.getProducts();
    const analytics = SF.getAnalytics();

    // Stats
    document.getElementById('stat-revenue').textContent    = SF.formatCurrency(stats.totalRevenue);
    document.getElementById('stat-orders').textContent     = stats.totalOrders;
    document.getElementById('stat-pending').textContent    = stats.pendingPayments;
    document.getElementById('stat-customers').textContent  = stats.totalCustomers;
    document.getElementById('stat-repeat').textContent     = stats.repeatCustomers;

    // Recent orders
    const recentEl = document.getElementById('recent-orders-list');
    const recent = orders.slice(0, 6);
    if (recent.length === 0) {
      recentEl.innerHTML = UI.emptyState('📦','No orders yet','Create your first order to see activity here');
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
    const low = products.filter(p => p.stock <= p.lowStockThreshold);
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

    // Revenue Chart
    const ctx = document.getElementById('revenueChart');
    if (ctx) {
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
              backgroundColor: '#111827',
              titleColor: '#94A3B8',
              bodyColor: '#F1F5F9',
              borderColor: 'rgba(99,102,241,0.3)',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: ctx => '  ₹' + ctx.parsed.y.toLocaleString('en-IN'),
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#475569', font: { size: 11 } },
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                color: '#475569',
                font: { size: 11 },
                callback: v => '₹' + (v/1000).toFixed(0) + 'k',
              }
            }
          }
        }
      });
    }

    // Category Chart
    const ctx2 = document.getElementById('categoryChart');
    if (ctx2) {
      if (categoryChart) categoryChart.destroy();
      categoryChart = new Chart(ctx2.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: analytics.topCategories.labels,
          datasets: [{
            data: analytics.topCategories.data,
            backgroundColor: ['#6366F1','#22D3EE','#F59E0B','#10B981','#EF4444','#8B5CF6'],
            borderColor: '#111827',
            borderWidth: 3,
            hoverBorderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#94A3B8',
                padding: 14,
                font: { size: 11 },
                usePointStyle: true,
                pointStyleWidth: 8,
              }
            },
            tooltip: {
              backgroundColor: '#111827',
              titleColor: '#94A3B8',
              bodyColor: '#F1F5F9',
              borderColor: 'rgba(99,102,241,0.3)',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: ctx => `  ${ctx.label}: ${ctx.parsed}%`,
              }
            }
          }
        }
      });
    }
  }

  // ─── Products ─────────────────────────────────────
  let productQuery = '';
  let productCatFilter = '';

  function products(query, catFilter) {
    if (query !== undefined)     productQuery = query;
    if (catFilter !== undefined) productCatFilter = catFilter;

    let list = SF.getProducts();
    if (productQuery) {
      const q = productQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)  ||
        p.category.toLowerCase().includes(q)
      );
    }
    if (productCatFilter) {
      list = list.filter(p => p.category === productCatFilter);
    }

    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${UI.emptyState('📦','No products found','Add your first product or clear your filters')}</td></tr>`;
    } else {
      tbody.innerHTML = list.map(p => {
        const stockClass = p.stock === 0 ? 'stock-low' : p.stock <= p.lowStockThreshold ? 'stock-mid' : 'stock-good';
        const stockBadge = p.stock <= p.lowStockThreshold
          ? `<span class="badge badge-warn" style="margin-left:6px">Low</span>` : '';
        return `
          <tr>
            <td>
              <div class="product-name-cell">
                <div class="product-img">${p.emoji || '📦'}</div>
                <div class="product-name-info">
                  <div class="product-name">${p.name}</div>
                  <div class="product-sku">${p.sku}</div>
                </div>
              </div>
            </td>
            <td><span class="badge badge-muted">${p.category}</span></td>
            <td class="fw-700">${SF.formatCurrency(p.price)}</td>
            <td>
              <span class="stock-number ${stockClass}">${p.stock}</span>
              ${stockBadge}
            </td>
            <td class="text-muted" style="font-size:12px">${p.lowStockThreshold}</td>
            <td>
              <div class="action-btns">
                <button class="action-btn action-btn-edit" onclick="Modals.editProduct('${p.id}')">✏️ Edit</button>
                <button class="action-btn action-btn-del" onclick="Modals.deleteProduct('${p.id}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Populate category filter options
    const catSel = document.getElementById('product-cat-filter');
    if (catSel && catSel.options.length <= 1) {
      const cats = [...new Set(SF.getProducts().map(p => p.category))];
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        catSel.appendChild(opt);
      });
    }
  }

  // ─── Orders ───────────────────────────────────────
  let orderFilter = 'all';

  function orders(filter) {
    if (filter !== undefined) orderFilter = filter;
    let list = SF.getOrders();
    if (orderFilter === 'pending')   list = list.filter(o => o.payment === 'pending');
    if (orderFilter === 'paid')      list = list.filter(o => o.payment === 'paid');
    if (orderFilter === 'shipped')   list = list.filter(o => o.status === 'shipped');
    if (orderFilter === 'delivered') list = list.filter(o => o.status === 'delivered');
    if (orderFilter === 'cancelled') list = list.filter(o => o.status === 'cancelled');

    // Active filter tab
    document.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === orderFilter);
    });

    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${UI.emptyState('📋','No orders found','Create a new order or change your filter')}</td></tr>`;
    } else {
      tbody.innerHTML = list.map(o => `
        <tr>
          <td class="fw-700 text-accent">${o.id}</td>
          <td>
            <div class="customer-name-cell">
              <div class="customer-avatar" style="width:30px;height:30px;font-size:11px">${SF.initials(o.customerName)}</div>
              <span>${o.customerName}</span>
            </div>
          </td>
          <td style="font-size:12px;color:var(--text-secondary)">${o.items.map(i => i.name).join(', ')}</td>
          <td class="fw-700">${SF.formatCurrency(o.total)}</td>
          <td>${UI.orderStatusBadge(o.status)}</td>
          <td>${UI.paymentBadge(o.payment)}</td>
          <td>${SF.formatDate(o.date)}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn action-btn-edit" onclick="Modals.viewOrder('${o.id}')">👁️ View</button>
              <button class="action-btn action-btn-edit" onclick="Modals.showInvoice('${o.id}')">🧾</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  // ─── Customers ────────────────────────────────────
  let customerQuery = '';

  function customers(query) {
    if (query !== undefined) customerQuery = query;
    let list = SF.getCustomers();
    if (customerQuery) {
      const q = customerQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.instagram||'').toLowerCase().includes(q) ||
        (c.city||'').toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${UI.emptyState('👤','No customers found','Customers are created automatically when you add orders')}</td></tr>`;
    } else {
      tbody.innerHTML = list.map(c => {
        const isRepeat = c.totalOrders >= 2;
        return `
          <tr class="customer-row" onclick="Modals.viewCustomer('${c.id}')">
            <td>
              <div class="customer-name-cell">
                <div class="customer-avatar">${SF.initials(c.name)}</div>
                <div>
                  <div class="customer-name">${c.name}</div>
                  <div class="customer-handle">${c.instagram || '—'}</div>
                </div>
              </div>
            </td>
            <td>${c.city || '—'}</td>
            <td class="fw-700">${c.totalOrders || 0}</td>
            <td class="fw-700 text-accent">${SF.formatCurrency(c.totalSpent || 0)}</td>
            <td>${SF.formatDate(c.lastOrder)}</td>
            <td>
              ${isRepeat
                ? `<span class="badge badge-success">⭐ Repeat</span>`
                : `<span class="badge badge-muted">New</span>`
              }
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // ─── Billing ──────────────────────────────────────
  function billing() {
    const orders = SF.getOrders();
    const container = document.getElementById('billing-grid');
    if (!container) return;

    const pendingSum = orders.filter(o => o.payment === 'pending').reduce((s,o) => s+o.total, 0);
    const paidSum    = orders.filter(o => o.payment === 'paid').reduce((s,o) => s+o.total, 0);

    document.getElementById('billing-pending-total').textContent = SF.formatCurrency(pendingSum);
    document.getElementById('billing-paid-total').textContent    = SF.formatCurrency(paidSum);
    document.getElementById('billing-total-invoices').textContent = orders.length;

    if (orders.length === 0) {
      container.innerHTML = UI.emptyState('🧾','No invoices yet','Orders will appear here automatically');
    } else {
      container.innerHTML = orders.map(o => `
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

  // ─── Settings ─────────────────────────────────────
  function settings() {
    const user = SF.getUser();
    document.getElementById('settings-name').value      = user.name || '';
    document.getElementById('settings-store').value     = user.store || '';
    document.getElementById('settings-instagram').value = user.instagram || '';
    document.getElementById('settings-email').value     = user.email || '';
    document.getElementById('settings-phone').value     = user.phone || '';
    document.getElementById('settings-upi').value       = user.upiId || '';
  }

  return { dashboard, products, orders, customers, billing, settings };
})();