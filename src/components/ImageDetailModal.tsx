"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, TrendingDown, TrendingUp, X } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import type { MediaImage } from "@/lib/pptx";
import type { ImageState } from "@/components/ImageCard";

type Props = {
  image: MediaImage | null;
  state: ImageState | undefined;
  onClose: () => void;
  onRatioChange: (ratio: number) => void;
};

export function ImageDetailModal({
  image,
  state,
  onClose,
  onRatioChange,
}: Props) {
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [image, onClose]);

  const pct = state ? Math.round(state.ratio * 100) : 0;
  const isSvg = image?.ext === "svg";

  const delta =
    state?.estimatedSize != null && image
      ? state.estimatedSize - image.originalSize
      : null;
  const savingsPct =
    state?.estimatedSize != null && image && image.originalSize > 0
      ? Math.round(
          ((image.originalSize - state.estimatedSize) / image.originalSize) * 100
        )
      : null;

  return (
    <AnimatePresence>
      {image && state && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label={image.name}
            className="relative flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {image.name}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {image.ext.toUpperCase()} - {formatBytes(image.originalSize)} original
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[1fr_22rem]">
              <div className="relative min-h-[50vh] bg-[repeating-conic-gradient(theme(colors.zinc.100)_0%_25%,theme(colors.white)_0%_50%)] bg-[length:24px_24px] dark:bg-[repeating-conic-gradient(theme(colors.zinc.800)_0%_25%,theme(colors.zinc.900)_0%_50%)]">
                {isSvg ? (
                  <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                    Vector (.svg) assets aren&apos;t re-encoded.
                  </div>
                ) : (
                  <Image
                    src={state.compressedPreviewUrl ?? image.previewUrl}
                    alt={image.name}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 70vw"
                    className="object-contain"
                  />
                )}
                {state.isEstimating && (
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating preview
                  </div>
                )}
              </div>

              <aside className="flex flex-col gap-5 overflow-y-auto border-t border-zinc-200 p-5 lg:border-l lg:border-t-0 dark:border-zinc-800">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Sizes
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        Original
                      </div>
                      <div className="mt-1 text-base font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatBytes(image.originalSize)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-950/10 bg-zinc-950 p-3 text-white dark:border-white/10 dark:bg-white dark:text-zinc-950">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-300 dark:text-zinc-600">
                        Compressed
                      </div>
                      <div className="mt-1 inline-flex items-center gap-2 text-base font-semibold tabular-nums">
                        {state.isEstimating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>calculating</span>
                          </>
                        ) : state.estimatedSize != null ? (
                          <>
                            <span>{formatBytes(state.estimatedSize)}</span>
                            {delta != null && savingsPct != null && (
                              <span
                                className={
                                  delta < 0
                                    ? "inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-400 dark:text-emerald-600"
                                    : "inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-400 dark:text-amber-600"
                                }
                              >
                                {delta < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : (
                                  <TrendingUp className="h-3 w-3" />
                                )}
                                {savingsPct > 0
                                  ? `-${savingsPct}%`
                                  : `+${Math.abs(savingsPct)}%`}
                              </span>
                            )}
                          </>
                        ) : (
                          <span>&ndash;</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      Quality
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                      {pct}%
                    </div>
                  </div>
                  <Slider
                    value={pct}
                    min={10}
                    max={100}
                    step={1}
                    onValueChange={(v) => onRatioChange(v / 100)}
                    disabled={isSvg}
                    aria-label={`Compression ratio for ${image.name}`}
                  />
                  <div className="mt-2 flex justify-between text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                    <span>Smaller (10%)</span>
                    <span>Sharper (100%)</span>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Drag to re-compress and inspect the preview. The
                    downsized image here is exactly what will end up in the
                    exported .pptx.
                  </p>
                </div>

                <div className="mt-auto flex justify-end">
                  <Button variant="outline" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </aside>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
