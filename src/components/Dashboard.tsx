"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  Download,
  ImageOff,
  Loader2,
  RotateCcw,
  Zap,
} from "lucide-react";
import JSZip from "jszip";

import { GlobalControls } from "@/components/GlobalControls";
import { ImageCard, type ImageState } from "@/components/ImageCard";
import { ImageDetailModal } from "@/components/ImageDetailModal";
import { Button } from "@/components/ui/button";
import { compressImageBlob } from "@/lib/image-compression";
import {
  buildOptimizedPptx,
  triggerDownload,
  type MediaImage,
} from "@/lib/pptx";
import { formatBytes } from "@/lib/utils";

const DEBOUNCE_MS = 300;
const DEFAULT_RATIO = 0.5;

const SORT_OPTIONS = [
  {
    value: "name-asc",
    label: "Name (A to Z)",
    icon: ArrowDownAZ,
  },
  {
    value: "name-desc",
    label: "Name (Z to A)",
    icon: ArrowUpAZ,
  },
  {
    value: "size-desc",
    label: "Size (largest first)",
    icon: ArrowDownWideNarrow,
  },
  {
    value: "size-asc",
    label: "Size (smallest first)",
    icon: ArrowUpNarrowWide,
  },
  {
    value: "savings-desc",
    label: "Savings (largest first)",
    icon: ArrowDownWideNarrow,
  },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

function compareImagesBy(
  option: SortOption,
  states: Record<string, ImageState>
) {
  const collator = new Intl.Collator(undefined, { numeric: true });

  return (a: MediaImage, b: MediaImage): number => {
    switch (option) {
      case "name-asc":
        return collator.compare(a.name, b.name);
      case "name-desc":
        return collator.compare(b.name, a.name);
      case "size-desc":
        if (b.originalSize !== a.originalSize)
          return b.originalSize - a.originalSize;
        return collator.compare(a.name, b.name);
      case "size-asc":
        if (a.originalSize !== b.originalSize)
          return a.originalSize - b.originalSize;
        return collator.compare(a.name, b.name);
      case "savings-desc": {
        const savingsA =
          a.originalSize - (states[a.id]?.estimatedSize ?? a.originalSize);
        const savingsB =
          b.originalSize - (states[b.id]?.estimatedSize ?? b.originalSize);
        if (savingsA !== savingsB) return savingsB - savingsA;
        return collator.compare(a.name, b.name);
      }
      default:
        return 0;
    }
  };
}

type DashboardProps = {
  file: File;
  zip: JSZip;
  images: MediaImage[];
  onReset: () => void;
};

function makeInitialState(): ImageState {
  return {
    ratio: DEFAULT_RATIO,
    estimatedSize: null,
    isEstimating: false,
    estimateError: null,
    compressedPreviewUrl: null,
    status: null,
  };
}

export function Dashboard({ file, zip, images, onReset }: DashboardProps) {
  const [globalRatio, setGlobalRatio] = useState(DEFAULT_RATIO);
  const [states, setStates] = useState<Record<string, ImageState>>(() =>
    Object.fromEntries(images.map((img) => [img.id, makeInitialState()]))
  );
  const [compressedBlobs, setCompressedBlobs] = useState<Map<string, Blob>>(
    new Map()
  );
  const [exporting, setExporting] = useState(false);
  const [openImageId, setOpenImageId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const requestIds = useRef<Map<string, number>>(new Map());
  const previewUrls = useRef<Map<string, string>>(new Map());

  const setPreviewUrl = useCallback(
    (imageId: string, blob: Blob | null) => {
      const prev = previewUrls.current.get(imageId);
      if (prev) URL.revokeObjectURL(prev);
      if (!blob) {
        previewUrls.current.delete(imageId);
        return null;
      }
      const url = URL.createObjectURL(blob);
      previewUrls.current.set(imageId, url);
      return url;
    },
    []
  );

  const runEstimate = useCallback(
    (image: MediaImage, ratio: number) => {
      if (image.ext === "svg") {
        setStates((prev) => ({
          ...prev,
          [image.id]: {
            ...prev[image.id],
            estimatedSize: image.originalSize,
            isEstimating: false,
            estimateError: null,
            compressedPreviewUrl: null,
            status: "vector" as const,
          },
        }));
        setCompressedBlobs((prev) => {
          const next = new Map(prev);
          next.set(image.id, image.originalBlob);
          return next;
        });
        return;
      }

      const reqId = (requestIds.current.get(image.id) ?? 0) + 1;
      requestIds.current.set(image.id, reqId);

      setStates((prev) => ({
        ...prev,
        [image.id]: {
          ...prev[image.id],
          isEstimating: true,
          estimateError: null,
        },
      }));

      compressImageBlob(image.originalBlob, { ratio })
        .then((result) => {
          if (requestIds.current.get(image.id) !== reqId) return;
          const useCompressed = result.status === "compressed";
          const finalBlob = useCompressed ? result.blob : image.originalBlob;
          const previewUrl = setPreviewUrl(
            image.id,
            useCompressed ? result.blob : null
          );
          setCompressedBlobs((prev) => {
            const next = new Map(prev);
            next.set(image.id, finalBlob);
            return next;
          });
          setStates((prev) => ({
            ...prev,
            [image.id]: {
              ...prev[image.id],
              estimatedSize: finalBlob.size,
              isEstimating: false,
              estimateError: null,
              compressedPreviewUrl: previewUrl,
              status: result.status,
            },
          }));
        })
        .catch((err: unknown) => {
          if (requestIds.current.get(image.id) !== reqId) return;
          setStates((prev) => ({
            ...prev,
            [image.id]: {
              ...prev[image.id],
              isEstimating: false,
              estimateError:
                err instanceof Error ? err.message : "Compression failed",
            },
          }));
        });
    },
    [setPreviewUrl]
  );

  const scheduleEstimate = useCallback(
    (image: MediaImage, ratio: number) => {
      const existing = debounceTimers.current.get(image.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimers.current.delete(image.id);
        runEstimate(image, ratio);
      }, DEBOUNCE_MS);
      debounceTimers.current.set(image.id, timer);
    },
    [runEstimate]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      for (const image of images) {
        runEstimate(image, DEFAULT_RATIO);
      }
    }, 0);
    const timers = debounceTimers.current;
    const urls = previewUrls.current;
    return () => {
      clearTimeout(handle);
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, [images, runEstimate]);

  const handleRatioChange = useCallback(
    (imageId: string, ratio: number) => {
      setStates((prev) => ({
        ...prev,
        [imageId]: {
          ...prev[imageId],
          ratio,
          isEstimating: true,
        },
      }));
      const image = images.find((i) => i.id === imageId);
      if (image) scheduleEstimate(image, ratio);
    },
    [images, scheduleEstimate]
  );

  const handleApplyGlobal = useCallback(() => {
    setStates((prev) => {
      const next: Record<string, ImageState> = { ...prev };
      for (const img of images) {
        next[img.id] = {
          ...next[img.id],
          ratio: globalRatio,
          isEstimating: true,
        };
      }
      return next;
    });
    for (const img of images) scheduleEstimate(img, globalRatio);
  }, [globalRatio, images, scheduleEstimate]);

  const totals = useMemo(() => {
    const original = images.reduce((acc, i) => acc + i.originalSize, 0);
    let estimated = 0;
    let hasUnknown = false;
    for (const img of images) {
      const s = states[img.id];
      if (s?.estimatedSize != null) {
        estimated += s.estimatedSize;
      } else {
        estimated += img.originalSize;
        hasUnknown = true;
      }
    }
    const otherFiles = file.size - original;
    const pptEstimate = Math.max(otherFiles, 0) + estimated;
    return {
      originalPpt: file.size,
      estimatedPpt: pptEstimate,
      imagesOriginal: original,
      imagesEstimated: estimated,
      hasUnknown,
    };
  }, [file.size, images, states]);

  const savingsPct =
    totals.originalPpt > 0
      ? Math.round(
          ((totals.originalPpt - totals.estimatedPpt) / totals.originalPpt) *
            100
        )
      : 0;

  const handleDownload = useCallback(async () => {
    setExporting(true);
    try {
      const replacements = new Map<string, Blob>();
      for (const img of images) {
        const blob = compressedBlobs.get(img.id);
        if (blob) replacements.set(img.path, blob);
      }
      const outBlob = await buildOptimizedPptx(zip, replacements);
      const baseName = file.name.replace(/\.pptx$/i, "");
      triggerDownload(outBlob, `${baseName}_downsized.pptx`);
    } finally {
      setExporting(false);
    }
  }, [compressedBlobs, file.name, images, zip]);

  const anyEstimating = Object.values(states).some((s) => s.isEstimating);

  const sortedImages = useMemo(() => {
    return [...images].sort(compareImagesBy(sortOption, states));
  }, [images, sortOption, states]);

  const openImage = openImageId
    ? images.find((i) => i.id === openImageId) ?? null
    : null;
  const openState = openImageId ? states[openImageId] : undefined;

  if (images.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-16 text-center dark:border-zinc-800 dark:bg-zinc-950/60"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <ImageOff className="h-7 w-7 text-zinc-500" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
            No images found in this presentation
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            The uploaded file doesn&apos;t contain any images under{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-800">
              ppt/media/
            </code>
            . Try a different file.
          </p>
        </div>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Upload another file
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SummaryStat
          label="Original PPT size"
          value={formatBytes(totals.originalPpt)}
          caption={file.name}
        />
        <SummaryStat
          label="Estimated new size"
          value={formatBytes(totals.estimatedPpt)}
          caption={
            totals.hasUnknown || anyEstimating
              ? "Refining estimate..."
              : "Based on current settings"
          }
          highlight
        />
        <SummaryStat
          label="Estimated savings"
          value={
            totals.originalPpt > totals.estimatedPpt
              ? `${savingsPct}% (${formatBytes(
                  totals.originalPpt - totals.estimatedPpt
                )})`
              : "None yet"
          }
          caption={
            totals.originalPpt > totals.estimatedPpt
              ? "Smaller is better"
              : "Try lower quality"
          }
        />
        <SummaryStat
          label="Images"
          value={String(images.length)}
          caption={`${formatBytes(totals.imagesOriginal)} in media`}
        />
      </motion.div>

      <GlobalControls
        ratio={globalRatio}
        onRatioChange={setGlobalRatio}
        onApplyToAll={handleApplyGlobal}
        disabled={anyEstimating}
      />

      <div className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            New file
          </Button>
          {anyEstimating && (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating estimates
            </span>
          )}
        </div>
        <Button
          size="lg"
          onClick={handleDownload}
          disabled={exporting || anyEstimating}
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building .pptx
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download optimized PPT
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {images.length} {images.length === 1 ? "image" : "images"}
        </div>
        <SortControl value={sortOption} onChange={setSortOption} />
      </div>

      <motion.div
        layout
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {sortedImages.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            state={states[image.id]}
            onRatioChange={(ratio) => handleRatioChange(image.id, ratio)}
            onOpen={() => setOpenImageId(image.id)}
          />
        ))}
      </motion.div>

      <ImageDetailModal
        image={openImage}
        state={openState}
        onClose={() => setOpenImageId(null)}
        onRatioChange={(ratio) =>
          openImage && handleRatioChange(openImage.id, ratio)
        }
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  caption,
  highlight,
}: {
  label: string;
  value: string;
  caption?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-zinc-950/10 bg-zinc-950 p-5 text-white shadow-sm dark:border-white/10 dark:bg-white dark:text-zinc-950"
          : "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950"
      }
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {highlight && <Zap className="h-3 w-3" />}
        <span className={highlight ? "text-zinc-300 dark:text-zinc-600" : ""}>
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {caption && (
        <div
          className={
            highlight
              ? "mt-1 truncate text-xs text-zinc-400 dark:text-zinc-500"
              : "mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400"
          }
        >
          {caption}
        </div>
      )}
    </div>
  );
}

function SortControl({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  const active = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <label className="group relative inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:text-zinc-950 focus-within:ring-2 focus-within:ring-zinc-950 focus-within:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:text-white dark:focus-within:ring-zinc-300">
      <ActiveIcon className="h-3.5 w-3.5" />
      <span className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Sort by
      </span>
      <span className="text-zinc-900 dark:text-zinc-50">{active.label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        aria-label="Sort images"
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
