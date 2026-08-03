"use client";

// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState } from "react";

import type { GridSchema } from "@/lib/api/schemas";
import type { Wavepacket } from "@/lib/ws";
import { useEvolveRun } from "@/lib/use-evolve-run";

export interface BarrierScatteringProps {
  params?: { height: number; width: number; x0?: number };
  wavepacket?: Wavepacket;
  tMax?: number;
  dt?: number;
  nFrames?: number;
  grid?: GridSchema;
  height?: number;
  caption?: string;
}

export function BarrierScattering(props: BarrierScatteringProps) {
  const [runKey, setRunKey] = useState(0);
  return (
    <BarrierScatteringRun
      key={runKey}
      {...props}
      onReplay={() => setRunKey((k) => k + 1)}
    />
  );
}

function BarrierScatteringRun({
  params = { height: 5.0, width: 1.0, x0: 0.0 },
  wavepacket = { x0: -8.0, k0: 2.0, sigma: 1.0 },
  tMax = 9.0,
  dt = 0.005,
  nFrames = 110,
  grid = { x_min: -30, x_max: 30, n_points: 2048 },
  height = 320,
  caption,
  onReplay,
}: BarrierScatteringProps & { onReplay: () => void }) {
  const { metadata, framesRef, bufferedCount, status, error } = useEvolveRun({
    potential: { type: "barrier", params },
    wavepacket,
    tMax,
    dt,
    nFrames,
    grid,
  });

  const xLeft = (params.x0 ?? 0) - params.width / 2;
  const xRight = (params.x0 ?? 0) + params.width / 2;

  // Precompute the index split points once the grid is known, so each frame
  // only needs two trapezoidal sums instead of filtering the array.
  const bounds = useMemo(() => {
    if (!metadata) return null;
    const x = metadata.x;
    let leftIdx = 0;
    while (leftIdx < x.length && x[leftIdx] < xLeft) leftIdx++;
    let rightIdx = x.length - 1;
    while (rightIdx >= 0 && x[rightIdx] > xRight) rightIdx--;
    return { leftIdx, rightIdx };
  }, [metadata, xLeft, xRight]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (!metadata) return;
    setFrameIdx(0);
  }, [metadata]);

  useEffect(() => {
    if (!metadata || bufferedCount === 0) return;
    const frameDurationMs =
      (metadata.t_max / Math.max(1, metadata.n_frames - 1)) * 1000;
    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - last;
      const advance = Math.floor(elapsed / frameDurationMs);
      if (advance > 0) {
        last = now;
        // Cap at bufferedCount - 1 (what we actually have), never at
        // metadata.n_frames - 1: if the two ever disagree, falling back to
        // the smaller one would snap playback backward once it reaches the
        // true end, then advance forward and snap back again -- an
        // infinite loop right at the finish.
        setFrameIdx((i) => Math.min(i + advance, bufferedCount - 1));
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [metadata, bufferedCount, status]);

  useEffect(() => {
    if (!metadata || !bounds) return;
    draw(canvasRef.current, metadata, framesRef.current, frameIdx, bounds);
  }, [metadata, bounds, framesRef, frameIdx]);

  // Latest draw inputs by ref so the ResizeObserver below can be created
  // once (on mount) instead of being torn down and recreated on every
  // animation tick -- ResizeObserver.observe() fires once immediately, so
  // depending on frameIdx meant a full resize-observer churn ~60 times/sec.
  const latestRef = useRef({ metadata, bounds, frameIdx });
  latestRef.current = { metadata, bounds, frameIdx };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas(canvas);
      const { metadata, bounds, frameIdx } = latestRef.current;
      if (metadata && bounds) {
        draw(canvas, metadata, framesRef.current, frameIdx, bounds);
      }
    });
    observer.observe(canvas);
    sizeCanvas(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frame = framesRef.current[Math.min(frameIdx, framesRef.current.length - 1)];
  const fractions =
    frame && bounds
      ? {
          reflected: trapz(frame.probability_density, metadata!.x, 0, bounds.leftIdx),
          transmitted: trapz(
            frame.probability_density,
            metadata!.x,
            bounds.rightIdx,
            metadata!.x.length - 1,
          ),
        }
      : null;

  const isFinished = status === "ready" && frameIdx >= bufferedCount - 1;
  const predicted = metadata?.predicted_transmission ?? null;
  const meanEnergyT = metadata?.mean_energy_transmission ?? null;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="relative" style={{ height }}>
        <canvas ref={canvasRef} className="block h-full w-full" />
        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <Spinner /> Connecting…
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
            {error?.message ?? "Evolution failed"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-surface/40 px-4 py-3 text-xs">
        <Readout label="reflected" color="rgb(255,170,110)" value={fractions?.reflected} />
        <Readout label="transmitted" color="rgb(124,160,255)" value={fractions?.transmitted} />
        <button
          type="button"
          onClick={onReplay}
          className="ml-auto rounded px-2 py-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          ↻ Replay
        </button>
      </div>

      {(meanEnergyT !== null || predicted !== null) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted">
          {meanEnergyT !== null && (
            <span>
              T(mean energy) ={" "}
              <span className="font-mono text-foreground">{meanEnergyT.toFixed(3)}</span>
            </span>
          )}
          {predicted !== null && (
            <span>
              predicted (energy-averaged) ={" "}
              <span className="font-mono text-foreground">{predicted.toFixed(3)}</span>
            </span>
          )}
          {isFinished && fractions && (
            <span>
              measured ={" "}
              <span className="font-mono text-foreground">
                {fractions.transmitted.toFixed(3)}
              </span>
            </span>
          )}
        </div>
      )}

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Readout({
  label,
  color,
  value,
}: {
  label: string;
  color: string;
  value?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-muted">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label} = <span className="text-foreground">{value !== undefined ? value.toFixed(3) : "–"}</span>
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-foreground"
    />
  );
}

function trapz(y: number[], x: number[], start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += ((y[i] + y[i + 1]) / 2) * (x[i + 1] - x[i]);
  }
  return sum;
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(
  canvas: HTMLCanvasElement | null,
  metadata: { x: number[] },
  frames: { probability_density: number[] }[],
  frameIdx: number,
  bounds: { leftIdx: number; rightIdx: number },
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const x = metadata.x;
  const xMin = x[0];
  const xMax = x[x.length - 1];
  const xToPx = (v: number) => ((v - xMin) / (xMax - xMin)) * w;
  const xLeftPx = xToPx(x[bounds.leftIdx]);
  const xRightPx = xToPx(x[bounds.rightIdx]);

  // Static background zones
  ctx.fillStyle = "rgba(255,170,110,0.07)";
  ctx.fillRect(0, 0, xLeftPx, h);
  ctx.fillStyle = "rgba(124,160,255,0.07)";
  ctx.fillRect(xRightPx, 0, w - xRightPx, h);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(xLeftPx, 0, xRightPx - xLeftPx, h);

  ctx.fillStyle = "rgba(200,205,215,0.55)";
  ctx.font = '600 10px var(--font-geist-mono), ui-monospace, monospace';
  ctx.textAlign = "left";
  ctx.fillText("reflected", 8, 14);
  ctx.textAlign = "right";
  ctx.fillText("transmitted", w - 8, 14);

  const frame = frames[Math.min(frameIdx, frames.length - 1)];
  if (!frame) return;
  const prob = frame.probability_density;

  const padTop = 24;
  const probArea = h - padTop - 10;

  // One shared vertical scale across the whole grid, so the two sides are
  // directly comparable: the transmitted lobe really is a fraction of the
  // reflected one. (The barrier is chosen thin enough that this fraction is
  // clearly visible -- scaling each side independently would be a lie.)
  let pMax = 0;
  for (const p of prob) if (p > pMax) pMax = p;
  const toY = (p: number) => padTop + probArea - (p / (pMax || 1)) * probArea;

  const drawSegment = (
    startIdx: number,
    endIdx: number,
    stroke: string,
    fillNear: string,
    fillFar: string,
  ) => {
    if (endIdx <= startIdx) return;

    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + probArea);
    gradient.addColorStop(0, fillNear);
    gradient.addColorStop(1, fillFar);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(xToPx(x[startIdx]), padTop + probArea);
    for (let k = startIdx; k <= endIdx; k++) ctx.lineTo(xToPx(x[k]), toY(prob[k]));
    ctx.lineTo(xToPx(x[endIdx]), padTop + probArea);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let k = startIdx; k <= endIdx; k++) {
      const px = xToPx(x[k]);
      const py = toY(prob[k]);
      if (k === startIdx) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };

  drawSegment(
    0,
    bounds.leftIdx,
    "rgba(255,170,110,0.95)",
    "rgba(255,170,110,0.45)",
    "rgba(255,170,110,0.03)",
  );
  drawSegment(
    bounds.rightIdx,
    x.length - 1,
    "rgba(124,160,255,0.98)",
    "rgba(124,160,255,0.55)",
    "rgba(124,160,255,0.03)",
  );
}
