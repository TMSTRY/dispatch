"use client";
import { useState } from "react";
import { VERSION } from "@/lib/version";

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#080C14]">
      {/* Hero */}
      <div className="relative">
        <div className="overflow-hidden" style={{ height: "68vh", minHeight: "460px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-aerial.PNG"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Top vignette */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(8,12,20,0.5) 0%, transparent 40%)" }} />
        </div>
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 opacity-100 dark:opacity-0 pointer-events-none transition-opacity duration-300"
          style={{ top: "calc(68vh * 0.30)", height: "calc(68vh * 0.70 + 12rem)", background: "linear-gradient(to top, #F8FAFC 0%, #F8FAFC 38%, transparent 85%)" }} />
        <div className="absolute inset-x-0 opacity-0 dark:opacity-100 pointer-events-none transition-opacity duration-300"
          style={{ top: "calc(68vh * 0.30)", height: "calc(68vh * 0.70 + 12rem)", background: "linear-gradient(to top, #080C14 0%, #080C14 38%, transparent 85%)" }} />

        {/* Login card */}
        <div className="relative -mt-52 px-4 pb-16 flex justify-center">
          <div
            className="glass rounded-2xl p-8 w-full max-w-sm"
            style={{ marginTop: 0 }}
          >
            {/* Top accent line */}
            <div className="h-0.5 w-12 mx-auto rounded-full mb-6"
              style={{ background: "linear-gradient(90deg, #3D7CF7, #8B5CF6)" }} />

            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-slate-400 dark:text-slate-500 text-center mb-2">
              Intern systeem
            </p>
            <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-6">
              Dispatch Generator
            </h1>

            <form onSubmit={submit} className="space-y-3">
              <input
                type="password"
                placeholder="Wachtwoord"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                autoFocus
              />
              {error && (
                <p className="text-xs text-red-500 text-center font-medium">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !pw}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)",
                  boxShadow: (!loading && pw) ? "0 0 20px rgba(61,124,247,0.35), 0 4px 12px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 spin" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                      <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                    Bezig…
                  </span>
                ) : "Inloggen"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <p className="text-center text-slate-300 dark:text-slate-700 text-xs pb-6">v{VERSION}</p>
    </div>
  );
}
