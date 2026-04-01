// SellerFlow — Data Module
// Manages all app data: initial seed data + localStorage persistence
// ================================================================

const SF = (() => {

  // ─── Initial Seed Data ────────────────────────────
  const SEED = {
    user: {
      name: 'Priya Sharma',
      email: 'priya@sellerflow.in',
      store: 'Priya Boutique',
      instagram: '@priyaboutique',
      phone: '+91 98765 43210',
      upiId: 'priya@upi',
    },
    products: [
      { id: 'P001', name: 'Silk Saree - Red', sku: 'SAR-RED-001', category: 'Sarees', price: 2499, stock: 12, lowStockThreshold: 5, emoji: '🧣' },
      { id: 'P002', name: 'Cotton Kurti Set', sku: 'KUR-COT-002', category: 'Kurtis', price: 899, stock: 3, lowStockThreshold: 5, emoji: '👗' },
      { id: 'P003', name: 'Lehenga Choli - Blue', sku: 'LEH-BLU-003', category: 'Lehengas', price: 4999, stock: 7, lowStockThreshold: 3, emoji: '👘' },
      { id: 'P004', name: 'Palazzo Pants - Black', sku: 'PAL-BLK-004', category: 'Bottoms', price: 599, stock: 2, lowStockThreshold: 5, emoji: '👖' },
      { id: 'P005', name: 'Embroidered Dupatta', sku: 'DUP-EMB-005', category: 'Accessories', price: 349, stock: 18, lowStockThreshold: 5, emoji: '🪡' },
      { id: 'P006', name: 'Anarkali Suit - Pink', sku: 'ANK-PNK-006', category: 'Suits', price: 1799, stock: 6, lowStockThreshold: 4, emoji: '👗' },
      { id: 'P007', name: 'Banarasi Silk Saree', sku: 'SAR-BAN-007', category: 'Sarees', price: 6999, stock: 4, lowStockThreshold: 3, emoji: '🧣' },
      { id: 'P008', name: 'Crop Top + Skirt Set', sku: 'SET-CRP-008', category: 'Sets', price: 1299, stock: 9, lowStockThreshold: 4, emoji: '👙' },
    ],
    customers: [
      { id: 'C001', name: 'Anjali Mehta',   instagram: '@anjali_m',   phone: '+91 99001 12345', email: 'anjali@email.com',   city: 'Mumbai',    totalOrders: 4, totalSpent: 12340, firstOrder: '2024-08-10', lastOrder: '2025-02-15' },
      { id: 'C002', name: 'Ritu Agarwal',   instagram: '@ritu_ag',    phone: '+91 98112 54321', email: 'ritu@email.com',     city: 'Delhi',     totalOrders: 7, totalSpent: 28900, firstOrder: '2024-06-05', lastOrder: '2025-03-01' },
      { id: 'C003', name: 'Sneha Patel',    instagram: '@snehap',     phone: '+91 97223 67890', email: 'sneha@email.com',    city: 'Ahmedabad', totalOrders: 2, totalSpent: 6499,  firstOrder: '2024-11-20', lastOrder: '2025-01-08' },
      { id: 'C004', name: 'Kavita Joshi',   instagram: '@kavita.j',   phone: '+91 96334 98765', email: 'kavita@email.com',   city: 'Jaipur',    totalOrders: 5, totalSpent: 18750, firstOrder: '2024-07-15', lastOrder: '2025-03-10' },
      { id: 'C005', name: 'Meera Singh',    instagram: '@meerasingh', phone: '+91 95445 11111', email: 'meera@email.com',    city: 'Bangalore', totalOrders: 1, totalSpent: 4999,  firstOrder: '2025-01-05', lastOrder: '2025-01-05' },
      { id: 'C006', name: 'Pooja Verma',    instagram: '@pooja_v',    phone: '+91 94556 22222', email: 'pooja@email.com',    city: 'Pune',      totalOrders: 3, totalSpent: 9870,  firstOrder: '2024-09-20', lastOrder: '2025-02-20' },
      { id: 'C007', name: 'Divya Nair',     instagram: '@divyanair',  phone: '+91 93667 33333', email: 'divya@email.com',    city: 'Chennai',   totalOrders: 6, totalSpent: 22400, firstOrder: '2024-05-10', lastOrder: '2025-03-05' },
      { id: 'C008', name: 'Shalini Gupta',  instagram: '@shalini_g',  phone: '+91 92778 44444', email: 'shalini@email.com',  city: 'Lucknow',   totalOrders: 2, totalSpent: 7800,  firstOrder: '2024-12-01', lastOrder: '2025-02-28' },
    ],
    orders: [
      { id: 'ORD-001', customerId: 'C002', customerName: 'Ritu Agarwal', items: [{productId:'P007', name:'Banarasi Silk Saree', qty:1, price:6999}], total:6999, status:'delivered', payment:'paid', date:'2025-03-01', notes:'Express delivery requested' },
      { id: 'ORD-002', customerId: 'C004', customerName: 'Kavita Joshi',  items: [{productId:'P001', name:'Silk Saree - Red', qty:2, price:2499}], total:4998, status:'shipped', payment:'paid', date:'2025-03-05', notes:'' },
      { id: 'ORD-003', customerId: 'C001', customerName: 'Anjali Mehta',  items: [{productId:'P006', name:'Anarkali Suit - Pink', qty:1, price:1799},{productId:'P005', name:'Embroidered Dupatta', qty:1, price:349}], total:2148, status:'processing', payment:'pending', date:'2025-03-08', notes:'Gift wrap please' },
      { id: 'ORD-004', customerId: 'C007', customerName: 'Divya Nair',    items: [{productId:'P003', name:'Lehenga Choli - Blue', qty:1, price:4999}], total:4999, status:'delivered', payment:'paid', date:'2025-03-02', notes:'' },
      { id: 'ORD-005', customerId: 'C003', customerName: 'Sneha Patel',   items: [{productId:'P002', name:'Cotton Kurti Set', qty:2, price:899}], total:1798, status:'processing', payment:'pending', date:'2025-03-10', notes:'Size L' },
      { id: 'ORD-006', customerId: 'C006', customerName: 'Pooja Verma',   items: [{productId:'P008', name:'Crop Top + Skirt Set', qty:1, price:1299}], total:1299, status:'shipped', payment:'paid', date:'2025-03-07', notes:'' },
      { id: 'ORD-007', customerId: 'C005', customerName: 'Meera Singh',   items: [{productId:'P003', name:'Lehenga Choli - Blue', qty:1, price:4999}], total:4999, status:'cancelled', payment:'refunded', date:'2025-02-28', notes:'Wrong size ordered' },
      { id: 'ORD-008', customerId: 'C008', customerName: 'Shalini Gupta', items: [{productId:'P004', name:'Palazzo Pants - Black', qty:1, price:599},{productId:'P002', name:'Cotton Kurti Set', qty:1, price:899}], total:1498, status:'processing', payment:'pending', date:'2025-03-09', notes:'' },
      { id: 'ORD-009', customerId: 'C002', customerName: 'Ritu Agarwal',  items: [{productId:'P001', name:'Silk Saree - Red', qty:1, price:2499}], total:2499, status:'delivered', payment:'paid', date:'2025-02-15', notes:'' },
      { id: 'ORD-010', customerId: 'C007', customerName: 'Divya Nair',    items: [{productId:'P006', name:'Anarkali Suit - Pink', qty:2, price:1799}], total:3598, status:'shipped', payment:'paid', date:'2025-03-04', notes:'Two different sizes' },
    ],
    analytics: {
      monthlyRevenue: [42000, 38000, 51000, 47000, 62000, 58000, 71000, 65000, 80000, 74000, 91000, 88000],
      monthlyOrders:  [22, 18, 25, 21, 31, 28, 34, 30, 38, 35, 44, 42],
      months: ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
      topCategories: {
        labels: ['Sarees', 'Lehengas', 'Kurtis', 'Suits', 'Accessories', 'Sets'],
        data:   [38, 22, 17, 12, 7, 4],
      }
    }
  };

  // ─── Storage Keys ─────────────────────────────────
  const KEYS = {
    user:      'sf_user',
    products:  'sf_products',
    customers: 'sf_customers',
    orders:    'sf_orders',
    analytics: 'sf_analytics',
    seeded:    'sf_seeded',
  };

  // ─── Init: Seed if first run ──────────────────────
  function init() {
    if (!localStorage.getItem(KEYS.seeded)) {
      Object.entries(SEED).forEach(([key, val]) => {
        localStorage.setItem(KEYS[key], JSON.stringify(val));
      });
      localStorage.setItem(KEYS.seeded, '1');
    }
  }

  // ─── Generic get/set/save ─────────────────────────
  function get(key) {
    try {
      return JSON.parse(localStorage.getItem(KEYS[key]));
    } catch { return null; }
  }
  function save(key, data) {
    localStorage.setItem(KEYS[key], JSON.stringify(data));
  }

  // ─── User ─────────────────────────────────────────
  function getUser()       { return get('user') || SEED.user; }
  function saveUser(data)  { save('user', data); }

  // ─── Products ─────────────────────────────────────
  function getProducts()   { return get('products') || []; }
  function saveProducts(d) { save('products', d); }

  function addProduct(p) {
    const list = getProducts();
    p.id = 'P' + String(Date.now()).slice(-5);
    list.push(p);
    saveProducts(list);
    return p;
  }
  function updateProduct(id, updates) {
    const list = getProducts().map(p => p.id === id ? {...p, ...updates} : p);
    saveProducts(list);
  }
  function deleteProduct(id) {
    saveProducts(getProducts().filter(p => p.id !== id));
  }
  function decreaseStock(productId, qty) {
    const list = getProducts().map(p => {
      if (p.id === productId) {
        return {...p, stock: Math.max(0, p.stock - qty)};
      }
      return p;
    });
    saveProducts(list);
  }

  // ─── Orders ──────────────────────────────────────
  function getOrders()   { return get('orders') || []; }
  function saveOrders(d) { save('orders', d); }

  function addOrder(o) {
    const list = getOrders();
    o.id = 'ORD-' + String(list.length + 1).padStart(3, '0');
    o.date = new Date().toISOString().slice(0, 10);
    list.unshift(o);
    saveOrders(list);
    // Decrease stock
    o.items.forEach(item => decreaseStock(item.productId, item.qty));
    // Update customer
    updateCustomerAfterOrder(o);
    return o;
  }
  function updateOrder(id, updates) {
    const list = getOrders().map(o => o.id === id ? {...o, ...updates} : o);
    saveOrders(list);
  }
  function deleteOrder(id) {
    saveOrders(getOrders().filter(o => o.id !== id));
  }

  // ─── Customers ───────────────────────────────────
  function getCustomers()   { return get('customers') || []; }
  function saveCustomers(d) { save('customers', d); }

  function addCustomer(c) {
    const list = getCustomers();
    c.id = 'C' + String(Date.now()).slice(-5);
    c.totalOrders = 0;
    c.totalSpent = 0;
    c.firstOrder = null;
    c.lastOrder = null;
    list.push(c);
    saveCustomers(list);
    return c;
  }
  function updateCustomer(id, updates) {
    const list = getCustomers().map(c => c.id === id ? {...c, ...updates} : c);
    saveCustomers(list);
  }
  function findOrCreateCustomer(name, instagram) {
    const list = getCustomers();
    const existing = list.find(c => c.instagram === instagram || c.name === name);
    if (existing) return existing;
    const nc = { name, instagram, phone: '', email: '', city: '', firstOrder: null, lastOrder: null };
    return addCustomer(nc);
  }
  function updateCustomerAfterOrder(order) {
    const cust = getCustomers().find(c => c.id === order.customerId);
    if (!cust) return;
    const today = new Date().toISOString().slice(0,10);
    updateCustomer(order.customerId, {
      totalOrders: (cust.totalOrders || 0) + 1,
      totalSpent:  (cust.totalSpent  || 0) + order.total,
      lastOrder:   today,
      firstOrder:  cust.firstOrder || today,
    });
  }

  // ─── Analytics ────────────────────────────────────
  function getAnalytics() { return get('analytics') || SEED.analytics; }

  // ─── Dashboard Stats ──────────────────────────────
  function getDashStats() {
    const orders    = getOrders();
    const products  = getProducts();
    const customers = getCustomers();
    const today     = new Date().toISOString().slice(0,10);
    const month     = today.slice(0,7);

    const monthOrders = orders.filter(o => o.date && o.date.startsWith(month));
    const revenue     = monthOrders.filter(o => o.payment === 'paid').reduce((s,o) => s + o.total, 0);
    const pending     = orders.filter(o => o.payment === 'pending').length;
    const lowStock    = products.filter(p => p.stock <= p.lowStockThreshold).length;
    const repeatCusts = customers.filter(c => c.totalOrders >= 2).length;

    return {
      totalRevenue: revenue,
      totalOrders:  monthOrders.length,
      pendingPayments: pending,
      lowStockCount: lowStock,
      repeatCustomers: repeatCusts,
      totalCustomers: customers.length,
      allRevenue: orders.filter(o => o.payment === 'paid').reduce((s,o) => s + o.total, 0),
    };
  }

  // ─── Utils ───────────────────────────────────────
  function formatCurrency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }
  function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  }
  function initials(name) {
    return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  }
  function generateId(prefix) {
    return prefix + String(Date.now()).slice(-6);
  }

  // ─── Reset (for dev) ──────────────────────────────
  function reset() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    init();
  }

  // Public API
  return {
    init, reset,
    getUser, saveUser,
    getProducts, addProduct, updateProduct, deleteProduct,
    getOrders, addOrder, updateOrder, deleteOrder,
    getCustomers, addCustomer, updateCustomer, findOrCreateCustomer,
    getAnalytics, getDashStats,
    formatCurrency, formatDate, initials,
  };
})();
