"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Wand2, Sparkles } from "lucide-react";

type GlobalControlsProps = {
  ratio: number;
  onRatioChange: (ratio: number) => void;
  onApplyToAll: () => void;
  disabled?: boolean;
};

export function GlobalControls({
  ratio,
  onRatioChange,
  onApplyToAll,
  disabled,
}: GlobalControlsProps) {
  const pct = Math.round(ratio * 100);

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800/80 dark:from-zinc-950 dark:to-zinc-900">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <Sparkles className="h-3 w-3" />
            Global settings
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Compression ratio
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Lower values shrink images more aggressively. Applies globally when
            you click the button.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {pct}%
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            quality
          </span>
        </div>
      </div>

      <div className="mt-6">
        <Slider
          value={pct}
          min={10}
          max={100}
          step={1}
          onValueChange={(v) => onRatioChange(v / 100)}
          aria-label="Global compression ratio"
        />
        <div className="mt-2 flex justify-between text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          <span>10%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onApplyToAll} disabled={disabled}>
          <Wand2 className="h-4 w-4" />
          Apply to all images
        </Button>
      </div>
    </div>
  );
}
