"use client";
import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl
                   bg-white dark:bg-gray-800
                   border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4
                        bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700
                        rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Hoe werkt de Dispatch Generator?
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none font-light transition"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 text-sm text-gray-700 dark:text-gray-300">

          {/* Render warning */}
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <p>
              <span className="font-semibold text-amber-700 dark:text-amber-400">Server soms inactief</span>
              {" "}— de backend slaapt na een periode zonder gebruik.
              Krijg je een foutmelding bij het uploaden? Wacht 20–30 seconden en probeer opnieuw.
              Na de eerste aanvraag is alles terug wakker.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-white">Stap voor stap</h3>

            {[
              {
                n: "1", label: "Celbezetting", required: true,
                text: "Upload de dagelijkse celbezetting (.xlsx). De tool gebruikt deze om namen en celnummers te valideren en fouten te corrigeren.",
              },
              {
                n: "2", label: "Dispatch-bestanden", required: true,
                text: "Upload één of meerdere dienst-bestanden. De tool herkent automatisch reguliere lijsten, keuken, magazijn, betekening directeur, griffie, meditatie, islamitische bijeenkomst, etc.",
              },
              {
                n: "3", label: "Agenda / Hoorzitting", required: false,
                text: "Upload het hoorzittingsbestand (met RAD-kolom). Uur wordt automatisch 10:00, bestemming 'Hoorzitting'. BVM/IBVR-rijen worden overgeslagen.",
              },
              {
                n: "4", label: "Gereserveerde bezoeken", required: false,
                text: "Upload de bezoekerslijst. De tool leest de shift als uur en 'type bezoek' als bestemming. Gedetineerden met meerdere bezoekers in dezelfde shift staan maar 1× op de lijst.",
              },
              {
                n: "5", label: "Paleislijst", required: false,
                text: "Upload de paleislijst voor rechtbanktransport. Bestemmingen worden automatisch 'paleis', 'uithaling' of 'medische uithaling'.",
              },
              {
                n: "6", label: "Manuele invoer", required: false,
                text: "Voeg handmatig gedetineerden toe die niet in een bestand staan. Begin te typen in het naamveld voor autocomplete op basis van de celbezetting.",
              },
              {
                n: "7", label: "Datum en genereren", required: true,
                text: "Stel de datum van de dispatchlijst in (standaard morgen) en klik op 'Genereer'. De tool produceert een Excel-werkmap met alle tabbladen.",
              },
            ].map(({ n, label, required, text }) => (
              <div key={n} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                  {n}
                </span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">
                    {label}
                    {required
                      ? <span className="ml-1 text-red-500 text-xs">verplicht</span>
                      : <span className="ml-1 text-gray-400 dark:text-gray-500 text-xs">optioneel</span>
                    }
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-800 dark:text-white">Na het genereren</h3>
            <ul className="space-y-1.5 text-gray-500 dark:text-gray-400">
              <li className="flex gap-2"><span className="text-green-500">✓</span> Download de Excel met alle tabbladen (lijst disp, verzorging, secties 1–10).</li>
              <li className="flex gap-2"><span className="text-blue-500">✓</span> Bekijk de <span className="font-medium text-gray-700 dark:text-gray-300">celnummer-correcties</span> — foute celnummers uit de bronbestanden automatisch rechtgezet.</li>
              <li className="flex gap-2"><span className="text-orange-500">✓</span> Bekijk de <span className="font-medium text-gray-700 dark:text-gray-300">niet gevonden</span> lijst — gedetineerden die niet in de celbezetting staan (vrijgelaten, verlof, …).</li>
              <li className="flex gap-2"><span className="text-gray-400">✓</span> Gebruik <span className="font-medium text-gray-700 dark:text-gray-300">← Terug</span> om een bestand te wisselen zonder alles opnieuw te uploaden.</li>
            </ul>
          </div>

          {/* Tips */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 space-y-1">
            <p className="font-semibold text-gray-700 dark:text-gray-200 text-xs uppercase tracking-wide">Tips</p>
            <ul className="space-y-1 text-gray-500 dark:text-gray-400 text-xs">
              <li>• Gedetineerden in cellen 430–434 (strafcel) verschijnen enkel bij essentiële bestemmingen.</li>
              <li>• Dubbele rijen in hetzelfde bestand (zelfde naam + uur) worden automatisch gefilterd.</li>
              <li>• Rust- en ATV-rijen in keuken/magazijn worden automatisch overgeslagen.</li>
              <li>• De tool herkent .xls én .xlsx bestanden.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 text-center rounded-b-2xl">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2 text-sm transition"
          >
            Begrepen
          </button>
        </div>
      </div>
    </div>
  );
}
