// SellerFlow — Advanced Analytics Module
// Computes all business intelligence from live Supabase data.
// Rendering is self-contained — Pages.analytics() calls Analytics.render().
//
// SUBSCRIPTION GATING
//   Bronze  → full access (flag: ANALYTICS_BRONZE = true)
//   Platinum → full access
//   Free    → upgrade prompt only
//   To restrict Bronze later: flip ANALYTICS_BRONZE to false.
//
// ARCHITECTURE
//   Analytics.compute(orders, products, customers) → pure data, no DOM
//   Analytics.render(container)                    → fetches data + paints UI
//   Chart instances tracked in _charts{} to allow clean re-renders
// ================================================================

const Analytics = (() => {

  // ── Subscription gate ────────────────────────────────────────
  // Flip to false to require Platinum for analytics access.
  const ANALYTICS_BRONZE = true;

  function _canAccess() {
    if (typeof Billing === 'undefined') return true;
    if (ANALYTICS_BRONZE) {
      // Bronze OR Platinum OR Trial
      const id = Billing.getCurrentPlan().id;
      return id === 'bronze' || id === 'platinum' || id === 'trial';
    }
    return Billing.canUseAnalytics();
  }

  // ── Chart registry (destroy before re-creating) ──────────────
  const _charts = {};

  function _destroyChart(key) {
    if (_charts[key]) {
      try { _charts[key].destroy(); } catch (_) {}
      delete _charts[key];
    }
  }

  function _destroyAll() {
    Object.keys(_charts).forEach(_destroyChart);
  }

  // ── Shared Chart.js defaults (matches SellerFlow dark theme) ─
  // ── Shared Chart.js defaults ───────────────────────
const CHART_DEFAULTS = {
  color: {
    accent:    '#D02752',
    cyan:      '#8A244B',
    success:   '#D02752',
    warn:      '#111F35',
    danger:    '#F63049',
    purple:    '#8A244B',
    pink:      '#F63049',
    grid:      'rgba(17,31,53,0.06)',
    textMuted: '#9a6070',
  },
  tooltip: {
    backgroundColor: '#111F35',
    titleColor:  '#fde8eb',
    bodyColor:   '#ffffff',
    borderColor: 'rgba(208,39,82,0.25)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    displayColors: true,
  },
};

const PALETTE = [
  '#D02752',   // deep rose — primary
  '#111F35',   // navy — secondary
  '#8A244B',   // burgundy — tertiary
  '#F63049',   // bright red — highlight
  '#4a2030',   // dark wine
  '#7a1535',   // claret
  '#c45c6a',   // muted rose
  '#1e3a5f',   // deep navy
];

  // ════════════════════════════════════════════════════════════
  //  DATA COMPUTATION — pure functions, no DOM
  // ════════════════════════════════════════════════════════════

  function compute(orders, products, customers) {
    const now       = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                        .toISOString().slice(0, 7);

    // ── Filter helpers ────────────────────────────────────────
    const paidOrders  = orders.filter(o => o.payment === 'paid');
    const thisOrders  = orders.filter(o => (o.date || '').startsWith(thisMonth));
    const lastOrders  = orders.filter(o => (o.date || '').startsWith(lastMonth));
    const thisPaid    = thisOrders.filter(o => o.payment === 'paid');
    const lastPaid    = lastOrders.filter(o => o.payment === 'paid');

    // ── Revenue Intelligence ──────────────────────────────────
    const revThisMonth  = thisPaid.reduce((s, o) => s + o.total, 0);
    const revLastMonth  = lastPaid.reduce((s, o) => s + o.total, 0);
    const revGrowth     = lastPaid.length === 0
      ? null
      : ((revThisMonth - revLastMonth) / (revLastMonth || 1)) * 100;
    const totalRevAll   = paidOrders.reduce((s, o) => s + o.total, 0);
    const aov           = paidOrders.length ? totalRevAll / paidOrders.length : 0;
    const pendingRev    = orders.filter(o => o.payment === 'pending')
                               .reduce((s, o) => s + o.total, 0);

    // Month-end prediction: linear projection based on current day
    const dayOfMonth  = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthPrediction = dayOfMonth > 0
      ? (revThisMonth / dayOfMonth) * daysInMonth
      : 0;

    // Daily sales trend (last 14 days)
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { rev: 0, count: 0 };
    }
    paidOrders.forEach(o => {
      if (dailyMap[o.date]) {
        dailyMap[o.date].rev   += o.total;
        dailyMap[o.date].count += 1;
      }
    });

    // Weekly sales (last 8 weeks)
    const weeklyMap = {};
    for (let i = 7; i >= 0; i--) {
      const d    = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const wKey = _weekKey(d);
      if (!weeklyMap[wKey]) weeklyMap[wKey] = { rev: 0, count: 0, label: _weekLabel(d) };
    }
    paidOrders.forEach(o => {
      if (!o.date) return;
      const wKey = _weekKey(new Date(o.date));
      if (weeklyMap[wKey]) {
        weeklyMap[wKey].rev   += o.total;
        weeklyMap[wKey].count += 1;
      }
    });

    // ── Product Intelligence ──────────────────────────────────
    const productRevMap  = {}; // productId → { name, rev, qty, orders }
    const productOrdMap  = {}; // productId → order count (distinct orders)
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const pid = item.productId || item.name;
        if (!productRevMap[pid]) {
          productRevMap[pid] = { name: item.name, rev: 0, qty: 0, orders: 0 };
        }
        if (o.payment === 'paid') productRevMap[pid].rev += item.price * item.qty;
        productRevMap[pid].qty    += item.qty;
        productRevMap[pid].orders += 1;
      });
    });

    const productList = Object.values(productRevMap);
    const top5ByRev   = [...productList].sort((a, b) => b.rev - a.rev).slice(0, 5);
    const top5ByQty   = [...productList].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // Dead stock: products in DB with 0 revenue in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const recentRevMap  = {};
    orders.filter(o => o.date >= thirtyDaysAgo).forEach(o => {
      (o.items || []).forEach(item => {
        const pid = item.productId || item.name;
        recentRevMap[pid] = (recentRevMap[pid] || 0) + item.qty;
      });
    });
    const deadStock = products
      .filter(p => !recentRevMap[p.id] && p.stock > 0)
      .slice(0, 5);

    // Category revenue
    const catRevMap = {};
    orders.filter(o => o.payment === 'paid').forEach(o => {
      (o.items || []).forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const cat = product?.category || 'Uncategorised';
        catRevMap[cat] = (catRevMap[cat] || 0) + item.price * item.qty;
      });
    });

    // ── Customer Intelligence ─────────────────────────────────
    const custOrderMap  = {}; // customerId → { name, orders, rev, lastDate }
    orders.forEach(o => {
      if (!o.customerId) return;
      if (!custOrderMap[o.customerId]) {
        custOrderMap[o.customerId] = { name: o.customerName, orders: 0, rev: 0, lastDate: '' };
      }
      custOrderMap[o.customerId].orders += 1;
      if (o.payment === 'paid') custOrderMap[o.customerId].rev += o.total;
      if (!custOrderMap[o.customerId].lastDate || o.date > custOrderMap[o.customerId].lastDate) {
        custOrderMap[o.customerId].lastDate = o.date;
      }
    });

    const custList      = Object.values(custOrderMap);
    const topSpenders   = [...custList].sort((a, b) => b.rev - a.rev).slice(0, 5);
    const topFrequency  = [...custList].sort((a, b) => b.orders - a.orders).slice(0, 5);
    const repeatCount   = custList.filter(c => c.orders >= 2).length;
    const repeatRatio   = customers.length ? Math.round((repeatCount / customers.length) * 100) : 0;

    // Inactive repeats: ordered 2+ times but not in last 30 days
    const inactiveRepeats = custList
      .filter(c => c.orders >= 2 && c.lastDate < thirtyDaysAgo)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 3);

    // ── Location Intelligence ─────────────────────────────────
    const cityMap  = {}; // city → { orders, rev }
    const stateMap = {};
    customers.forEach(c => {
      if (!c.city && !c.state) return;
      const custOrds = orders.filter(o => o.customerId === c.id);
      const custRev  = custOrds.filter(o => o.payment === 'paid')
                               .reduce((s, o) => s + o.total, 0);
      if (c.city) {
        const city = _titleCase(c.city.trim());
        if (!cityMap[city]) cityMap[city] = { orders: 0, rev: 0 };
        cityMap[city].orders += custOrds.length;
        cityMap[city].rev    += custRev;
      }
      if (c.state) {
        const state = _titleCase(c.state.trim());
        if (!stateMap[state]) stateMap[state] = { orders: 0, rev: 0 };
        stateMap[state].orders += custOrds.length;
        stateMap[state].rev    += custRev;
      }
    });

    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1].orders - a[1].orders).slice(0, 6);
    const topStates = Object.entries(stateMap)
      .sort((a, b) => b[1].orders - a[1].orders).slice(0, 5);
    const topRevCity = Object.entries(cityMap)
      .sort((a, b) => b[1].rev - a[1].rev)[0] || null;

    // ── Smart Suggestions ─────────────────────────────────────
    const suggestions = _buildSuggestions({
      products, orders, customers,
      revThisMonth, revLastMonth, revGrowth, monthPrediction,
      top5ByRev, deadStock, inactiveRepeats,
      topRevCity, topCities, pendingRev,
      dayOfMonth, daysInMonth,
    });

    return {
      // Revenue
      revThisMonth, revLastMonth, revGrowth, aov,
      pendingRev, monthPrediction, dayOfMonth, daysInMonth,
      ordersThisMonth: thisOrders.length,
      ordersLastMonth: lastOrders.length,
      // Daily / Weekly
      dailyLabels:  Object.keys(dailyMap).map(d => d.slice(5)),
      dailyRevenue: Object.values(dailyMap).map(v => v.rev),
      dailyOrders:  Object.values(dailyMap).map(v => v.count),
      weeklyLabels:  Object.values(weeklyMap).map(v => v.label),
      weeklyRevenue: Object.values(weeklyMap).map(v => v.rev),
      // Products
      top5ByRev, top5ByQty, deadStock,
      catRevMap,
      // Customers
      topSpenders, topFrequency,
      repeatRatio, repeatCount,
      totalCustomers: customers.length,
      inactiveRepeats,
      // Location
      topCities, topStates, topRevCity,
      // Suggestions
      suggestions,
    };
  }

  // ── Smart suggestions generator ──────────────────────────────
  function _buildSuggestions(d) {
    const tips = [];

    // Revenue projection
    if (d.dayOfMonth >= 5 && d.monthPrediction > 0) {
      const fmt = SF.formatCurrency(Math.round(d.monthPrediction / 100) * 100);
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`, color: '#6366F1',
        text: `At your current pace, you're on track to earn <strong>${fmt}</strong> this month.` });
    }

    // Growth
    if (d.revGrowth !== null) {
      if (d.revGrowth > 20) {
        tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>`, color: '#10B981',
          text: `Revenue is up <strong>${Math.abs(d.revGrowth).toFixed(0)}%</strong> vs last month. Keep the momentum!` });
      } else if (d.revGrowth < -15) {
        tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`, color: '#EF4444',
          text: `Revenue dropped <strong>${Math.abs(d.revGrowth).toFixed(0)}%</strong> vs last month. Consider running a promotion.` });
      }
    }

    // Top city
    if (d.topRevCity) {
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, color: '#22D3EE',
        text: `<strong>${d.topRevCity[0]}</strong> is your highest-revenue city. Consider exclusive offers there.` });
    }

    // Top product restock
    if (d.top5ByRev.length) {
      const top = d.top5ByRev[0];
      const prod = d.products.find(p => p.name === top.name);
      if (prod && prod.stock <= (prod.lowStockThreshold || 5)) {
        tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, color: '#F59E0B',
          text: `Your best-seller <strong>${top.name}</strong> is running low on stock. Restock before you lose sales.` });
      }
    }

    // Dead stock
    if (d.deadStock.length) {
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`, color: '#8B5CF6',
        text: `<strong>${d.deadStock[0].name}</strong> hasn't sold in 30 days. Consider a discount to clear stock.` });
    }

    // Inactive repeats
    if (d.inactiveRepeats.length) {
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`, color: '#EC4899',
        text: `<strong>${d.inactiveRepeats[0].name}</strong> is a repeat buyer who hasn't ordered in 30+ days. A personal outreach could bring them back.` });
    }

    // Pending revenue
    if (d.pendingRev > 0) {
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, color: '#F59E0B',
        text: `You have <strong>${SF.formatCurrency(d.pendingRev)}</strong> in pending payments. Send reminders to close these quickly.` });
    }

    // Low city diversity
    if (d.topCities.length === 1) {
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`, color: '#22D3EE',
        text: `All your orders are from one city. Share your store link in new Instagram markets to diversify.` });
    }

    // No suggestions
    if (tips.length === 0) {
      tips.push({ icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><polyline points="20 6 9 17 4 12"/></svg>`, color: '#10B981',
        text: `Your store looks healthy! Add more products and share your catalogue to grow faster.` });
    }

    return tips;
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _weekKey(d) {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return start.toISOString().slice(0, 10);
  }
  function _weekLabel(d) {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function _titleCase(str) {
    return str.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }

  // ════════════════════════════════════════════════════════════
  //  RENDERING
  // ════════════════════════════════════════════════════════════

  async function render(container) {
    if (!container) return;

    // ── Access gate ───────────────────────────────────────────
    if (!_canAccess()) {
      container.innerHTML = _renderUpgradeWall();
      return;
    }

    // ── Skeleton ──────────────────────────────────────────────
    container.innerHTML = _skeletonHTML();

    try {
      const [orders, products, customers] = await Promise.all([
        SF.getOrders(),
        SF.getProducts(),
        SF.getCustomers(),
      ]);

      const data = compute(orders, products, customers);

      _destroyAll();
      container.innerHTML = _buildHTML(data);
      _mountCharts(data);
    } catch (err) {
      console.error('[Analytics] render failed:', err);
      container.innerHTML = `<div class="an-error">
        <div style="margin-bottom:12px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">Failed to load analytics</div>
        <div style="font-size:13px;color:var(--text-muted)">${err.message}</div>
      </div>`;
    }
  }

  // ── Upgrade wall ─────────────────────────────────────────────
  function _renderUpgradeWall() {
    return `
      <div class="an-upgrade-wall">
        <div class="an-upgrade-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
        <div class="an-upgrade-title">Advanced Analytics</div>
        <div class="an-upgrade-sub">
          Unlock your business growth cockpit.<br>
          Understand revenue, products, customers and locations — all in one view.
        </div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="UI.navigate('settings')">
          Upgrade to Bronze or Platinum →
        </button>
      </div>`;
  }

  // ── Skeleton HTML ─────────────────────────────────────────────
  function _skeletonHTML() {
    const card = () => `<div class="an-skeleton-card"><div class="skeleton-line" style="width:40%;height:11px;margin-bottom:10px"></div><div class="skeleton-line" style="width:60%;height:28px;margin-bottom:8px"></div><div class="skeleton-line" style="width:50%;height:11px"></div></div>`;
    const chart = () => `<div class="an-skeleton-chart"><div class="skeleton-line" style="height:100%;border-radius:10px"></div></div>`;
    return `
      <div class="an-skeleton-grid">${Array(4).fill(card()).join('')}</div>
      <div class="an-skeleton-charts">${chart()}${chart()}</div>
      <div class="an-skeleton-grid">${Array(4).fill(card()).join('')}</div>`;
  }

  // ── Full HTML ─────────────────────────────────────────────────
  function _buildHTML(d) {
    return `
      <!-- ══ REVENUE INTELLIGENCE ══════════════════════════════ -->
      <div class="an-section-label">📈 Revenue Intelligence</div>

      <div class="an-stat-grid">
        ${_statCard('Monthly Revenue', SF.formatCurrency(d.revThisMonth),
          d.revGrowth !== null
            ? `${d.revGrowth >= 0 ? '↑' : '↓'} ${Math.abs(d.revGrowth).toFixed(1)}% vs last month`
            : 'This month', d.revGrowth >= 0 ? 'success' : 'danger', '💰')}
        ${_statCard('Avg. Order Value', SF.formatCurrency(Math.round(d.aov)),
          `${d.ordersThisMonth} orders this month`, 'accent', '🧾')}
        ${_statCard('Pending Collection', SF.formatCurrency(d.pendingRev),
          'Follow up to collect', 'warn', '⏳')}
        ${_statCard('Month Prediction', SF.formatCurrency(Math.round(d.monthPrediction / 100) * 100),
          `Based on day ${d.dayOfMonth} of ${d.daysInMonth}`, 'cyan', '🎯')}
      </div>

      <div class="an-chart-row">
        <div class="an-chart-card an-chart-wide">
          <div class="an-chart-header">
            <div>
              <div class="an-chart-title">Daily Revenue Trend</div>
              <div class="an-chart-sub">Last 14 days • paid orders only</div>
            </div>
            <div class="an-legend-dot" style="background:var(--accent)"></div>
          </div>
          <div class="an-chart-area">
            <canvas id="an-daily-rev"></canvas>
          </div>
        </div>
        <div class="an-chart-card">
          <div class="an-chart-header">
            <div>
              <div class="an-chart-title">Paid vs Pending</div>
              <div class="an-chart-sub">Revenue split</div>
            </div>
          </div>
          <div class="an-chart-area" style="height:200px">
            <canvas id="an-paid-split"></canvas>
          </div>
        </div>
      </div>

      <div class="an-chart-card" style="margin-bottom:32px">
        <div class="an-chart-header">
          <div>
            <div class="an-chart-title">Weekly Revenue (8 Weeks)</div>
            <div class="an-chart-sub">Rolling weekly paid revenue</div>
          </div>
        </div>
        <div class="an-chart-area" style="height:200px">
          <canvas id="an-weekly-rev"></canvas>
        </div>
      </div>

      <!-- ══ PRODUCT INTELLIGENCE ═══════════════════════════════ -->
      <div class="an-section-label">📦 Product Intelligence</div>

      <div class="an-chart-row">
        <div class="an-chart-card">
          <div class="an-chart-header">
            <div class="an-chart-title">Top 5 by Revenue</div>
          </div>
          <div class="an-chart-area" style="height:220px">
            <canvas id="an-top-rev"></canvas>
          </div>
        </div>
        <div class="an-chart-card">
          <div class="an-chart-header">
            <div class="an-chart-title">Category Revenue Split</div>
          </div>
          <div class="an-chart-area" style="height:220px">
            <canvas id="an-cat-split"></canvas>
          </div>
        </div>
      </div>

      <div class="an-two-col" style="margin-bottom:32px">
        <div class="an-table-card">
          <div class="an-table-title">🚀 Fastest Moving (by Qty)</div>
          ${_rankTable(d.top5ByQty, i => SF.formatCurrency(i.rev), i => `${i.qty} units sold`)}
        </div>
        <div class="an-table-card">
          <div class="an-table-title">🪦 Dead Stock (30-day)</div>
          ${d.deadStock.length
            ? _rankTable(d.deadStock.map(p => ({ name: p.name, rev: 0, qty: p.stock })),
                i => `${i.qty} in stock`, i => 'No sales in 30 days', true)
            : '<div class="an-empty-inline">✅ All products are moving!</div>'}
        </div>
      </div>

      <!-- ══ CUSTOMER INTELLIGENCE ══════════════════════════════ -->
      <div class="an-section-label">👥 Customer Intelligence</div>

      <div class="an-stat-grid" style="grid-template-columns:repeat(3,1fr)">
        ${_statCard('Total Customers', d.totalCustomers, 'Registered buyers', 'accent', '👥')}
        ${_statCard('Repeat Buyers', d.repeatCount, `${d.repeatRatio}% repeat ratio`, 'success', '⭐')}
        ${_statCard('Repeat Ratio', `${d.repeatRatio}%`, `${d.repeatCount} customers bought 2×+`, 'cyan', '🔁')}
      </div>

      <div class="an-two-col" style="margin-bottom:32px">
        <div class="an-table-card">
          <div class="an-table-title">💎 Top Spenders</div>
          ${_rankTable(d.topSpenders, i => SF.formatCurrency(i.rev), i => `${i.orders} orders`)}
        </div>
        <div class="an-table-card">
          <div class="an-table-title">🔁 Highest Order Frequency</div>
          ${_rankTable(d.topFrequency, i => `${i.orders} orders`, i => SF.formatCurrency(i.rev))}
        </div>
      </div>

      ${d.inactiveRepeats.length ? `
        <div class="an-alert-card" style="margin-bottom:32px">
          <div class="an-alert-title">💌 Inactive Repeat Customers</div>
          <div class="an-alert-sub">These loyal buyers haven't ordered in 30+ days — reach out!</div>
          <div class="an-alert-list">
            ${d.inactiveRepeats.map(c => `
              <div class="an-alert-item">
                <div class="an-alert-avatar">${(c.name||'?')[0].toUpperCase()}</div>
                <div class="an-alert-info">
                  <div class="an-alert-name">${c.name}</div>
                  <div class="an-alert-meta">${c.orders} orders · ${SF.formatCurrency(c.rev)} total spent</div>
                </div>
                <div class="an-alert-badge">Follow up</div>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- ══ LOCATION INTELLIGENCE ══════════════════════════════ -->
      <div class="an-section-label">🌍 Location Intelligence</div>

      ${(d.topCities.length || d.topStates.length) ? `
        <div class="an-chart-row" style="margin-bottom:32px">
          <div class="an-chart-card">
            <div class="an-chart-header">
              <div class="an-chart-title">Top Cities by Orders</div>
            </div>
            <div class="an-chart-area" style="height:220px">
              <canvas id="an-city-bar"></canvas>
            </div>
          </div>
          <div class="an-chart-card">
            <div class="an-chart-header">
              <div class="an-chart-title">Top States by Orders</div>
            </div>
            <div class="an-chart-area" style="height:220px">
              <canvas id="an-state-donut"></canvas>
            </div>
          </div>
        </div>

        <div class="an-location-grid" style="margin-bottom:32px">
          ${d.topCities.slice(0, 6).map(([city, stats], i) => `
            <div class="an-loc-card">
              <div class="an-loc-rank">#${i+1}</div>
              <div class="an-loc-city">${city}</div>
              <div class="an-loc-orders">${stats.orders} order${stats.orders !== 1 ? 's' : ''}</div>
              <div class="an-loc-rev">${SF.formatCurrency(stats.rev)}</div>
            </div>`).join('')}
        </div>
      ` : `
        <div class="an-empty-section" style="margin-bottom:32px">
          <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:0.4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div class="empty-title">No location data yet</div>
          <div class="empty-desc">Add city and state when creating customers to unlock location insights.</div>
        </div>`}

      <!-- ══ AI SUGGESTIONS ════════════════════════════════════ -->
      <div class="an-section-label">🧠 Smart Suggestions</div>
      <div class="an-suggestions">
        ${d.suggestions.map(s => `
          <div class="an-suggestion">
            <div class="an-sug-icon" style="color:${s.color}">${s.icon}</div>
            <div class="an-sug-text">${s.text}</div>
          </div>`).join('')}
      </div>
    `;
  }

  // ── Stat card helper ──────────────────────────────────────────
  function _statCard(label, value, change, variant, icon) {
    const colorMap = {
      success: 'var(--success)', danger: 'var(--danger)',
      warn: 'var(--warn)', accent: 'var(--accent)', cyan: 'var(--accent-2)',
    };
    const bgMap = {
      success: 'var(--success-dim)', danger: 'var(--danger-dim)',
      warn: 'var(--warn-dim)', accent: 'var(--accent-dim)',
      cyan: 'rgba(34,211,238,0.12)',
    };
    const color = colorMap[variant] || colorMap.accent;
    const bg    = bgMap[variant] || bgMap.accent;
    return `
      <div class="an-stat-card">
        <div class="an-stat-top">
          <span class="an-stat-label">${label}</span>
          <div class="an-stat-icon" style="background:${bg};color:${color}">${icon}</div>
        </div>
        <div class="an-stat-value">${value}</div>
        <div class="an-stat-change" style="color:${color}">${change}</div>
      </div>`;
  }

  // ── Rank table helper ─────────────────────────────────────────
  function _rankTable(items, valueFn, subFn, muted = false) {
    if (!items.length) return '<div class="an-empty-inline">No data yet</div>';
    return `<div class="an-rank-list">
      ${items.map((item, i) => `
        <div class="an-rank-item">
          <div class="an-rank-num" style="color:${muted ? 'var(--text-muted)' : PALETTE[i % PALETTE.length]}">${i + 1}</div>
          <div class="an-rank-info">
            <div class="an-rank-name">${item.name}</div>
            <div class="an-rank-sub">${subFn(item)}</div>
          </div>
          <div class="an-rank-val">${valueFn(item)}</div>
        </div>`).join('')}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  CHART MOUNTING
  // ════════════════════════════════════════════════════════════

  function _mountCharts(d) {
    const C = CHART_DEFAULTS.color;
    const T = CHART_DEFAULTS.tooltip;

    // ── Daily Revenue ──────────────────────────────────────────
    const ctxDaily = document.getElementById('an-daily-rev');
    if (ctxDaily) {
      _charts['daily'] = new Chart(ctxDaily.getContext('2d'), {
        type: 'line',
        data: {
          labels: d.dailyLabels,
          datasets: [{
            label: 'Revenue ₹',
            data: d.dailyRevenue,
            borderColor: C.accent,
            backgroundColor: 'rgba(99,102,241,0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: C.accent,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4,
          }, {
            label: 'Orders',
            data: d.dailyOrders,
            borderColor: C.cyan,
            backgroundColor: 'rgba(34,211,238,0.04)',
            borderWidth: 1.5,
            pointRadius: 2,
            fill: true,
            tension: 0.4,
            yAxisID: 'y2',
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: C.textMuted, font: { size: 11 } } }, tooltip: T },
          scales: {
            x: { grid: { color: C.grid }, ticks: { color: C.textMuted, font: { size: 10 } } },
            y: { grid: { color: C.grid }, ticks: { color: C.textMuted, font: { size: 10 },
              callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } },
            y2: { position: 'right', grid: { drawOnChartArea: false },
              ticks: { color: C.textMuted, font: { size: 10 } } },
          },
        },
      });
    }

    // ── Paid vs Pending split ──────────────────────────────────
    const ctxSplit = document.getElementById('an-paid-split');
    if (ctxSplit) {
      _charts['split'] = new Chart(ctxSplit.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Pending'],
          datasets: [{ data: [d.revThisMonth, d.pendingRev],
            backgroundColor: [C.success, C.warn],
            borderColor: 'var(--bg-card)', borderWidth: 4, hoverOffset: 6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: {
            legend: { position: 'bottom', labels: { color: C.textMuted, font: { size: 11 }, padding: 14, usePointStyle: true } },
            tooltip: { ...T, callbacks: { label: ctx => `  ${ctx.label}: ${SF.formatCurrency(ctx.parsed)}` } },
          },
        },
      });
    }

    // ── Weekly revenue bar ────────────────────────────────────
    const ctxWeekly = document.getElementById('an-weekly-rev');
    if (ctxWeekly) {
      _charts['weekly'] = new Chart(ctxWeekly.getContext('2d'), {
        type: 'bar',
        data: {
          labels: d.weeklyLabels,
          datasets: [{
            label: 'Revenue ₹',
            data: d.weeklyRevenue,
            backgroundColor: PALETTE.map((c, i) => i === d.weeklyLabels.length - 1
              ? C.accent : 'rgba(99,102,241,0.35)'),
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: T },
          scales: {
            x: { grid: { color: C.grid }, ticks: { color: C.textMuted, font: { size: 10 } } },
            y: { grid: { color: C.grid }, ticks: { color: C.textMuted, font: { size: 10 },
              callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } },
          },
        },
      });
    }

    // ── Top 5 products horizontal bar ─────────────────────────
    const ctxTopRev = document.getElementById('an-top-rev');
    if (ctxTopRev) {
      _charts['toprev'] = new Chart(ctxTopRev.getContext('2d'), {
        type: 'bar',
        data: {
          labels: d.top5ByRev.map(p => p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name),
          datasets: [{
            label: 'Revenue ₹',
            data: d.top5ByRev.map(p => p.rev),
            backgroundColor: PALETTE.slice(0, 5),
            borderRadius: 6,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: T },
          scales: {
            x: { grid: { color: C.grid }, ticks: { color: C.textMuted, font: { size: 10 },
              callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } },
            y: { grid: { display: false }, ticks: { color: C.textMuted, font: { size: 11 } } },
          },
        },
      });
    }

    // ── Category revenue doughnut ──────────────────────────────
    const ctxCat = document.getElementById('an-cat-split');
    if (ctxCat) {
      const catEntries = Object.entries(d.catRevMap).sort((a, b) => b[1] - a[1]);
      _charts['cat'] = new Chart(ctxCat.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: catEntries.map(([k]) => k),
          datasets: [{
            data: catEntries.map(([, v]) => v),
            backgroundColor: PALETTE,
           borderColor: 'var(--bg-card)', borderWidth: 4, hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: C.textMuted, font: { size: 10 }, padding: 10, usePointStyle: true } },
            tooltip: { ...T, callbacks: { label: ctx => `  ${ctx.label}: ${SF.formatCurrency(ctx.parsed)}` } },
          },
        },
      });
    }

    // ── City bar chart ────────────────────────────────────────
    const ctxCity = document.getElementById('an-city-bar');
    if (ctxCity && d.topCities.length) {
      _charts['city'] = new Chart(ctxCity.getContext('2d'), {
        type: 'bar',
        data: {
          labels: d.topCities.map(([c]) => c),
          datasets: [{
            label: 'Orders',
            data: d.topCities.map(([, s]) => s.orders),
            backgroundColor: PALETTE,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: T },
          scales: {
            x: { grid: { display: false }, ticks: { color: C.textMuted, font: { size: 10 } } },
            y: { grid: { color: C.grid }, ticks: { color: C.textMuted, font: { size: 10 } } },
          },
        },
      });
    }

    // ── State doughnut ────────────────────────────────────────
    const ctxState = document.getElementById('an-state-donut');
    if (ctxState && d.topStates.length) {
      _charts['state'] = new Chart(ctxState.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: d.topStates.map(([s]) => s),
          datasets: [{
            data: d.topStates.map(([, v]) => v.orders),
            backgroundColor: PALETTE,
            borderColor: 'var(--bg-card)', borderWidth: 4, hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { color: C.textMuted, font: { size: 10 }, padding: 10, usePointStyle: true } },
            tooltip: T,
          },
        },
      });
    }
  }

  // Public API
  return { render, compute };
})();