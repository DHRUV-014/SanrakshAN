import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import { auth, loginWithGoogle, onAuthStateChanged } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Persist session across refreshes — Firebase keeps the session in IndexedDB,
  // so on reload we pick up the existing user without re-prompting sign-in.
  useEffect(() => {
    let settled = false;

    // Safety timeout: if Firebase never responds (offline, bad config),
    // stop waiting and show the landing page after 3 seconds.
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setAuthLoading(false);
      }
    }, 3000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
        }
        setUser(firebaseUser);
        setAuthLoading(false);
      });
    } catch (err) {
      console.error("Firebase auth init failed:", err);
      settled = true;
      clearTimeout(timeout);
      setAuthLoading(false);
    }

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const u = await loginWithGoogle();
      // u is null if user cancelled the popup — do nothing
      if (u) setUser(u);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  // Brief loading while Firebase checks for existing session
  if (authLoading) {
    return (
      <div className="h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-500 text-[13px] font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  return !user ? (
    <LandingPage onLogin={handleLogin} />
  ) : (
    <Dashboard user={user} onLogout={() => setUser(null)} />
  );
}