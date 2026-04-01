// SellerFlow — Main App Entry Point
// Initializes the app, handles login, wires all events
// ================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ─── Init Data ────────────────────────────────────
  SF.init();

  // ─── Login Flow ───────────────────────────────────
  const loginPage = document.getElementById('login-page');
  const appEl     = document.getElementById('app');

  function showApp() {
    loginPage.style.display = 'none';
    appEl.classList.add('active');
    const user = SF.getUser();
    document.getElementById('sidebar-user-name').textContent  = user.name || 'Seller';
    document.getElementById('sidebar-user-store').textContent = user.store || 'My Store';
    document.getElementById('sidebar-avatar-initials').textContent = SF.initials(user.name);
    UI.updateBadges();
    UI.navigate('dashboard');
  }

  document.getElementById('login-btn').addEventListener('click', () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
      UI.toast('Please enter your credentials', 'error');
      return;
    }
    // Demo: any credentials work
    showApp();
    UI.toast('Welcome back! 👋', 'success');
  });

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('demo-login').addEventListener('click', () => {
    document.getElementById('login-email').value    = 'priya@sellerflow.in';
    document.getElementById('login-password').value = 'demo123';
    document.getElementById('login-btn').click();
  });

  // ─── Sidebar Navigation ───────────────────────────
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => UI.navigate(item.dataset.page));
  });

  // Mobile sidebar
  document.getElementById('mobile-menu-btn').addEventListener('click', UI.openMobileSidebar);
  document.querySelector('.sidebar-overlay').addEventListener('click', UI.closeMobileSidebar);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    appEl.classList.remove('active');
    loginPage.style.display = '';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    UI.toast('Logged out successfully', 'info');
  });

  // ─── Topbar Search ────────────────────────────────
  const topbarSearch = document.getElementById('topbar-search-input');
  topbarSearch.addEventListener('input', UI.debounce(() => {
    // Route search to active page
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage === 'products')  Pages.products(topbarSearch.value);
    if (activePage === 'customers') Pages.customers(topbarSearch.value);
  }, 200));

  // ─── Products Page Events ─────────────────────────
  document.getElementById('add-product-btn').addEventListener('click', Modals.openAddProduct);

  document.getElementById('product-search').addEventListener('input', UI.debounce((e) => {
    Pages.products(e.target.value);
  }, 200));

  document.getElementById('product-cat-filter').addEventListener('change', (e) => {
    Pages.products(undefined, e.target.value);
  });

  document.getElementById('save-product-btn').addEventListener('click', Modals.saveProduct);
  document.getElementById('cancel-product-btn').addEventListener('click', () => UI.closeModal('modal-product'));

  // ─── Orders Page Events ───────────────────────────
  document.getElementById('create-order-btn').addEventListener('click', Modals.openCreateOrder);

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => Pages.orders(tab.dataset.filter));
  });

  document.getElementById('order-add-item-btn').addEventListener('click', Modals.addOrderItem);
  document.getElementById('save-order-btn').addEventListener('click', Modals.saveOrder);
  document.getElementById('cancel-order-btn').addEventListener('click', () => UI.closeModal('modal-order'));

  document.getElementById('order-customer-select').addEventListener('change', Modals.handleCustomerSelectChange);

  // ─── Customers Page Events ────────────────────────
  document.getElementById('customer-search').addEventListener('input', UI.debounce((e) => {
    Pages.customers(e.target.value);
  }, 200));

  // ─── Settings Save ────────────────────────────────
  document.getElementById('save-settings-btn').addEventListener('click', () => {
    const updates = {
      name:      document.getElementById('settings-name').value.trim(),
      store:     document.getElementById('settings-store').value.trim(),
      instagram: document.getElementById('settings-instagram').value.trim(),
      email:     document.getElementById('settings-email').value.trim(),
      phone:     document.getElementById('settings-phone').value.trim(),
      upiId:     document.getElementById('settings-upi').value.trim(),
    };
    SF.saveUser({ ...SF.getUser(), ...updates });
    // Update sidebar
    document.getElementById('sidebar-user-name').textContent  = updates.name || 'Seller';
    document.getElementById('sidebar-user-store').textContent = updates.store || 'My Store';
    document.getElementById('sidebar-avatar-initials').textContent = SF.initials(updates.name);
    UI.toast('Settings saved!', 'success');
  });

  document.getElementById('reset-data-btn').addEventListener('click', () => {
    if (!UI.confirm('Reset all data to demo data? This cannot be undone.')) return;
    SF.reset();
    UI.toast('Data reset to demo data', 'info');
    UI.navigate('dashboard');
  });

  // ─── Quick Actions ────────────────────────────────
  document.getElementById('qa-new-order').addEventListener('click', () => {
    UI.navigate('orders');
    setTimeout(Modals.openCreateOrder, 100);
  });
  document.getElementById('qa-add-product').addEventListener('click', () => {
    UI.navigate('products');
    setTimeout(Modals.openAddProduct, 100);
  });
  document.getElementById('qa-invoices').addEventListener('click', () => {
    UI.navigate('billing');
  });
  document.getElementById('qa-customers').addEventListener('click', () => {
    UI.navigate('customers');
  });

  // ─── Close modal buttons ──────────────────────────
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeModal(btn.dataset.closeModal));
  });

  // ─── Escape key closes modals ─────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') UI.closeAllModals();
  });

  // ─── Simulate live analytics update (fake) ────────
  setInterval(() => {
    const statsEl = document.getElementById('stat-revenue');
    if (statsEl && document.getElementById('page-dashboard').classList.contains('active')) {
      // Minor flicker effect to simulate live updates
      statsEl.style.opacity = '0.7';
      setTimeout(() => { statsEl.style.opacity = '1'; }, 300);
    }
  }, 8000);

});