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
  accept = ".xlsx",
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
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".xlsx")
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
        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
        ${dragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700/40"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {uploading ? "Bezig met uploaden..." : "Sleep hier of klik om te kiezen (.xlsx)"}
      </p>
    </div>
  );
}
