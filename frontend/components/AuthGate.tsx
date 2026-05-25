"use client";
import { useState } from "react";

export default function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("dispatch_auth", "1");
        }
        onAuth();
      } else {
        setError("Ongeldig wachtwoord");
      }
    } catch {
      setError("Verbindingsfout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Hero image */}
      <div className="relative h-72 md:h-96 overflow-hidden flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-aerial.PNG"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Light mode: white gradient at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white opacity-100 dark:opacity-0 transition-opacity duration-300" />
        {/* Dark mode: dark gradient at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-gray-900 opacity-0 dark:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-start justify-center pt-8 pb-16 px-4 -mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-10 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-2 text-gray-800 dark:text-white">
            Dispatch Generator
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
            Intern systeem — toegang beperkt
          </p>
          <form onSubmit={submit} className="space-y-4">
            <input
              type="password"
              placeholder="Wachtwoord"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !pw}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition"
            >
              {loading ? "Bezig..." : "Inloggen"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
