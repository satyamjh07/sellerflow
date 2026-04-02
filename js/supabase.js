// SellerFlow — Supabase Client + Auth Module
// Initializes the Supabase client and exposes a clean Auth API.
// All other modules depend on this being loaded first.
// ================================================================
//
// ┌─────────────────────────────────────────────────────────────┐
// │  SETUP — replace the two placeholders below with your own   │
// │  values from: Supabase Dashboard → Settings → API           │
// └─────────────────────────────────────────────────────────────┘
//
//   SUPABASE_URL  → Project URL  (e.g. https://xxxx.supabase.co)
//   SUPABASE_ANON → Anon/Public API Key  (safe to expose in JS)
//
// ================================================================

const SUPABASE_URL = "https://tdwxohfcgdxxtsimwdwf.supabase.co"; // ← replace
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkd3hvaGZjZ2R4eHRzaW13ZHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI4NDksImV4cCI6MjA5MDQ0ODg0OX0.32R42dHwdKvDnLCKtb4LHBUbDp_81NnJ1N50T-6CS1c"; // ← replace

// ─── Client ───────────────────────────────────────────────────
// Loaded via CDN in index.html: @supabase/supabase-js
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Persist session in localStorage across page refreshes
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles magic link / OAuth redirects
  },
});

// ─── Auth Module ──────────────────────────────────────────────
const Auth = (() => {
  // ── Current session cache ────────────────────────────────────
  let _session = null;
  let _user = null;

  // ── Bootstrap: called once on DOMContentLoaded ───────────────
  async function init() {
    // Restore any existing session (page refresh / returning user)
    const { data } = await _supabase.auth.getSession();
    _session = data?.session ?? null;
    _user = _session?.user ?? null;

    // Listen for future auth state changes (login, logout, token refresh)
    _supabase.auth.onAuthStateChange((event, session) => {
      _session = session;
      _user = session?.user ?? null;

      if (event === "SIGNED_OUT") {
        // Let app.js handle the redirect back to login screen
        window.dispatchEvent(new Event("sf:signed-out"));
      }
    });

    return _user;
  }

  // ── Sign Up ──────────────────────────────────────────────────
  // Creates auth.users row + triggers handle_new_user() in Postgres
  async function signUp(email, password, name, store) {
    const { data, error } = await _supabase.auth.signUp({
      email,
      password,
      options: {
        // Passed to the trigger so the profile gets a name + store immediately
        data: { name, store },
      },
    });
    if (error) throw error;
    _session = data.session;
    _user = data.user;
    return data;
  }

  // ── Sign In ──────────────────────────────────────────────────
  async function signIn(email, password) {
    const { data, error } = await _supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    _session = data.session;
    _user = data.user;
    return data;
  }

  // ── Sign Out ─────────────────────────────────────────────────
  async function signOut() {
    const { error } = await _supabase.auth.signOut();
    if (error) throw error;
    _session = null;
    _user = null;
  }

  // ── Getters ──────────────────────────────────────────────────
  function getUser() {
    return _user;
  }
  function getUserId() {
    return _user?.id ?? null;
  }
  function getSession() {
    return _session;
  }
  function isLoggedIn() {
    return !!_user;
  }

  // Public API
  return {
    init,
    signUp,
    signIn,
    signOut,
    getUser,
    getUserId,
    getSession,
    isLoggedIn,
  };
})();
