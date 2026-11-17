"use client";

import { Slider } from "@/components/ui/slider";

type TuneSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  reset: number;
  onChange: (value: number) => void;
};

export function TuneSlider({
  label,
  value,
  min,
  max,
  step = 1,
  reset,
  onChange,
}: TuneSliderProps) {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <button
        type="button"
        className="font-mono text-[11px] text-foreground/80 tabular-nums"
        onClick={() => onChange(reset)}
        title="Сбросить"
      >
        {value > 0 ? `+${shown}` : shown}
      </button>
      <Slider
        className="col-span-2"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => {
          const resolved = Array.isArray(next) ? next[0] : next;
          if (typeof resolved === "number") onChange(resolved);
        }}
      />
    </label>
  );
}
