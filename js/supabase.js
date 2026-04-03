// SellerFlow — Supabase Client + Auth Module
// Provides: email/password auth, Google OAuth, forgot/reset password,
// email verification enforcement, and session persistence.
// ================================================================
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  SUPABASE SETUP — replace the two values below                  │
// │  Dashboard → Settings → API                                     │
// │                                                                 │
// │  SUPABASE_URL  → Project URL (https://xxxx.supabase.co)         │
// │  SUPABASE_ANON → anon / public key (safe to expose in JS)       │
// └─────────────────────────────────────────────────────────────────┘
//
// GOOGLE OAUTH SETUP (3 steps):
//   1. Supabase Dashboard → Authentication → Providers → Google → Enable
//   2. Create OAuth credentials at console.cloud.google.com
//      Authorised redirect URI: https://<your-project>.supabase.co/auth/v1/callback
//   3. Paste Client ID + Secret into Supabase Google provider settings
//   No code changes needed here — signInWithGoogle() handles it all.
// ================================================================

const SUPABASE_URL  = "https://tdwxohfcgdxxtsimwdwf.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkd3hvaGZjZ2R4eHRzaW13ZHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI4NDksImV4cCI6MjA5MDQ0ODg0OX0.32R42dHwdKvDnLCKtb4LHBUbDp_81NnJ1N50T-6CS1c";

// ─── Client ────────────────────────────────────────────────────────
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,  // Required for Google OAuth + magic link redirects
  },
});

// ─── Auth Module ───────────────────────────────────────────────────
const Auth = (() => {

  let _session = null;
  let _user    = null;

  // ── Bootstrap ────────────────────────────────────────────────────
  // Called once in app.js before anything else. Restores any existing
  // session from localStorage and wires the auth state change listener.
  async function init() {
    const { data } = await _supabase.auth.getSession();
    _session = data?.session ?? null;
    _user    = _session?.user ?? null;

    _supabase.auth.onAuthStateChange((event, session) => {
      _session = session;
      _user    = session?.user ?? null;

      if (event === 'SIGNED_OUT') {
        window.dispatchEvent(new Event('sf:signed-out'));
      }
      // PASSWORD_RECOVERY fires when user lands via reset-password link
      if (event === 'PASSWORD_RECOVERY') {
        window.dispatchEvent(new CustomEvent('sf:password-recovery', { detail: session }));
      }
    });

    return _user;
  }

  // ── Email / Password Sign Up ──────────────────────────────────────
  // After signup Supabase sends a confirmation email (if enabled).
  // The caller checks data.session: null = verification pending.
  async function signUp(email, password, name, store) {
    const { data, error } = await _supabase.auth.signUp({
      email,
      password,
      options: {
        // Passed to the DB trigger handle_new_user() for profile bootstrap
        data: { name, store },
        // Redirect URL shown in the verification email — change to your domain
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
    _session = data.session;
    _user    = data.user;
    return data;
  }

  // ── Email / Password Sign In ──────────────────────────────────────
  async function signIn(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _session = data.session;
    _user    = data.user;
    return data;
  }

  // ── Google OAuth ──────────────────────────────────────────────────
  // Opens a popup for OAuth. After the user authenticates, Supabase
  // redirects back and onAuthStateChange fires with SIGNED_IN.
  // Works for both new signups and returning users.
  async function signInWithGoogle() {
    const { data, error } = await _supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          // Request offline access so Google sends a refresh token
          access_type: 'offline',
          prompt:      'consent',
        },
      },
    });
    if (error) throw error;
    // Browser navigates away — the redirect back triggers onAuthStateChange
    return data;
  }

  // ── Forgot Password ───────────────────────────────────────────────
  // Supabase sends an email containing a link. That link contains a
  // type=recovery token. When the user clicks it, detectSessionInUrl
  // fires onAuthStateChange with event='PASSWORD_RECOVERY'.
  async function sendPasswordResetEmail(email) {
    const { error } = await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?mode=reset',
    });
    if (error) throw error;
  }

  // ── Update Password ───────────────────────────────────────────────
  // Called from the reset-password screen while the recovery session
  // is active. Supabase requires the user to be in a valid session.
  async function updatePassword(newPassword) {
    const { data, error } = await _supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }

  // ── Resend Verification Email ─────────────────────────────────────
  // Lets an unverified user request another confirmation email.
  async function resendVerification(email) {
    const { error } = await _supabase.auth.resend({
      type:  'signup',
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
  }

  // ── Email Verified? ───────────────────────────────────────────────
  // Returns true only if the user has clicked the confirmation link.
  // Checks the current user object from Supabase's in-memory state.
  function isEmailVerified() {
    if (!_user) return false;
    // email_confirmed_at is set by Supabase once the user clicks the link
    return !!_user.email_confirmed_at;
  }

  // ── Sign Out ──────────────────────────────────────────────────────
  async function signOut() {
    const { error } = await _supabase.auth.signOut();
    if (error) throw error;
    _session = null;
    _user    = null;
  }

  // ── Getters ──────────────────────────────────────────────────────
  function getUser()    { return _user; }
  function getUserId()  { return _user?.id ?? null; }
  function getSession() { return _session; }
  function isLoggedIn() { return !!_user; }
  function getUserEmail() { return _user?.email ?? ''; }

  // ── Provider check ───────────────────────────────────────────────
  // Returns true if the current session is from Google OAuth.
  // Used to conditionally show/hide password-related UI.
  function isGoogleUser() {
    if (!_user) return false;
    const identities = _user.identities || [];
    return identities.some(i => i.provider === 'google');
  }

  // Public API
  return {
    init,
    signUp,
    signIn,
    signInWithGoogle,
    sendPasswordResetEmail,
    updatePassword,
    resendVerification,
    isEmailVerified,
    signOut,
    getUser,
    getUserId,
    getSession,
    isLoggedIn,
    getUserEmail,
    isGoogleUser,
  };
})();
