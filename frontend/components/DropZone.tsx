"use client";
import { useRef, useState } from "react";

interface Props {
  label: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
}

export default function DropZone({
  label,
  accept = ".xlsx,.xls",
  multiple = false,
  onFiles,
  disabled = false,
  uploading = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const allowed = accept.split(",").map((s) => s.trim().toLowerCase());
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      allowed.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (files.length) onFiles(files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = "";
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        relative rounded-xl py-7 px-6 text-center cursor-pointer transition-all duration-200
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
      style={{
        border: dragging
          ? "1.5px dashed #3D7CF7"
          : "1.5px dashed rgba(148,163,184,0.35)",
        background: dragging
          ? "rgba(61,124,247,0.06)"
          : "rgba(248,250,252,0.6)",
        boxShadow: dragging ? "0 0 0 3px rgba(61,124,247,0.12)" : "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />

      {/* Upload icon */}
      <div
        className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all duration-200"
        style={{
          background: dragging
            ? "linear-gradient(135deg, #3D7CF7, #8B5CF6)"
            : "rgba(15,23,42,0.06)",
        }}
      >
        {uploading ? (
          <svg className="w-5 h-5 spin" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? "white" : "#94a3b8"} strokeWidth={2}>
            <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? "white" : "#94a3b8"} strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        )}
      </div>

      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {uploading
          ? "Bezig met uploaden…"
          : `Sleep of klik · ${accept.split(",").map((s) => s.trim()).join(" / ")}`}
      </p>
    </div>
  );
}
