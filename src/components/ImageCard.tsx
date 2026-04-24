"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  Maximize2,
  Shapes,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatBytes } from "@/lib/utils";
import type { MediaImage } from "@/lib/pptx";
import type { CompressStatus } from "@/lib/image-compression";

export type ImageStatus = CompressStatus | "vector";

export type ImageState = {
  ratio: number;
  estimatedSize: number | null;
  isEstimating: boolean;
  estimateError: string | null;
  compressedPreviewUrl: string | null;
  status: ImageStatus | null;
};

type Props = {
  image: MediaImage;
  state: ImageState;
  onRatioChange: (ratio: number) => void;
  onOpen: () => void;
};

export function ImageCard({ image, state, onRatioChange, onOpen }: Props) {
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
  const previewSrc = state.compressedPreviewUrl ?? image.previewUrl;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950"
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:focus-visible:ring-zinc-300"
        aria-label={`View ${image.name}`}
      >
        {isSvg ? (
          <div className="flex h-full w-full items-center justify-center text-zinc-400">
            <ImageIcon className="h-10 w-10" />
          </div>
        ) : (
          <img
            src={previewSrc}
            alt={image.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )}
        <div className="absolute left-3 top-3 inline-flex max-w-[75%] items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <span className="truncate">{image.name}</span>
        </div>
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3 w-3" />
          Zoom
        </div>
        {state.isEstimating && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 text-[11px] font-medium text-white">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating preview
          </div>
        )}
      </button>

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
                  {delta != null && savingsPct != null && savingsPct > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <TrendingDown className="h-3 w-3" />
                      -{savingsPct}%
                    </span>
                  ) : state.status === "already-optimal" ||
                    state.status === "unchanged-max-quality" ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      <CheckCircle2 className="h-3 w-3" />
                      optimal
                    </span>
                  ) : state.status === "vector" ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      <Shapes className="h-3 w-3" />
                      vector
                    </span>
                  ) : delta != null && delta > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <TrendingUp className="h-3 w-3" />
                      +{Math.abs(savingsPct ?? 0)}%
                    </span>
                  ) : null}
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
          {isSvg ? (
            <p className="mt-2 text-[11px] text-zinc-400">
              Vector (.svg) assets aren&apos;t re-encoded.
            </p>
          ) : state.status === "already-optimal" ? (
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              Re-encoding would make this image larger, so the original is
              kept.
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
