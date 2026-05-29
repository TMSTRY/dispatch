"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDark(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDark(true);
    }
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Schakel naar licht thema" : "Schakel naar donker thema"}
      className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200"
      style={{
        background: dark
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.9)",
        border: dark
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(0,0,0,0.1)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: dark
          ? "0 2px 12px rgba(0,0,0,0.4)"
          : "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {dark ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5 text-yellow-300">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
          <span className="text-xs font-medium text-white/70">Licht</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
          <span className="text-xs font-medium text-slate-500">Donker</span>
        </>
      )}
    </button>
  );
}
