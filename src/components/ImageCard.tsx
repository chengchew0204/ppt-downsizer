"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ImageIcon, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatBytes } from "@/lib/utils";
import type { MediaImage } from "@/lib/pptx";

export type ImageState = {
  ratio: number;
  estimatedSize: number | null;
  isEstimating: boolean;
  estimateError: string | null;
};

type Props = {
  image: MediaImage;
  state: ImageState;
  onRatioChange: (ratio: number) => void;
};

export function ImageCard({ image, state, onRatioChange }: Props) {
  const pct = Math.round(state.ratio * 100);
  const delta =
    state.estimatedSize != null
      ? state.estimatedSize - image.originalSize
      : null;
  const savingsPct =
    state.estimatedSize != null && image.originalSize > 0
      ? Math.round(
          ((image.originalSize - state.estimatedSize) / image.originalSize) *
            100
        )
      : null;

  const isSvg = image.ext === "svg";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {isSvg ? (
          <div className="flex h-full w-full items-center justify-center text-zinc-400">
            <ImageIcon className="h-10 w-10" />
          </div>
        ) : (
          <Image
            src={image.previewUrl}
            alt={image.name}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )}
        <div className="absolute left-3 top-3 inline-flex max-w-[75%] items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <span className="truncate">{image.name}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Original
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatBytes(image.originalSize)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Estimated
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
              {state.isEstimating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                  <span className="text-zinc-400">calculating</span>
                </>
              ) : state.estimateError ? (
                <span className="text-red-500">error</span>
              ) : state.estimatedSize != null ? (
                <>
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {formatBytes(state.estimatedSize)}
                  </span>
                  {delta != null && (
                    <span
                      className={
                        delta < 0
                          ? "inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                          : "inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                      }
                    >
                      {delta < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {savingsPct != null && savingsPct > 0
                        ? `-${savingsPct}%`
                        : savingsPct != null
                        ? `+${Math.abs(savingsPct)}%`
                        : ""}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-zinc-400">&ndash;</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              Quality
            </span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {pct}%
            </span>
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
          {isSvg && (
            <p className="mt-2 text-[11px] text-zinc-400">
              Vector (.svg) assets aren&apos;t re-encoded.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
