"use client";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";

/**
 * Eén centrale toegangspoort voor de hele app.
 *
 * De wachtwoordcontrole zat vroeger in de dispatchpagina zelf, waardoor
 * /mutaties en /werkers er nooit langs gingen en vrij toegankelijk waren —
 * inclusief de navigatiebalk die op het inlogscherm zichtbaar bleef. Door de
 * controle hier te leggen komt elke pagina er automatisch doorheen, ook
 * pagina's die er later bij komen.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // "checking" tot sessionStorage gelezen is; anders flitst het inlogscherm
  // even voorbij bij elke navigatie.
  const [status, setStatus] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      sessionStorage.getItem("dispatch_auth") === "1";
    setStatus(ok ? "in" : "out");
  }, []);

  if (status === "checking") {
    return <div className="min-h-screen bg-slate-50 dark:bg-[#080C14]" />;
  }

  if (status === "out") {
    return <AuthGate onAuth={() => setStatus("in")} />;
  }

  return (
    <>
      <Nav />
      {children}
    </>
  );
}
