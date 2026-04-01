// SellerFlow — Main App Entry Point (Supabase Edition)
// Handles: auth init, login/signup forms, session restore,
// sidebar wiring, topbar events, settings save.
// ================================================================

document.addEventListener('DOMContentLoaded', async () => {

  // ─── 1. Init Supabase session ──────────────────────────────────
  UI.showLoading('Loading SellerFlow…');

  const existingUser = await Auth.init();

  if (existingUser) {
    // Returning user — restore session immediately
    await _bootApp();
  } else {
    // No session — show login screen
    _showAuthScreen('login');
  }

  UI.hideLoading();

  // ─── Listen for programmatic sign-out ─────────────────────────
  window.addEventListener('sf:signed-out', () => {
    document.getElementById('app').classList.remove('active');
    _showAuthScreen('login');
    UI.toast('You have been signed out.', 'info');
  });


  // ══════════════════════════════════════════════════════════════
  //  AUTH SCREEN SWITCHING
  // ══════════════════════════════════════════════════════════════

  function _showAuthScreen(tab) {
    document.getElementById('app').classList.remove('active');
    const loginPage = document.getElementById('login-page');
    loginPage.style.display = '';

    // Switch between login / signup tabs
    document.getElementById('auth-login-tab').classList.toggle('active', tab === 'login');
    document.getElementById('auth-signup-tab').classList.toggle('active', tab === 'signup');
    document.getElementById('auth-login-form').style.display  = tab === 'login'  ? '' : 'none';
    document.getElementById('auth-signup-form').style.display = tab === 'signup' ? '' : 'none';
  }

  // Tab switching
  document.getElementById('auth-login-tab').addEventListener('click', () => _showAuthScreen('login'));
  document.getElementById('auth-signup-tab').addEventListener('click', () => _showAuthScreen('signup'));

  // "Switch to signup / login" links inside form hints
  document.getElementById('switch-to-signup').addEventListener('click', () => _showAuthScreen('signup'));
  document.getElementById('switch-to-login').addEventListener('click',  () => _showAuthScreen('login'));


  // ══════════════════════════════════════════════════════════════
  //  LOGIN
  // ══════════════════════════════════════════════════════════════

  document.getElementById('login-btn').addEventListener('click', _handleLogin);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') _handleLogin();
  });

  document.getElementById('demo-login').addEventListener('click', () => {
    document.getElementById('login-email').value    = 'demo@sellerflow.in';
    document.getElementById('login-password').value = 'demo1234';
    _handleLogin();
  });

  async function _handleLogin() {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
      UI.toast('Please enter your email and password.', 'error');
      return;
    }

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      await Auth.signIn(email, password);
      await _bootApp();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
        UI.toast('Incorrect email or password.', 'error');
      } else if (msg.includes('Email not confirmed')) {
        UI.toast('Please confirm your email address first.', 'warn');
      } else {
        UI.toast(msg || 'Login failed. Please try again.', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In →';
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  SIGN UP
  // ══════════════════════════════════════════════════════════════

  document.getElementById('signup-btn').addEventListener('click', _handleSignUp);
  document.getElementById('signup-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') _handleSignUp();
  });

  async function _handleSignUp() {
    const name     = document.getElementById('signup-name').value.trim();
    const store    = document.getElementById('signup-store').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!name || !store || !email || !password) {
      UI.toast('Please fill in all fields.', 'error');
      return;
    }
    if (password.length < 8) {
      UI.toast('Password must be at least 8 characters.', 'error');
      return;
    }

    const btn = document.getElementById('signup-btn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const { session } = await Auth.signUp(email, password, name, store);

      if (!session) {
        // Email confirmation enabled in Supabase — user must verify first
        UI.toast('Account created! Please check your email to confirm your account.', 'success');
        _showAuthScreen('login');
      } else {
        // Auto-confirmed (email confirmation disabled in Supabase dashboard)
        await _bootApp();
        UI.toast(`Welcome to SellerFlow, ${name}! 🎉`, 'success');
      }
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        UI.toast('An account with this email already exists. Please log in.', 'warn');
      } else {
        UI.toast(msg || 'Sign up failed. Please try again.', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account →';
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  APP BOOT (after successful auth)
  // ══════════════════════════════════════════════════════════════

  async function _bootApp() {
    // Hide login, show app shell
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').classList.add('active');

    // Populate sidebar user info
    const user = await SF.getUser();
    document.getElementById('sidebar-user-name').textContent =
      user?.name || Auth.getUser()?.email?.split('@')[0] || 'Seller';
    document.getElementById('sidebar-user-store').textContent = user?.store || 'My Store';
    document.getElementById('sidebar-avatar-initials').textContent =
      SF.initials(user?.name || Auth.getUser()?.email || 'S');

    // Badges (async, non-blocking)
    UI.updateBadges();

    // Navigate to dashboard
    await UI.navigate('dashboard');
  }


  // ══════════════════════════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════════════════════════

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await Auth.signOut();
      // sf:signed-out event handles UI cleanup
    } catch (err) {
      UI.toast(err.message || 'Logout failed', 'error');
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  SIDEBAR NAVIGATION
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => UI.navigate(item.dataset.page));
  });

  document.getElementById('mobile-menu-btn').addEventListener('click', UI.openMobileSidebar);
  document.querySelector('.sidebar-overlay').addEventListener('click', UI.closeMobileSidebar);


  // ══════════════════════════════════════════════════════════════
  //  TOPBAR SEARCH
  // ══════════════════════════════════════════════════════════════

  const topbarSearch = document.getElementById('topbar-search-input');
  topbarSearch.addEventListener('input', UI.debounce(async () => {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage === 'products')  await Pages.products(topbarSearch.value);
    if (activePage === 'customers') await Pages.customers(topbarSearch.value);
  }, 250));


  // ══════════════════════════════════════════════════════════════
  //  PRODUCTS PAGE
  // ══════════════════════════════════════════════════════════════

  document.getElementById('add-product-btn').addEventListener('click', Modals.openAddProduct);
  document.getElementById('save-product-btn').addEventListener('click', Modals.saveProduct);
  document.getElementById('cancel-product-btn').addEventListener('click', () => UI.closeModal('modal-product'));

  document.getElementById('product-search').addEventListener('input', UI.debounce(async e => {
    await Pages.products(e.target.value);
  }, 250));

  document.getElementById('product-cat-filter').addEventListener('change', async e => {
    await Pages.products(undefined, e.target.value);
  });


  // ══════════════════════════════════════════════════════════════
  //  ORDERS PAGE
  // ══════════════════════════════════════════════════════════════

  document.getElementById('create-order-btn').addEventListener('click', Modals.openCreateOrder);
  document.getElementById('order-add-item-btn').addEventListener('click', Modals.addOrderItem);
  document.getElementById('save-order-btn').addEventListener('click', Modals.saveOrder);
  document.getElementById('cancel-order-btn').addEventListener('click', () => UI.closeModal('modal-order'));
  document.getElementById('order-customer-select').addEventListener('change', Modals.handleCustomerSelectChange);

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => Pages.orders(tab.dataset.filter));
  });


  // ══════════════════════════════════════════════════════════════
  //  CUSTOMERS PAGE
  // ══════════════════════════════════════════════════════════════

  document.getElementById('customer-search').addEventListener('input', UI.debounce(async e => {
    await Pages.customers(e.target.value);
  }, 250));


  // ══════════════════════════════════════════════════════════════
  //  SETTINGS PAGE
  // ══════════════════════════════════════════════════════════════

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const autoEmailToggle = document.getElementById('settings-auto-email');
    const updates = {
      name:      document.getElementById('settings-name').value.trim(),
      store:     document.getElementById('settings-store').value.trim(),
      instagram: document.getElementById('settings-instagram').value.trim(),
      email:     document.getElementById('settings-email').value.trim(),
      phone:     document.getElementById('settings-phone').value.trim(),
      upiId:     document.getElementById('settings-upi').value.trim(),
      autoEmail: autoEmailToggle ? autoEmailToggle.checked : false,
    };

    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await SF.saveUser(updates);
      // Update sidebar display name
      document.getElementById('sidebar-user-name').textContent  = updates.name  || 'Seller';
      document.getElementById('sidebar-user-store').textContent = updates.store || 'My Store';
      document.getElementById('sidebar-avatar-initials').textContent = SF.initials(updates.name);
      UI.toast('Settings saved!', 'success');
    } catch (err) {
      UI.toast(err.message || 'Failed to save settings', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Changes';
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  DANGER ZONE — Reset Account Data
  // ══════════════════════════════════════════════════════════════
  // Deletes all orders, customers, and products from Supabase.
  // Profile and login are preserved. Requires two confirmations.

  document.getElementById('reset-account-btn').addEventListener('click', async () => {
    // First gate — make them read the warning
    const first = window.confirm(
      '⚠️ Reset Account Data?\n\n' +
      'This will permanently delete ALL your:\n' +
      '  • Orders\n  • Customers\n  • Products\n  • Invoices\n\n' +
      'Your profile and login will be kept.\n\n' +
      'Click OK to continue to the final confirmation.'
    );
    if (!first) return;

    // Second gate — explicit type-to-confirm so it cannot be accidental
    const typed = window.prompt(
      'Type  RESET  in capital letters to confirm data deletion.\n\n' +
      'This action cannot be undone.'
    );
    if ((typed || '').trim() !== 'RESET') {
      if (typed !== null) UI.toast('Reset cancelled — text did not match', 'info');
      return;
    }

    const btn = document.getElementById('reset-account-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Resetting…';

    try {
      await SF.resetAccount();
      UI.toast('Account data reset. All orders, customers & products deleted.', 'success');
      // Refresh the current page so empty states show immediately
      await UI.navigate('dashboard');
      UI.updateBadges();
    } catch (err) {
      console.error('[SellerFlow] resetAccount failed:', err);
      UI.toast(err.message || 'Reset failed — see browser Console for details', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🗑️ Reset Data';
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  DANGER ZONE — Delete Account
  // ══════════════════════════════════════════════════════════════
  // Wipes all data + profile row + auth.users row, then signs out.
  // Requires the delete_own_account() RPC to be created in Supabase.
  // See the comment in data.js → deleteAccount() for the SQL snippet.

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    const user = await SF.getUser().catch(() => null);
    const storeName = user?.store || 'your store';

    // First gate
    const first = window.confirm(
      '💀 Delete Account — Final Warning\n\n' +
      `You are about to permanently delete the account for "${storeName}".\n\n` +
      'This will delete:\n' +
      '  • All orders, customers, products & invoices\n' +
      '  • Your store profile\n' +
      '  • Your login credentials\n\n' +
      'You will be signed out immediately and cannot log back in.\n\n' +
      'Click OK to continue to the final confirmation.'
    );
    if (!first) return;

    // Second gate — type DELETE to confirm
    const typed = window.prompt(
      'Type  DELETE  in capital letters to permanently delete your account.\n\n' +
      'There is no undo for this action.'
    );
    if ((typed || '').trim() !== 'DELETE') {
      if (typed !== null) UI.toast('Deletion cancelled — text did not match', 'info');
      return;
    }

    const btn = document.getElementById('delete-account-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Deleting account…';

    try {
      await SF.deleteAccount();
      // Auth.signOut() was called inside deleteAccount().
      // The sf:signed-out event listener in app.js will handle
      // redirecting back to the login screen.
      UI.toast('Account deleted. Goodbye! 👋', 'info');
    } catch (err) {
      console.error('[SellerFlow] deleteAccount failed:', err);
      UI.toast(err.message || 'Account deletion failed — see browser Console', 'error');
      btn.disabled = false;
      btn.textContent = '💀 Delete Account';
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  QUICK ACTIONS (Dashboard)
  // ══════════════════════════════════════════════════════════════

  document.getElementById('qa-new-order').addEventListener('click', async () => {
    await UI.navigate('orders');
    setTimeout(Modals.openCreateOrder, 120);
  });
  document.getElementById('qa-add-product').addEventListener('click', async () => {
    await UI.navigate('products');
    setTimeout(Modals.openAddProduct, 120);
  });
  document.getElementById('qa-invoices').addEventListener('click',  () => UI.navigate('billing'));
  document.getElementById('qa-customers').addEventListener('click', () => UI.navigate('customers'));


  // ══════════════════════════════════════════════════════════════
  //  MODAL CLOSE WIRING
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeModal(btn.dataset.closeModal));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') UI.closeAllModals();
  });


  // ══════════════════════════════════════════════════════════════
  //  LIVE ANALYTICS PULSE (cosmetic)
  // ══════════════════════════════════════════════════════════════

  setInterval(() => {
    const el = document.getElementById('stat-revenue');
    const dashActive = document.getElementById('page-dashboard')?.classList.contains('active');
    if (el && dashActive) {
      el.style.opacity = '0.6';
      setTimeout(() => { el.style.opacity = '1'; }, 320);
    }
  }, 8000);

});
