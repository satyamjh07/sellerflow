// SellerFlow — Data Module (Supabase Edition)
// Async database service layer. Replaces localStorage with Supabase Postgres.
//
// DESIGN PRINCIPLES
//   • Every public method is async and returns plain JS objects —
//     callers never touch Supabase types directly.
//   • Column naming: DB uses snake_case; JS uses camelCase.
//     _toJS() / _toDB() helpers handle the mapping at the boundary.
//   • The SF.* interface is preserved so pages.js / modals.js need
//     minimal changes — they just need to await calls.
//   • user_id is injected automatically from Auth.getUserId();
//     callers never pass it.
// ================================================================

const SF = (() => {

  // ─── Column mappers ──────────────────────────────────────────
  // Products: DB → JS
  function _productToJS(row) {
    if (!row) return null;
    return {
      id:                row.id,
      name:              row.name,
      sku:               row.sku               || '',
      category:          row.category          || '',
      price:             Number(row.price)     || 0,
      stock:             row.stock             || 0,
      lowStockThreshold: row.low_stock_threshold || 5,
      emoji:             row.emoji             || '📦',
      image:             row.image             || null,
      variant:           row.variant           || null,
    };
  }

  // Products: JS → DB (omit id/user_id — handled separately)
  function _productToDB(p) {
    return {
      name:                p.name,
      sku:                 p.sku                 || '',
      category:            p.category            || '',
      price:               p.price               || 0,
      stock:               p.stock               || 0,
      low_stock_threshold: p.lowStockThreshold   || 5,
      emoji:               p.emoji               || '📦',
      image:               p.image               || null,
      variant:             p.variant             || null,
    };
  }

  // Customers: DB → JS
  function _customerToJS(row) {
    if (!row) return null;
    return {
      id:           row.id,
      name:         row.name,
      instagram:    row.instagram    || '',
      phone:        row.phone        || '',
      email:        row.email        || '',
      city:         row.city         || '',
      state:        row.state        || '',
      address:      row.address      || '',
      landmark:     row.landmark     || '',
      pincode:      row.pincode      || '',
      whatsapp:     row.whatsapp     || '',
      notes:        row.notes        || '',
      repeatScore:  row.repeat_score || null,
      totalOrders:  row.total_orders || 0,
      totalSpent:   Number(row.total_spent) || 0,
      firstOrder:   row.first_order  || null,
      lastOrder:    row.last_order   || null,
    };
  }

  // Customers: JS → DB
  function _customerToDB(c) {
    return {
      name:         c.name,
      instagram:    c.instagram    || '',
      phone:        c.phone        || '',
      email:        c.email        || '',
      city:         c.city         || '',
      state:        c.state        || '',
      address:      c.address      || '',
      landmark:     c.landmark     || '',
      pincode:      c.pincode      || '',
      whatsapp:     c.whatsapp     || '',
      notes:        c.notes        || '',
      repeat_score: c.repeatScore  || null,
      total_orders: c.totalOrders  || 0,
      total_spent:  c.totalSpent   || 0,
      first_order:  c.firstOrder   || null,
      last_order:   c.lastOrder    || null,
    };
  }

  // Orders: DB → JS
  function _orderToJS(row) {
    if (!row) return null;
    return {
      id:              row.id,
      customerId:      row.customer_id      || null,
      customerName:    row.customer_name    || '',
      items:           Array.isArray(row.items) ? row.items : [],
      total:           Number(row.total)    || 0,
      discount:        Number(row.discount) || 0,
      coupon:          row.coupon           || '',
      status:          row.status           || 'processing',
      payment:         row.payment          || 'pending',
      shippingAddress: row.shipping_address || '',
      trackingId:      row.tracking_id      || '',
      deliveryPartner: row.delivery_partner || '',
      source:          row.source           || '',
      notes:           row.notes            || '',
      date:            row.order_date       || row.created_at?.slice(0, 10) || '',
    };
  }

  // Orders: JS → DB
  function _orderToDB(o) {
    return {
      id:               o.id,
      customer_id:      o.customerId      || null,
      customer_name:    o.customerName    || '',
      items:            o.items           || [],
      total:            o.total           || 0,
      discount:         o.discount        || 0,
      coupon:           o.coupon          || '',
      status:           o.status          || 'processing',
      payment:          o.payment         || 'pending',
      shipping_address: o.shippingAddress || '',
      tracking_id:      o.trackingId      || '',
      delivery_partner: o.deliveryPartner || '',
      source:           o.source          || '',
      notes:            o.notes           || '',
      order_date:       o.date            || new Date().toISOString().slice(0, 10),
    };
  }

  // Profiles: DB → JS
  function _profileToJS(row) {
    if (!row) return null;
    return {
      name:      row.name      || '',
      store:     row.store     || '',
      instagram: row.instagram || '',
      phone:     row.phone     || '',
      email:     row.email     || '',
      upiId:     row.upi_id    || '',
      autoEmail: row.auto_email || false,
    };
  }

  // ─── Error helper ─────────────────────────────────────────────
  function _throw(error, context) {
    console.error(`[SF:${context}]`, error?.message || error);
    throw new Error(error?.message || `Database error in ${context}`);
  }

  // ─── User / Profile ───────────────────────────────────────────

  async function getUser() {
    const uid = Auth.getUserId();
    if (!uid) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (error) _throw(error, 'getUser');
    return _profileToJS(data);
  }

  async function saveUser(updates) {
    const uid = Auth.getUserId();
    if (!uid) return;
    const dbRow = {
      name:       updates.name      || '',
      store:      updates.store     || '',
      instagram:  updates.instagram || '',
      phone:      updates.phone     || '',
      email:      updates.email     || '',
      upi_id:     updates.upiId     || '',
      auto_email: updates.autoEmail || false,
    };
    const { error } = await _supabase
      .from('profiles')
      .update(dbRow)
      .eq('id', uid);
    if (error) _throw(error, 'saveUser');
  }

  // ─── Products ─────────────────────────────────────────────────

  async function getProducts() {
    const uid = Auth.getUserId();
    const { data, error } = await _supabase
      .from('products')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });
    if (error) _throw(error, 'getProducts');
    return (data || []).map(_productToJS);
  }

  async function addProduct(p) {
    const uid = Auth.getUserId();
    const row = { ..._productToDB(p), user_id: uid };
    const { data, error } = await _supabase
      .from('products')
      .insert(row)
      .select()
      .single();
    if (error) _throw(error, 'addProduct');
    return _productToJS(data);
  }

  async function updateProduct(id, updates) {
    const uid = Auth.getUserId();
    const { error } = await _supabase
      .from('products')
      .update(_productToDB(updates))
      .eq('id', id)
      .eq('user_id', uid);      // RLS belt-and-suspenders
    if (error) _throw(error, 'updateProduct');
  }

  async function deleteProduct(id) {
    const uid = Auth.getUserId();
    const { error } = await _supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) _throw(error, 'deleteProduct');
  }

  // Decrease stock by qty (used after order creation)
  async function decreaseStock(productId, qty) {
    const uid = Auth.getUserId();
    // Use Supabase RPC or fetch-then-update
    const { data: current, error: fetchErr } = await _supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .eq('user_id', uid)
      .single();
    if (fetchErr) _throw(fetchErr, 'decreaseStock:fetch');

    const newStock = Math.max(0, (current.stock || 0) - qty);
    const { error: updateErr } = await _supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId)
      .eq('user_id', uid);
    if (updateErr) _throw(updateErr, 'decreaseStock:update');
  }

  // ─── Orders ───────────────────────────────────────────────────

  async function getOrders() {
    const uid = Auth.getUserId();
    const { data, error } = await _supabase
      .from('orders')
      .select('*')
      .eq('user_id', uid)
      .order('order_date', { ascending: false });
    if (error) _throw(error, 'getOrders');
    return (data || []).map(_orderToJS);
  }

  // Generates sequential ID like ORD-042 scoped per seller
  async function _nextOrderId() {
    const uid = Auth.getUserId();
    const { count, error } = await _supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);
    if (error) _throw(error, '_nextOrderId');
    return 'ORD-' + String((count || 0) + 1).padStart(3, '0');
  }

  async function addOrder(o) {
    const uid  = Auth.getUserId();
    const id   = await _nextOrderId();
    const date = new Date().toISOString().slice(0, 10);

    const row = {
      ..._orderToDB({ ...o, id, date }),
      user_id: uid,
    };

    const { data, error } = await _supabase
      .from('orders')
      .insert(row)
      .select()
      .single();
    if (error) _throw(error, 'addOrder');

    // Decrease stock for each item (fire-and-forget in parallel)
    await Promise.all(
      (o.items || []).map(item => decreaseStock(item.productId, item.qty))
    );

    // Update customer stats
    await _updateCustomerAfterOrder({ ...o, id, date });

    return _orderToJS(data);
  }

  async function updateOrder(id, updates) {
    const uid = Auth.getUserId();
    // Build a partial DB object — only pass what's changed
    const partial = {};
    if (updates.status  !== undefined) partial.status  = updates.status;
    if (updates.payment !== undefined) partial.payment = updates.payment;
    if (updates.trackingId      !== undefined) partial.tracking_id      = updates.trackingId;
    if (updates.deliveryPartner !== undefined) partial.delivery_partner = updates.deliveryPartner;
    if (updates.notes   !== undefined) partial.notes   = updates.notes;

    const { error } = await _supabase
      .from('orders')
      .update(partial)
      .eq('id', id)
      .eq('user_id', uid);
    if (error) _throw(error, 'updateOrder');
  }

  async function deleteOrder(id) {
    const uid = Auth.getUserId();
    const { error } = await _supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) _throw(error, 'deleteOrder');
  }

  // ─── Customers ────────────────────────────────────────────────

  async function getCustomers() {
    const uid = Auth.getUserId();
    const { data, error } = await _supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });
    if (error) _throw(error, 'getCustomers');
    return (data || []).map(_customerToJS);
  }

  async function addCustomer(c) {
    const uid = Auth.getUserId();
    const row = {
      ..._customerToDB(c),
      user_id:      uid,
      total_orders: 0,
      total_spent:  0,
      first_order:  null,
      last_order:   null,
    };
    const { data, error } = await _supabase
      .from('customers')
      .insert(row)
      .select()
      .single();
    if (error) _throw(error, 'addCustomer');
    return _customerToJS(data);
  }

  async function updateCustomer(id, updates) {
    const uid = Auth.getUserId();
    const { error } = await _supabase
      .from('customers')
      .update(_customerToDB(updates))
      .eq('id', id)
      .eq('user_id', uid);
    if (error) _throw(error, 'updateCustomer');
  }

  // Find existing by instagram handle or name, or create new
  async function findOrCreateCustomer(name, instagram) {
    const uid = Auth.getUserId();
    // Try to find by instagram first, then by name
    let query = _supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid);

    if (instagram) {
      query = query.eq('instagram', instagram);
    } else {
      query = query.eq('name', name);
    }

    const { data, error } = await query.maybeSingle();
    if (error) _throw(error, 'findOrCreateCustomer:find');
    if (data) return _customerToJS(data);

    // Not found — create
    return await addCustomer({ name, instagram: instagram || '', phone: '', email: '', city: '' });
  }

  // Called internally after addOrder
  async function _updateCustomerAfterOrder(order) {
    const uid = Auth.getUserId();
    if (!order.customerId) return;

    // Fetch current customer stats
    const { data: cust, error } = await _supabase
      .from('customers')
      .select('total_orders, total_spent, first_order')
      .eq('id', order.customerId)
      .eq('user_id', uid)
      .single();
    if (error) { console.warn('[SF] _updateCustomerAfterOrder fetch failed', error); return; }

    const today = new Date().toISOString().slice(0, 10);
    const { error: updateErr } = await _supabase
      .from('customers')
      .update({
        total_orders: (cust.total_orders || 0) + 1,
        total_spent:  Number(cust.total_spent || 0) + Number(order.total || 0),
        last_order:   today,
        first_order:  cust.first_order || today,
      })
      .eq('id', order.customerId)
      .eq('user_id', uid);
    if (updateErr) console.warn('[SF] _updateCustomerAfterOrder update failed', updateErr);
  }

  // ─── Analytics ────────────────────────────────────────────────
  // Computed from live order data — no separate table needed.

  async function getAnalytics() {
    const orders = await getOrders();

    // Build monthly revenue for last 12 months
    const now       = new Date();
    const months    = [];
    const revByMonth = {};
    const ordByMonth = {};

    for (let i = 11; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      months.push(label);
      revByMonth[key] = 0;
      ordByMonth[key] = 0;
    }

    orders.forEach(o => {
      const key = (o.date || '').slice(0, 7);
      if (revByMonth[key] !== undefined) {
        if (o.payment === 'paid') revByMonth[key] += o.total;
        ordByMonth[key]++;
      }
    });

    // Category distribution from products
    const products  = await getProducts();
    const catTotals = {};
    products.forEach(p => {
      catTotals[p.category] = (catTotals[p.category] || 0) + 1;
    });
    const total = Object.values(catTotals).reduce((s, v) => s + v, 0) || 1;
    const catLabels = Object.keys(catTotals);
    const catData   = catLabels.map(k => Math.round((catTotals[k] / total) * 100));

    return {
      months,
      monthlyRevenue: Object.values(revByMonth),
      monthlyOrders:  Object.values(ordByMonth),
      topCategories: {
        labels: catLabels.length ? catLabels : ['No data'],
        data:   catData.length  ? catData   : [100],
      },
    };
  }

  // ─── Dashboard Stats ──────────────────────────────────────────
  // Returns a plain object — pages.js can call this once and render

  async function getDashStats() {
    const [orders, products, customers] = await Promise.all([
      getOrders(), getProducts(), getCustomers()
    ]);

    const month       = new Date().toISOString().slice(0, 7);
    const monthOrders = orders.filter(o => (o.date || '').startsWith(month));
    const revenue     = monthOrders.filter(o => o.payment === 'paid').reduce((s, o) => s + o.total, 0);
    const pending     = orders.filter(o => o.payment === 'pending').length;
    const lowStock    = products.filter(p => p.stock <= p.lowStockThreshold).length;
    const repeatCusts = customers.filter(c => c.totalOrders >= 2).length;
    const allRevenue  = orders.filter(o => o.payment === 'paid').reduce((s, o) => s + o.total, 0);

    return {
      totalRevenue:    revenue,
      totalOrders:     monthOrders.length,
      pendingPayments: pending,
      lowStockCount:   lowStock,
      repeatCustomers: repeatCusts,
      totalCustomers:  customers.length,
      allRevenue,
      // Pass through raw lists so callers don't re-fetch
      _orders:    orders,
      _products:  products,
      _customers: customers,
    };
  }

  // ─── Utilities (sync — no DB needed) ─────────────────────────

  // ─── Reset Account ────────────────────────────────────────────────────────
  // Deletes all orders, customers, and products belonging to this user from
  // Supabase. The user's profile (name, store, settings) is preserved.
  // Runs each table delete sequentially so if one fails the error surfaces
  // clearly. Safe to retry — repeated calls just delete zero rows.
  //
  async function resetAccount() {
    const uid = Auth.getUserId();
    if (!uid) throw new Error('Not authenticated');

    // Delete in dependency order: orders first, then customers, then products
    // (orders reference customers; deleting customers first could cause FK issues
    //  depending on your Supabase cascade config)
    const tables = ['orders', 'customers', 'products'];
    for (const table of tables) {
      const { error } = await _supabase
        .from(table)
        .delete()
        .eq('user_id', uid);
      if (error) _throw(error, `resetAccount:${table}`);
    }
  }

  // ─── Delete Account ───────────────────────────────────────────────────────
  // 1. Wipes all user data (calls resetAccount)
  // 2. Deletes the profile row
  // 3. Calls Supabase's auth.admin.deleteUser via an RPC function
  //    (requires a Postgres function `delete_own_account()` — see note below)
  //
  // ── Supabase setup required ───────────────────────────────────────────────
  // Run this once in your Supabase SQL editor:
  //
  //   create or replace function delete_own_account()
  //   returns void language plpgsql security definer as $$
  //   begin
  //     delete from auth.users where id = auth.uid();
  //   end;
  //   $$;
  //
  // This is necessary because the client-side JS SDK cannot delete auth.users
  // rows directly — only a security-definer Postgres function can do it.
  //
  async function deleteAccount() {
    const uid = Auth.getUserId();
    if (!uid) throw new Error('Not authenticated');

    // Step 1: wipe all business data
    await resetAccount();

    // Step 2: delete the profile row
    const { error: profileErr } = await _supabase
      .from('profiles')
      .delete()
      .eq('id', uid);
    if (profileErr) _throw(profileErr, 'deleteAccount:profile');

    // Step 3: delete the auth.users row via RPC
    const { error: rpcErr } = await _supabase.rpc('delete_own_account');
    if (rpcErr) _throw(rpcErr, 'deleteAccount:auth');

    // Step 4: sign out locally (session is now invalid anyway)
    await Auth.signOut();
  }

  function formatCurrency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function initials(name) {
    return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  // ─── Public API ───────────────────────────────────────────────
  return {
    // User
    getUser, saveUser,
    // Products
    getProducts, addProduct, updateProduct, deleteProduct, decreaseStock,
    // Orders
    getOrders, addOrder, updateOrder, deleteOrder,
    // Customers
    getCustomers, addCustomer, updateCustomer, findOrCreateCustomer,
    // Analytics + Stats
    getAnalytics, getDashStats,
    // Account management
    resetAccount, deleteAccount,
    // Utilities
    formatCurrency, formatDate, initials,
  };
})();
