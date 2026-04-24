"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileWarning, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DropzoneProps = {
  onFile: (file: File) => void;
  loading?: boolean;
  error?: string | null;
};

export function Dropzone({ onFile, loading, error }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback(
    (file: File | null) => {
      if (!file) return;
      const isPptx =
        file.name.toLowerCase().endsWith(".pptx") ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      if (!isPptx) return;
      onFile(file);
    },
    [onFile]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !loading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (loading) return;
          const file = e.dataTransfer.files?.[0] ?? null;
          accept(file);
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-20 text-center transition-all cursor-pointer",
          "border-zinc-300 bg-white/60 hover:border-zinc-400 hover:bg-white",
          "dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-950",
          dragging &&
            "border-zinc-950 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900",
          loading && "cursor-wait opacity-80"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="sr-only"
          onChange={(e) => accept(e.target.files?.[0] ?? null)}
        />

        <motion.div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm",
            "dark:border-zinc-800 dark:bg-zinc-900"
          )}
          animate={{
            y: dragging ? -4 : 0,
            scale: dragging ? 1.05 : 1,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin text-zinc-700 dark:text-zinc-200" />
          ) : (
            <UploadCloud className="h-7 w-7 text-zinc-700 dark:text-zinc-200" />
          )}
        </motion.div>

        <div className="space-y-1.5">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
            {loading
              ? "Parsing your presentation..."
              : dragging
              ? "Release to upload"
              : "Drop your .pptx here, or click to browse"}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Everything happens in your browser. No files are uploaded.
          </p>
        </div>

        {error && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <FileWarning className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
      </div>
    </motion.div>
  );
}
