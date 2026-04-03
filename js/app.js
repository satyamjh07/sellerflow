// SellerFlow — Main App Entry Point (Production Auth Edition)
// Auth flows: email/password, Google OAuth, forgot password,
//             email verification enforcement, reset password.
// ================================================================

document.addEventListener('DOMContentLoaded', async () => {

  // ─── 1. Init Supabase session ──────────────────────────────────
  UI.showLoading('Loading SellerFlow…');
  const existingUser = await Auth.init();
  UI.hideLoading();

  // ─── 2. Check if we're returning from a password-reset link ────
  // Supabase injects #access_token into the URL after the user
  // clicks the reset link in their email. detectSessionInUrl handles
  // the token exchange; onAuthStateChange fires PASSWORD_RECOVERY.
  const urlParams  = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const isResetMode = urlParams.get('mode') === 'reset' ||
                      hashParams.get('type') === 'recovery';

  if (isResetMode && existingUser) {
    _showScreen('reset-password');
  } else if (existingUser) {
    await _bootApp(existingUser);
  } else {
    _showScreen('login');
  }

  // ─── 3. Listen for PASSWORD_RECOVERY event ─────────────────────
  window.addEventListener('sf:password-recovery', () => {
    _showScreen('reset-password');
  });

  // ─── 4. Listen for sign-out ────────────────────────────────────
  window.addEventListener('sf:signed-out', () => {
    document.getElementById('app').classList.remove('active');
    _showScreen('login');
    UI.toast('You have been signed out.', 'info');
  });

  // ─── 5. Listen for Google OAuth redirect ───────────────────────
  // After Google redirects back, Supabase fires SIGNED_IN.
  // We handle it by checking if app is already booted.
  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !document.getElementById('app').classList.contains('active')) {
      UI.showLoading('Signing you in…');
      await _bootApp(session.user);
      UI.hideLoading();
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  SCREEN ROUTER
  //  Screens: 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password'
  // ══════════════════════════════════════════════════════════════

  function _showScreen(screen) {
    // Hide the main app and login page wrapper initially
    document.getElementById('app').classList.remove('active');
    document.getElementById('login-page').style.display = '';

    const allForms = [
      'auth-login-form',
      'auth-signup-form',
      'auth-verify-email-screen',
      'auth-forgot-password-screen',
      'auth-reset-password-screen',
    ];
    allForms.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Update tab state
    const loginTab  = document.getElementById('auth-login-tab');
    const signupTab = document.getElementById('auth-signup-tab');
    const tabBar    = document.querySelector('.auth-tabs');

    // Only show tabs + feature strip on login/signup screens
    const showTabs = screen === 'login' || screen === 'signup';
    if (tabBar) tabBar.style.display = showTabs ? '' : 'none';
    if (loginTab)  loginTab.classList.toggle('active', screen === 'login');
    if (signupTab) signupTab.classList.toggle('active', screen === 'signup');

    // Hide the feature strip (📦🧾📊 icons) on utility screens
    const featureStrip = document.getElementById('auth-feature-strip');
    if (featureStrip) featureStrip.style.display = showTabs ? '' : 'none';

    // Show the target screen
    const screenMap = {
      'login':            'auth-login-form',
      'signup':           'auth-signup-form',
      'verify-email':     'auth-verify-email-screen',
      'forgot-password':  'auth-forgot-password-screen',
      'reset-password':   'auth-reset-password-screen',
    };
    const targetId = screenMap[screen];
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) el.style.display = '';
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  TAB SWITCHING
  // ══════════════════════════════════════════════════════════════

  document.getElementById('auth-login-tab').addEventListener('click',  () => _showScreen('login'));
  document.getElementById('auth-signup-tab').addEventListener('click', () => _showScreen('signup'));
  document.getElementById('switch-to-signup').addEventListener('click', () => _showScreen('signup'));
  document.getElementById('switch-to-login').addEventListener('click',  () => _showScreen('login'));


  // ══════════════════════════════════════════════════════════════
  //  GOOGLE OAUTH
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll('.btn-google').forEach(btn => {
    btn.addEventListener('click', _handleGoogleSignIn);
  });

  async function _handleGoogleSignIn() {
    document.querySelectorAll('.btn-google').forEach(b => {
      b.disabled = true;
      b.innerHTML = `<span class="btn-google-spinner"></span> Connecting…`;
    });
    try {
      await Auth.signInWithGoogle();
      // Browser navigates away — this line is usually not reached
    } catch (err) {
      UI.toast(err.message || 'Google sign-in failed. Please try again.', 'error');
      document.querySelectorAll('.btn-google').forEach(b => {
        b.disabled = false;
        b.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="google-icon" alt="Google" /> Continue with Google`;
      });
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  EMAIL / PASSWORD LOGIN
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

      // ── Email verification gate ──────────────────────────────
      if (!Auth.isEmailVerified()) {
        // Store email for the resend button on the verify screen
        document.getElementById('verify-email-address').textContent = email;
        document.getElementById('resend-email-input').value = email;
        _showScreen('verify-email');
        UI.toast('Please verify your email before accessing your dashboard.', 'warn');
        await Auth.signOut(); // Sign out so they can't bypass the gate
        return;
      }

      await _bootApp(Auth.getUser());
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
        UI.toast('Incorrect email or password.', 'error');
      } else if (msg.includes('Email not confirmed')) {
        // Supabase itself blocked them — show verification screen
        document.getElementById('verify-email-address').textContent = email;
        document.getElementById('resend-email-input').value = email;
        _showScreen('verify-email');
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
        // Email confirmation is required — show verification pending screen
        document.getElementById('verify-email-address').textContent = email;
        document.getElementById('resend-email-input').value = email;
        _showScreen('verify-email');
      } else {
        // Auto-confirmed (Supabase email confirmation disabled)
        await _bootApp(Auth.getUser());
        UI.toast(`Welcome to SellerFlow, ${name}! 🎉`, 'success');
      }
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('User already registered')) {
        UI.toast('An account with this email already exists. Please sign in.', 'warn');
        _showScreen('login');
      } else {
        UI.toast(msg || 'Sign up failed. Please try again.', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account →';
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  EMAIL VERIFICATION SCREEN
  // ══════════════════════════════════════════════════════════════

  document.getElementById('resend-verification-btn').addEventListener('click', async () => {
    const email = document.getElementById('resend-email-input').value.trim();
    if (!email) { UI.toast('Email address not found.', 'error'); return; }

    const btn = document.getElementById('resend-verification-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await Auth.resendVerification(email);
      UI.toast('Verification email sent! Check your inbox and spam folder.', 'success');

      // Cooldown: prevent spam for 60 seconds
      let seconds = 60;
      const interval = setInterval(() => {
        seconds--;
        btn.textContent = `Resend in ${seconds}s`;
        if (seconds <= 0) {
          clearInterval(interval);
          btn.disabled = false;
          btn.textContent = '📧 Resend Verification Email';
        }
      }, 1000);
    } catch (err) {
      UI.toast(err.message || 'Failed to send verification email.', 'error');
      btn.disabled = false;
      btn.textContent = '📧 Resend Verification Email';
    }
  });

  // "I've verified — check again" button
  document.getElementById('check-verified-btn').addEventListener('click', async () => {
    const btn = document.getElementById('check-verified-btn');
    btn.disabled = true;
    btn.textContent = 'Checking…';

    try {
      // Refresh the session to get the latest user data from Supabase
      const { data, error } = await _supabase.auth.getSession();
      if (error) throw error;

      if (data?.session?.user?.email_confirmed_at) {
        // Update the Auth module's cached user
        await Auth.init();
        UI.toast('Email verified! Welcome to SellerFlow 🎉', 'success');
        await _bootApp(Auth.getUser());
      } else {
        UI.toast('Not verified yet. Please click the link in your email first.', 'warn');
      }
    } catch (err) {
      UI.toast('Could not check verification status. Try signing in again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ I\'ve Verified — Open Dashboard';
    }
  });

  // Back to login link on verification screen
  document.getElementById('verify-back-to-login').addEventListener('click', () => {
    _showScreen('login');
  });


  // ══════════════════════════════════════════════════════════════
  //  FORGOT PASSWORD
  // ══════════════════════════════════════════════════════════════

  document.getElementById('forgot-password-link').addEventListener('click', () => {
    // Pre-fill email from login form if the user typed it
    const loginEmail = document.getElementById('login-email').value.trim();
    if (loginEmail) document.getElementById('forgot-email-input').value = loginEmail;
    _showScreen('forgot-password');
  });

  document.getElementById('forgot-password-btn').addEventListener('click', _handleForgotPassword);
  document.getElementById('forgot-email-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') _handleForgotPassword();
  });

  async function _handleForgotPassword() {
    const email = document.getElementById('forgot-email-input').value.trim();
    if (!email) {
      UI.toast('Please enter your email address.', 'error');
      return;
    }

    const btn = document.getElementById('forgot-password-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await Auth.sendPasswordResetEmail(email);
      // Show success state — replace the form with a confirmation message
      document.getElementById('forgot-password-form-area').style.display = 'none';
      document.getElementById('forgot-password-success').style.display   = '';
      document.getElementById('forgot-success-email').textContent = email;
    } catch (err) {
      UI.toast(err.message || 'Could not send reset email. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📧 Send Reset Email';
    }
  }

  document.getElementById('forgot-back-to-login').addEventListener('click', () => {
    // Reset the form back to its initial state
    document.getElementById('forgot-password-form-area').style.display = '';
    document.getElementById('forgot-password-success').style.display   = 'none';
    document.getElementById('forgot-email-input').value = '';
    _showScreen('login');
  });


  // ══════════════════════════════════════════════════════════════
  //  RESET PASSWORD (user lands here from email link)
  // ══════════════════════════════════════════════════════════════

  document.getElementById('reset-password-btn').addEventListener('click', _handleResetPassword);
  document.getElementById('reset-password-confirm').addEventListener('keydown', e => {
    if (e.key === 'Enter') _handleResetPassword();
  });

  async function _handleResetPassword() {
    const newPw  = document.getElementById('reset-password-input').value;
    const confirm = document.getElementById('reset-password-confirm').value;

    if (!newPw || !confirm) {
      UI.toast('Please fill in both password fields.', 'error');
      return;
    }
    if (newPw.length < 8) {
      UI.toast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (newPw !== confirm) {
      UI.toast('Passwords do not match.', 'error');
      // Shake animation on the confirm field
      const el = document.getElementById('reset-password-confirm');
      el.classList.add('input-shake');
      setTimeout(() => el.classList.remove('input-shake'), 500);
      return;
    }

    const btn = document.getElementById('reset-password-btn');
    btn.disabled = true;
    btn.textContent = 'Updating password…';

    try {
      await Auth.updatePassword(newPw);
      // Show success state
      document.getElementById('reset-password-form-area').style.display = 'none';
      document.getElementById('reset-password-success').style.display   = '';
      UI.toast('Password updated successfully!', 'success');

      // Auto-redirect to dashboard after 2.5 s (user is now logged in)
      setTimeout(async () => {
        await _bootApp(Auth.getUser());
      }, 2500);
    } catch (err) {
      UI.toast(err.message || 'Failed to update password. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔐 Set New Password';
    }
  }

  document.getElementById('reset-back-to-login').addEventListener('click', () => {
    document.getElementById('reset-password-form-area').style.display = '';
    document.getElementById('reset-password-success').style.display   = 'none';
    document.getElementById('reset-password-input').value   = '';
    document.getElementById('reset-password-confirm').value = '';
    _showScreen('login');
  });


  // ══════════════════════════════════════════════════════════════
  //  APP BOOT (called after any successful auth)
  // ══════════════════════════════════════════════════════════════

  async function _bootApp(authUser) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').classList.add('active');

    // Populate sidebar
    const user = await SF.getUser();
    const displayName = user?.name || authUser?.email?.split('@')[0] || 'Seller';
    document.getElementById('sidebar-user-name').textContent  = displayName;
    document.getElementById('sidebar-user-store').textContent = user?.store || 'My Store';
    document.getElementById('sidebar-avatar-initials').textContent = SF.initials(displayName);

    // For Google users: show their provider badge, hide password change row
    const settingsProviderRow = document.getElementById('settings-provider-row');
    const settingsPasswordRow = document.getElementById('settings-password-row');
    if (settingsProviderRow) settingsProviderRow.style.display = Auth.isGoogleUser() ? '' : 'none';
    if (settingsPasswordRow) settingsPasswordRow.style.display = Auth.isGoogleUser() ? 'none' : '';

    // ── Billing: init plan state, check expiry, schedule reminders ──
    // MUST be awaited so _currentPlan is set before any page renders.
    // Previously fire-and-forget caused race: settings/dashboard rendered
    // with stale _currentPlan = 'free' before the DB fetch completed.
    try {
      await Billing.init();
    } catch (err) {
      console.warn('[App] Billing.init non-fatal:', err.message);
    }

    UI.updateBadges();
    await UI.navigate('dashboard');
  }


  // ══════════════════════════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════════════════════════

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await Auth.signOut();
    } catch (err) {
      UI.toast(err.message || 'Logout failed', 'error');
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  SIDEBAR + TOPBAR
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => UI.navigate(item.dataset.page));
  });
  document.getElementById('mobile-menu-btn').addEventListener('click', UI.openMobileSidebar);
  document.querySelector('.sidebar-overlay').addEventListener('click', UI.closeMobileSidebar);

  const topbarSearch = document.getElementById('topbar-search-input');
  topbarSearch.addEventListener('input', UI.debounce(async () => {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage === 'products')  await Pages.products(topbarSearch.value);
    if (activePage === 'customers') await Pages.customers(topbarSearch.value);
  }, 250));


  // ══════════════════════════════════════════════════════════════
  //  PRODUCTS
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
  //  ORDERS
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
  //  CUSTOMERS
  // ══════════════════════════════════════════════════════════════

  document.getElementById('customer-search').addEventListener('input', UI.debounce(async e => {
    await Pages.customers(e.target.value);
  }, 250));


  // ══════════════════════════════════════════════════════════════
  //  SETTINGS
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

  // Change password link in settings (only for non-Google users)
  const changePasswordLink = document.getElementById('settings-change-password-link');
  if (changePasswordLink) {
    changePasswordLink.addEventListener('click', async () => {
      const email = Auth.getUserEmail();
      if (!email) { UI.toast('Could not determine your email.', 'error'); return; }

      changePasswordLink.textContent = 'Sending reset email…';
      changePasswordLink.style.pointerEvents = 'none';

      try {
        await Auth.sendPasswordResetEmail(email);
        UI.toast('Password reset email sent! Check your inbox.', 'success');
        changePasswordLink.textContent = '✅ Reset email sent';
      } catch (err) {
        UI.toast(err.message || 'Failed to send reset email.', 'error');
        changePasswordLink.textContent = 'Send password reset email →';
        changePasswordLink.style.pointerEvents = '';
      }
    });
  }


  // ══════════════════════════════════════════════════════════════
  //  DANGER ZONE
  // ══════════════════════════════════════════════════════════════

  document.getElementById('reset-account-btn').addEventListener('click', async () => {
    const first = window.confirm(
      '⚠️ Reset Account Data?\n\nThis will permanently delete ALL your:\n  • Orders\n  • Customers\n  • Products\n  • Invoices\n\nYour profile and login will be kept.\n\nClick OK to continue.'
    );
    if (!first) return;

    const typed = window.prompt('Type  RESET  in capital letters to confirm.');
    if ((typed || '').trim() !== 'RESET') {
      if (typed !== null) UI.toast('Reset cancelled — text did not match', 'info');
      return;
    }

    const btn = document.getElementById('reset-account-btn');
    btn.disabled = true; btn.textContent = '⏳ Resetting…';

    try {
      await SF.resetAccount();
      UI.toast('Account data reset. All records deleted.', 'success');
      await UI.navigate('dashboard');
      UI.updateBadges();
    } catch (err) {
      UI.toast(err.message || 'Reset failed', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🗑️ Reset Data';
    }
  });

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    const user = await SF.getUser().catch(() => null);
    const storeName = user?.store || 'your store';

    const first = window.confirm(
      `💀 Delete Account — Final Warning\n\nYou are about to permanently delete the account for "${storeName}".\n\nThis deletes everything and cannot be undone.\n\nClick OK to continue.`
    );
    if (!first) return;

    const typed = window.prompt('Type  DELETE  in capital letters to confirm.');
    if ((typed || '').trim() !== 'DELETE') {
      if (typed !== null) UI.toast('Deletion cancelled', 'info');
      return;
    }

    const btn = document.getElementById('delete-account-btn');
    btn.disabled = true; btn.textContent = '⏳ Deleting…';

    try {
      await SF.deleteAccount();
      UI.toast('Account deleted. Goodbye! 👋', 'info');
    } catch (err) {
      UI.toast(err.message || 'Deletion failed', 'error');
      btn.disabled = false; btn.textContent = '💀 Delete Account';
    }
  });


  // ══════════════════════════════════════════════════════════════
  //  QUICK ACTIONS
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
  //  MODAL CLOSE + ESCAPE
  // ══════════════════════════════════════════════════════════════

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeModal(btn.dataset.closeModal));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') UI.closeAllModals();
  });


  // ══════════════════════════════════════════════════════════════
  //  LIVE PULSE (cosmetic)
  // ══════════════════════════════════════════════════════════════

  setInterval(() => {
    const el = document.getElementById('stat-revenue');
    if (el && document.getElementById('page-dashboard')?.classList.contains('active')) {
      el.style.opacity = '0.6';
      setTimeout(() => { el.style.opacity = '1'; }, 320);
    }
  }, 8000);

});
