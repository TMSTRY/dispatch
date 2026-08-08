"use client";
import { useEffect, useRef } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Rode knop voor onomkeerbare acties, blauw voor de rest. */
  tone?: "danger" | "normal";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Ja, doorgaan",
  cancelLabel = "Annuleren",
  tone = "normal",
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const danger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 w-full"
          style={{
            background: danger
              ? "linear-gradient(90deg, #F59E0B, #EF4444)"
              : "linear-gradient(90deg, #3D7CF7, #8B5CF6)",
          }}
        />
        <div className="bg-white dark:bg-[#0D1424] px-6 py-5">
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white mb-1.5">{title}</h2>
          <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
        </div>
        <div className="bg-white dark:bg-[#0D1424] px-6 pb-5 flex gap-2.5 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.05] transition"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition"
            style={{
              background: danger
                ? "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)"
                : "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
