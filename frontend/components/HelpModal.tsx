"use client";
import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent stripe */}
        <div className="h-1 w-full rounded-t-2xl"
          style={{ background: "linear-gradient(90deg, #3D7CF7 0%, #8B5CF6 50%, #10B981 100%)" }} />

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4
                        bg-white dark:bg-[#0D1424] border-b border-slate-100 dark:border-white/[0.06] z-10">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Hoe werkt de Dispatch Generator?
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-[#0D1424] px-6 py-5 space-y-5 text-sm">

          {/* Warning */}
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-400/[0.07] border border-amber-100 dark:border-amber-400/20 rounded-xl px-4 py-3.5">
            <span className="text-amber-500 text-base mt-0.5 flex-shrink-0">⚠</span>
            <p className="text-[13px] text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-amber-700 dark:text-amber-400">Server soms inactief</span>
              {" "}— de backend slaapt na een periode zonder gebruik.
              Krijg je een foutmelding? Wacht 20–30 seconden en probeer opnieuw.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Stap voor stap
            </p>
            {[
              { n: "1", label: "Celbezetting", required: true,
                text: "Upload de dagelijkse celbezetting (.xlsx). Gebruikt voor validatie en correctie van namen en celnummers." },
              { n: "2", label: "Dispatch-bestanden", required: true,
                text: "Upload één of meerdere dienst-bestanden. De tool herkent automatisch reguliere lijsten, keuken, magazijn, betekening directeur, griffie, meditatie, islamitische bijeenkomst, etc." },
              { n: "3", label: "Agenda / Hoorzitting", required: false,
                text: "Upload het hoorzittingsbestand (met RAD-kolom). Uur wordt automatisch 10:00, bestemming 'Hoorzitting'. BVM/IBVR-rijen worden overgeslagen." },
              { n: "4", label: "Gereserveerde bezoeken", required: false,
                text: "Upload de bezoekerslijst. De tool leest de shift als uur en 'type bezoek' als bestemming. Gedetineerden met meerdere bezoekers in dezelfde shift staan maar 1× op de lijst." },
              { n: "5", label: "Paleislijst", required: false,
                text: "Upload de paleislijst voor rechtbanktransport. Bestemmingen worden automatisch 'paleis', 'uithaling' of 'medische uithaling'." },
              { n: "6", label: "Manuele invoer", required: false,
                text: "Voeg handmatig gedetineerden toe: UV's, PV's, vrij, transfer… Begin te typen in het naamveld voor autocomplete op basis van de celbezetting." },
              { n: "7", label: "Datum en genereren", required: true,
                text: "Stel de datum in (standaard morgen) en klik op 'Genereer'. De tool produceert een Excel-werkmap met alle tabbladen." },
            ].map(({ n, label, required, text }) => (
              <div key={n} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 text-white text-[11px] font-bold rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: "linear-gradient(135deg, #3D7CF7, #8B5CF6)" }}>
                  {n}
                </span>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-[13px] flex items-center gap-1.5 flex-wrap">
                    {label}
                    {required
                      ? <span className="text-[10px] font-semibold text-red-400 border border-red-400/30 rounded-full px-1.5 py-px">verplicht</span>
                      : <span className="text-[10px] text-slate-400 dark:text-slate-500">optioneel</span>
                    }
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[13px] leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* After generate */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Na het genereren
            </p>
            <div className="space-y-2">
              {[
                { dot: "bg-emerald-400", text: "Download de Excel met alle tabbladen (lijst disp, verzorging, secties 1–10)." },
                { dot: "bg-blue-400",   text: "Controleer de celnummer-correcties — foute celnummers worden automatisch rechtgezet." },
                { dot: "bg-amber-400",  text: "Bekijk de niet-gevonden gedetineerden — vermoedelijk vrijgelaten of op verlof." },
                { dot: "bg-slate-400",  text: "Gebruik '← Terug' om één bestand te wisselen zonder alles opnieuw te uploaden." },
              ].map(({ dot, text }, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] rounded-xl px-4 py-3.5 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tips</p>
            {[
              "Gedetineerden in cellen 430–434 (strafcel) verschijnen enkel bij essentiële bestemmingen.",
              "Dubbele rijen (zelfde naam + uur + activiteit) worden automatisch gefilterd.",
              "Rust- en ATV-rijen in keuken/magazijn worden overgeslagen.",
              "De tool herkent .xls én .xlsx bestanden.",
            ].map((tip, i) => (
              <p key={i} className="text-[12px] text-slate-500 dark:text-slate-400 flex gap-2">
                <span className="text-slate-300 dark:text-slate-600 flex-shrink-0">·</span>
                {tip}
              </p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white dark:bg-[#0D1424] px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] text-center rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
            style={{ background: "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)", boxShadow: "0 0 16px rgba(61,124,247,0.3)" }}
          >
            Begrepen
          </button>
        </div>
      </div>
    </div>
  );
}
