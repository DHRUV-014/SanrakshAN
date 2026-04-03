import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import { auth, loginWithGoogle, onAuthStateChanged } from "./firebase";
import { ShieldCheck } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; setAuthLoading(false); }
    }, 3000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!settled) { settled = true; clearTimeout(timeout); }
        setUser(firebaseUser);
        setAuthLoading(false);
      });
    } catch (err) {
      console.error("Firebase auth init failed:", err);
      settled = true;
      clearTimeout(timeout);
      setAuthLoading(false);
    }

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  const handleLogin = async () => {
    try {
      const u = await loginWithGoogle();
      if (u) setUser(u);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
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
