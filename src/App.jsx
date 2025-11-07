import React from "react";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Home from "./Home";
import Navbar from "./Navbar";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Hero from "./Hero";
import Features from "./Features";
import MoreFeatures from "./MoreFeatures";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);

        // 🔥 after login, redirect back if needed
        if (event === "SIGNED_IN") {
          const redirectTo = localStorage.getItem("redirectTo");
          if (redirectTo) {
            localStorage.removeItem("redirectTo");
            window.location.href = redirectTo; // full reload ensures route params load
          }
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    // store the current path before login
    localStorage.setItem("redirectTo", window.location.pathname);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://web-share-client.vercel.app", // your frontend base URL
      },
    });
    if (error) console.error(error);
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <Router>
      {!user ? (
        <div className="p-6 flex flex-col items-center gap-4">
          <p>Hii Dear ! Please Sign in to continue</p>
          <button
            onClick={signInWithGoogle}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Home user={user} />
              </>
            }
          />
          <Route
            path="/hero"
            element={
              <>
                <Hero />
                <Features />
                <MoreFeatures />
              </>
            }
          />
        </Routes>
      )}
    </Router>
  );
}
