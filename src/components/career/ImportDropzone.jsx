import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, FileJson } from "lucide-react";

// Zona de carga drag & drop + selector para archivos JSON de historiales.
export default function ImportDropzone({ onFile, disabled, fileName }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      if (!files || !files.length || disabled) return;
      const file = files[0];
      if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
        onFile(null, "El archivo debe ser JSON (.json).");
        return;
      }
      onFile(file, null);
    },
    [onFile, disabled]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      if (disabled) return;
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles, disabled]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
        dragging
          ? "border-[#003399] bg-[#003399]/[0.04]"
          : "border-slate-300 bg-slate-50/70 hover:border-slate-400"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {fileName ? (
        <div className="flex items-center gap-3 text-slate-700">
          <FileJson size={28} className="text-[#003399]" />
          <span className="text-sm font-bold">{fileName}</span>
        </div>
      ) : (
        <>
          <UploadCloud size={30} className="mb-3 text-slate-400" />
          <p className="text-sm font-bold text-slate-700">
            Arrastra aquí el lote JSON o haz clic para seleccionarlo
          </p>
          <p className="mt-1 text-xs text-slate-400">
            LOTE_BASE44_PREVISUALIZACION.json · LOTE_BASE44_APROBADOS.json
          </p>
        </>
      )}
    </div>
  );
}