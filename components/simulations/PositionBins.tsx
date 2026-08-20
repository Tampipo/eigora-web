"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";

// A fixed, closed-form example — two Gaussian lobes of opposite sign, so the
// picture makes the point that psi itself can go negative (only |psi|^2 is a
// density) and isn't just the symmetric ground state seen elsewhere. Nothing
// here needs the API: it's one formula, sampled at whatever resolution the
// figure asks for.
const X_MAX = 3.2;
function psiRaw(x: number): number {
  const bump = (center: number, width: number) => {
    const u = (x - center) / width;
    return Math.exp(-0.5 * u * u);
  };
  return bump(-1.3, 0.45) - 0.65 * bump(1.05, 0.6);
}

// Refinement runs in doublings of N — the same halving of Delta the text
// describes — from a handful of visibly blocky intervals up to where the
// bars are indistinguishable from the curve. The last step repeats once so
// the converged picture holds for a beat before the loop restarts.
const STEPS = [2, 4, 8, 16, 32, 64, 128, 256, 256];
const MS_PER_STEP = 900;

// Positive and negative lobes get the two hues already used for parity in
// FiniteWellGraphical — not a theme token, just this page's way of marking
// "two regimes" at a glance.
const POS_COLOR = "rgb(124 160 255)";
const NEG_COLOR = "rgb(255 170 110)";
const CURVE_COLOR = "rgb(232 235 242)";
const GRID_COLOR = "rgb(35 41 54)";
const AXIS_COLOR = "rgb(52 60 77)";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

const PAD_X = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;

export interface PositionBinsProps {
  height?: number;
  caption?: ReactNode;
}

export function PositionBins({ height = 300, caption }: PositionBinsProps) {
  // Sampled once at high resolution: every bar average and the reference
  // curve both read off this table rather than calling psiRaw() directly, so
  // refining N never re-normalises anything.
  const table = useMemo(() => buildTable(), []);

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const N = STEPS[stepIdx];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, MS_PER_STEP);
    return () => clearInterval(id);
  }, [playing]);

  const bars = useMemo(() => buildBars(table, N), [table, N]);
  const delta = (2 * X_MAX) / N;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef({ bars, table });
  latest.current = { bars, table };

  useEffect(() => {
    draw(canvasRef.current, bars, table);
  }, [bars, table]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas(canvas);
      const current = latest.current;
      draw(canvas, current.bars, current.table);
    });
    observer.observe(canvas);
    sizeCanvas(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div style={{ height }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label={`Wavefunction approximated by ${N} position intervals`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
        <PlayButton
          playing={playing}
          onClick={() => setPlaying((p) => !p)}
        />
        <div className="min-w-[180px] flex-1">
          <Slider
            label={<Tex>{`N`}</Tex>}
            hint={<span>intervals</span>}
            value={stepIdx}
            onChange={(v) => {
              setPlaying(false);
              setStepIdx(Math.round(v));
            }}
            min={0}
            max={STEPS.length - 1}
            step={1}
            format={() => `${N}`}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
          <Tex>{`\\Delta`}</Tex> = {delta.toFixed(3)}
        </span>
      </div>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

interface Table {
  /** Dense samples of psi over [-X_MAX, X_MAX], for the reference curve and
   *  for averaging into bars. */
  xs: Float64Array;
  ys: Float64Array;
  scale: number;
}

/** Normalises psiRaw so that integral |psi|^2 dx = 1 over the domain, once,
 *  by plain trapezoidal quadrature — the sample count is generous enough
 *  that the normalisation error is well under drawing precision. */
function buildTable(): Table {
  const n = 4000;
  const dx = (2 * X_MAX) / n;
  const raw = new Float64Array(n + 1);
  let normSq = 0;
  for (let i = 0; i <= n; i++) {
    const x = -X_MAX + i * dx;
    const v = psiRaw(x);
    raw[i] = v;
    const weight = i === 0 || i === n ? 0.5 : 1;
    normSq += weight * v * v * dx;
  }
  const norm = Math.sqrt(normSq);
  const xs = new Float64Array(n + 1);
  const ys = new Float64Array(n + 1);
  let scale = 0;
  for (let i = 0; i <= n; i++) {
    xs[i] = -X_MAX + i * dx;
    ys[i] = raw[i] / norm;
    scale = Math.max(scale, Math.abs(ys[i]));
  }
  return { xs, ys, scale };
}

interface Bar {
  x0: number;
  x1: number;
  /** Average of psi over [x0, x1] — this is c_n(Delta)/sqrt(Delta) in the
   *  text's notation. */
  height: number;
}

/** One bar per interval I_n(Delta), its height the mean of the dense table
 *  over that interval — the discrete stand-in for integrating psi. */
function buildBars(table: Table, N: number): Bar[] {
  const bars: Bar[] = [];
  const step = table.xs.length - 1;
  for (let n = 0; n < N; n++) {
    const x0 = -X_MAX + (n / N) * 2 * X_MAX;
    const x1 = -X_MAX + ((n + 1) / N) * 2 * X_MAX;
    const i0 = Math.round(((x0 + X_MAX) / (2 * X_MAX)) * step);
    const i1 = Math.round(((x1 + X_MAX) / (2 * X_MAX)) * step);
    let sum = 0;
    let count = 0;
    for (let i = i0; i <= i1; i++) {
      sum += table.ys[i];
      count++;
    }
    bars.push({ x0, x1, height: count ? sum / count : 0 });
  }
  return bars;
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Bars first, the true curve on top. At N = 2 the bars barely resemble psi;
 * by N = 256 they sit under the curve closely enough that the two are hard
 * to tell apart — that convergence is the whole figure.
 */
function draw(canvas: HTMLCanvasElement | null, bars: Bar[], table: Table) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const plotW = Math.max(10, rect.width - 2 * PAD_X);
  const plotH = Math.max(10, rect.height - PAD_TOP - PAD_BOTTOM);
  const yScale = table.scale * 1.2;
  const px = (x: number) => PAD_X + ((x + X_MAX) / (2 * X_MAX)) * plotW;
  const py = (y: number) => PAD_TOP + plotH / 2 - (y / yScale) * (plotH / 2);

  // Zero line.
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_X, py(0));
  ctx.lineTo(PAD_X + plotW, py(0));
  ctx.stroke();

  // Bars, each stroked at its own edges — the boundaries between I_n(Delta),
  // which is what visibly thins out as N grows.
  const y0 = py(0);
  for (const bar of bars) {
    const x0 = px(bar.x0);
    const x1 = px(bar.x1);
    const y1 = py(bar.height);
    ctx.fillStyle =
      bar.height >= 0 ? withAlpha(POS_COLOR, 0.55) : withAlpha(NEG_COLOR, 0.55);
    ctx.fillRect(x0, Math.min(y0, y1), Math.max(1, x1 - x0), Math.abs(y1 - y0));
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
  }

  // The target curve, drawn over the bars.
  ctx.strokeStyle = CURVE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < table.xs.length; i++) {
    const x = px(table.xs[i]);
    const y = py(table.ys[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = CURVE_COLOR;
  ctx.textAlign = "left";
  ctx.fillText("ψ(x)", PAD_X + 4, PAD_TOP + 10);
}

function withAlpha(rgb: string, alpha: number): string {
  return rgb.replace("rgb(", "rgba(").replace(")", ` / ${alpha})`);
}

// ── Chrome ──────────────────────────────────────────────────────────────────

function PlayButton({
  playing,
  onClick,
}: {
  playing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? "Pause" : "Play"}
      title={playing ? "Pause" : "Play"}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-foreground transition-colors hover:bg-surface"
    >
      {playing ? "⏸" : "▶"}
    </button>
  );
}
