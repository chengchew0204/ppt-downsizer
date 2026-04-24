"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const percent = ((value - min) / (max - min)) * 100;

    return (
      <div className={cn("relative h-6 flex items-center", className)}>
        <div className="pointer-events-none absolute left-0 right-0 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div
          className="pointer-events-none absolute left-0 h-1.5 rounded-full bg-zinc-950 dark:bg-zinc-50 transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className={cn(
            "relative z-10 h-6 w-full appearance-none bg-transparent cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-950",
            "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "dark:[&::-webkit-slider-thumb]:border-zinc-50 dark:[&::-webkit-slider-thumb]:bg-zinc-950",
            "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-950 [&::-moz-range-thumb]:cursor-pointer",
            "dark:[&::-moz-range-thumb]:border-zinc-50 dark:[&::-moz-range-thumb]:bg-zinc-950",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";
