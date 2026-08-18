"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useId, type ReactNode } from "react";

export interface SliderProps {
  label: ReactNode;
  hint?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function Slider({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit,
  format,
  disabled,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : value.toFixed(step >= 1 ? 0 : 2);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 min-h-[18px]">
        <label
          htmlFor={id}
          className="slider-label inline-flex items-baseline gap-1.5 text-foreground"
        >
          {label}
          {hint && (
            <span className="slider-hint text-[11px] font-normal text-muted">
              {hint}
            </span>
          )}
        </label>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {display}
          {unit && <span className="ml-0.5">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ui-slider block w-full"
        style={{
          ["--pct" as string]: `${pct}%`,
        }}
      />
    </div>
  );
}
