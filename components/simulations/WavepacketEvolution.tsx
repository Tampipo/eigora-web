"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  GridSchema,
  PotentialSchema,
  PotentialSchemaParams,
  PotentialType,
  TrajectoryResponse,
} from "@/lib/api/schemas";
import {
  type EvolveFrameMessage,
  type EvolveMetadataMessage,
  type Wavepacket,
} from "@/lib/ws";
import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";
import { useDebouncedValue } from "@/lib/use-debounced";
import { useEvolveRun } from "@/lib/use-evolve-run";
import { useTrajectory } from "@/lib/use-trajectory";

export interface WavepacketEvolutionProps {
  potential: PotentialType;
  params?: PotentialSchemaParams;
  wavepacket?: Wavepacket;
  tMax?: number;
  dt?: number;
  nFrames?: number;
  grid?: GridSchema;
  height?: number;
  caption?: string;
}

const SPEED_STOPS = [0.25, 0.5, 1, 2, 4] as const;

// The solver grid, deliberately far wider than anything we draw. The
// propagator is FFT-based, so a packet that reaches the edge wraps around and
// silently corrupts the run; at these bounds the measured boundary leakage
// stays below 1e-6 across the whole slider range. The window actually drawn
// is a fraction of this -- see viewWindow below.
const WIDE_GRID: GridSchema = { x_min: -25, x_max: 25, n_points: 2048 };

export function WavepacketEvolution({
  potential,
  params: initialParams,
  wavepacket: initialWavepacket,
  tMax: initialTMax = 10,
  dt = 0.01,
  nFrames: initialNFrames = 120,
  grid,
  height = 340,
  caption,
}: WavepacketEvolutionProps) {
  const [potParams, setPotParams] = useState<PotentialSchemaParams>(
    initialParams ?? defaultParamsFor(potential),
  );
  const [wavepacket, setWavepacket] = useState<Wavepacket>(
    initialWavepacket ?? { x0: 2.5, k0: 0, sigma: 0.7071 },
  );
  const [tMax, setTMax] = useState<number>(initialTMax);
  const [nFrames, setNFrames] = useState<number>(initialNFrames);

  useEffect(() => {
    setPotParams(initialParams ?? defaultParamsFor(potential));
    setWavepacket(initialWavepacket ?? { x0: 2.5, k0: 0, sigma: 0.7071 });
    setTMax(initialTMax);
    setNFrames(initialNFrames);
  }, [potential, initialParams, initialWavepacket, initialTMax, initialNFrames]);

  const debouncedPotParams = useDebouncedValue(potParams, 300);
  const debouncedWavepacket = useDebouncedValue(wavepacket, 300);
  const debouncedTMax = useDebouncedValue(tMax, 300);
  const debouncedNFrames = useDebouncedValue(nFrames, 300);

  const potentialSchema = useMemo<PotentialSchema>(
    () => ({ type: potential, params: debouncedPotParams }),
    [potential, debouncedPotParams],
  );

  const solverGrid = grid ?? WIDE_GRID;

  // Where the packet is, over time. Every physical number on this figure
  // comes from here or from the stream below — nothing is recomputed locally.
  const { data: traj, error: trajError } = useTrajectory({
    potential: potentialSchema,
    wavepacket: debouncedWavepacket,
    tMax: debouncedTMax,
    dt,
    nFrames: debouncedNFrames,
    grid: solverGrid,
    includeClassical: true,
  });

  // How much of the grid to draw. Purely a framing decision.
  //
  // Symmetric about the origin, because the wells this figure supports are:
  // half a well is not a well, and a lopsided window makes the parabola read
  // as a diagonal line with one wall missing. The half-width covers the
  // furthest the packet's centre gets, plus its own tails, so the whole
  // excursion stays in frame — but it is never narrower than the well itself
  // needs to look like a well.
  const viewWindow = useMemo<[number, number] | undefined>(() => {
    if (!traj) return undefined;
    let reach = 0;
    for (const x of traj.mean_position) reach = Math.max(reach, Math.abs(x));
    const half = reach + 3 * debouncedWavepacket.sigma;
    const limit = Math.min(
      Math.abs(solverGrid.x_min ?? -25),
      Math.abs(solverGrid.x_max ?? 25),
    );
    return [-Math.min(half, limit), Math.min(half, limit)];
  }, [traj, debouncedWavepacket.sigma, solverGrid.x_min, solverGrid.x_max]);

  const { metadata, framesRef, bufferedCount, totalFrames, status, error } =
    useEvolveRun({
      potential: potentialSchema,
      wavepacket: debouncedWavepacket,
      tMax: debouncedTMax,
      dt,
      nFrames: debouncedNFrames,
      grid: solverGrid,
      viewWindow,
    });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<HTMLCanvasElement | null>(null);
  const momentumRef = useRef<HTMLCanvasElement | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(true);

  useEffect(() => {
    if (!metadata) return;
    setFrameIdx(0);
    setPlaying(true);
  }, [metadata]);

  useEffect(() => {
    if (!metadata || !playing || bufferedCount === 0) return;
    const frameDurationMs =
      (metadata.t_max / Math.max(1, metadata.n_frames - 1)) * 1000;
    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - last;
      const advance = Math.floor((elapsed * speed) / frameDurationMs);
      if (advance > 0) {
        last = now;
        setFrameIdx((i) => {
          const next = i + advance;
          const lastBuffered = bufferedCount - 1;
          if (next > lastBuffered) {
            if (status === "ready" && next >= metadata.n_frames - 1) {
              if (loop) return next % metadata.n_frames;
              setPlaying(false);
              return metadata.n_frames - 1;
            }
            return lastBuffered;
          }
          return next;
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [metadata, playing, speed, loop, bufferedCount, status]);

  // ── Drawing ───────────────────────────────────────────────────────────────
  const latest = useRef({ metadata, traj, frameIdx });
  latest.current = { metadata, traj, frameIdx };

  const paint = (
    well: HTMLCanvasElement | null,
    track: HTMLCanvasElement | null,
    momentum: HTMLCanvasElement | null,
    md: EvolveMetadataMessage,
    tr: TrajectoryResponse,
    idx: number,
  ) => {
    drawWell(well, md, framesRef.current, idx, tr);
    drawSeries(
      track,
      tr.times,
      tr.mean_position,
      tr.classical_position ?? null,
      "⟨x⟩(t)",
      idx,
    );
    drawSeries(
      momentum,
      tr.times,
      tr.mean_momentum,
      tr.classical_momentum ?? null,
      "⟨p⟩(t)",
      idx,
    );
  };

  useEffect(() => {
    if (!metadata || !traj) return;
    paint(
      canvasRef.current,
      trackRef.current,
      momentumRef.current,
      metadata,
      traj,
      frameIdx,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata, traj, framesRef, frameIdx]);

  useEffect(() => {
    const well = canvasRef.current;
    const track = trackRef.current;
    const momentum = momentumRef.current;
    if (!well || !track || !momentum) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas(well);
      sizeCanvas(track);
      sizeCanvas(momentum);
      const { metadata, traj, frameIdx } = latest.current;
      if (metadata && traj) paint(well, track, momentum, metadata, traj, frameIdx);
    });
    observer.observe(well);
    observer.observe(track);
    observer.observe(momentum);
    sizeCanvas(well);
    sizeCanvas(track);
    sizeCanvas(momentum);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framesRef]);

  const tNow =
    framesRef.current[frameIdx]?.t ??
    (metadata
      ? (frameIdx / Math.max(1, metadata.n_frames - 1)) * metadata.t_max
      : 0);
  const seekMax = Math.max(0, bufferedCount - 1);
  const expectedTotal = totalFrames || nFrames;
  const streamingPct = expectedTotal
    ? Math.min(100, (bufferedCount / expectedTotal) * 100)
    : 0;

  const seek = (i: number) => setFrameIdx(Math.max(0, Math.min(seekMax, i)));

  const spread = traj?.spread_position?.[frameIdx];
  const spreadP = traj?.spread_momentum?.[frameIdx];
  const product = traj?.uncertainty_product?.[frameIdx];

  // σ₀ = √(ħ/2mω) = 1/√(2ω), the ground-state width — the closed form quoted
  // in the page text, not a second implementation of anything the API solves.
  const omega = (potParams as Record<string, number | undefined> | null)?.omega;
  const coherent =
    potential === "harmonic" && typeof omega === "number" && omega > 0
      ? 1 / Math.sqrt(2 * omega)
      : null;
  const isCoherent =
    coherent !== null && Math.abs(debouncedWavepacket.sigma - coherent) < 0.02;
  const leaking = (traj?.boundary_leakage ?? 0) > 1e-3;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="flex flex-col">
          <div className="relative" style={{ height }}>
            <canvas
              ref={canvasRef}
              className="block h-full w-full"
              aria-label="Probability density of the wavepacket inside the potential well, drawn on its energy level"
            />
            {(status === "connecting" || (!traj && !trajError)) && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Solving…
                </span>
              </div>
            )}
            {(status === "error" || trajError) && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
                {error?.message ?? trajError?.message ?? "Evolution failed"}
              </div>
            )}
          </div>

          {/* <x>(t) and <p>(t) on a shared time axis: momentum lags position
              by a quarter period, which is only legible if they line up. */}
          <div className="relative border-t border-border" style={{ height: 88 }}>
            <canvas
              ref={trackRef}
              className="block h-full w-full"
              aria-label="Mean position over time, compared with the classical trajectory"
            />
          </div>
          <div className="relative border-t border-border" style={{ height: 88 }}>
            <canvas
              ref={momentumRef}
              className="block h-full w-full"
              aria-label="Mean momentum over time, compared with the classical trajectory"
            />
          </div>

          <div className="relative">
            {status === "streaming" && (
              <div
                aria-hidden
                className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-accent/15"
                style={{ width: `${streamingPct}%` }}
              />
            )}
            <input
              type="range"
              min={0}
              max={seekMax}
              step={1}
              value={Math.min(frameIdx, seekMax)}
              disabled={!metadata || bufferedCount === 0}
              onChange={(e) => {
                if (playing) setPlaying(false);
                seek(Number(e.target.value));
              }}
              className="ui-slider relative block w-full"
              style={{
                ["--pct" as string]: `${
                  seekMax ? (Math.min(frameIdx, seekMax) / seekMax) * 100 : 0
                }%`,
              }}
              aria-label="Seek frame"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
            <div className="flex items-center gap-0.5">
              <IconButton onClick={() => seek(0)} disabled={!metadata} label="Jump to start">
                ⏮
              </IconButton>
              <IconButton
                onClick={() => setPlaying((p) => !p)}
                disabled={!metadata || bufferedCount === 0}
                label={playing ? "Pause" : "Play"}
                primary
              >
                {playing ? "⏸" : "▶"}
              </IconButton>
              <IconButton
                onClick={() => seek(seekMax)}
                disabled={!metadata}
                label="Jump to buffered end"
              >
                ⏭
              </IconButton>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
              <span>
                t = <span className="text-foreground">{tNow.toFixed(2)}</span>
              </span>
              {traj && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    E = <span className="text-foreground">{traj.energy.toFixed(3)}</span>
                  </span>
                </>
              )}
              {typeof spread === "number" && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    Δx = <span className="text-foreground">{spread.toFixed(3)}</span>
                  </span>
                </>
              )}
              {typeof spreadP === "number" && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    Δp = <span className="text-foreground">{spreadP.toFixed(3)}</span>
                  </span>
                </>
              )}
              {typeof product === "number" && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    ΔxΔp ={" "}
                    <span className={product < 0.505 ? "text-accent" : "text-foreground"}>
                      {product.toFixed(3)}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer select-none items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                  className="accent-accent"
                />
                <span>loop</span>
              </label>
              <SpeedControl value={speed} onChange={setSpeed} />
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t border-border p-4 lg:border-l lg:border-t-0">
          <Section title="Potential">
            <PotentialSliders
              potential={potential}
              params={potParams}
              onChange={setPotParams}
            />
          </Section>

          <Section title="Wavepacket">
            <Slider
              label={<Tex>{`x_0`}</Tex>}
              hint="start"
              value={wavepacket.x0}
              onChange={(v) => setWavepacket({ ...wavepacket, x0: v })}
              min={-4}
              max={4}
              step={0.1}
            />
            <Slider
              label={<Tex>{`k_0`}</Tex>}
              hint="momentum"
              value={wavepacket.k0}
              onChange={(v) => setWavepacket({ ...wavepacket, k0: v })}
              min={-3}
              max={3}
              step={0.1}
            />
            <Slider
              label={<Tex>{`\\sigma`}</Tex>}
              hint="width"
              value={wavepacket.sigma}
              onChange={(v) => setWavepacket({ ...wavepacket, sigma: v })}
              min={0.3}
              max={2}
              step={0.01}
            />
            {coherent !== null && (
              <button
                type="button"
                onClick={() => setWavepacket({ ...wavepacket, sigma: round2(coherent) })}
                className={
                  "w-full rounded border px-2 py-1.5 text-left text-[10px] leading-snug transition-colors " +
                  (isCoherent
                    ? "border-accent/40 bg-accent/10 text-foreground"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground")
                }
              >
                {isCoherent ? (
                  <>
                    <span className="font-medium">Coherent state.</span> Shape is
                    preserved; ΔxΔp sits on ℏ/2.
                  </>
                ) : (
                  <>
                    Set σ = {coherent.toFixed(3)} for the{" "}
                    <span className="font-medium">coherent state</span>
                  </>
                )}
              </button>
            )}
          </Section>

          <Section title="Simulation">
            <Slider
              label={<Tex>{`t_{\\max}`}</Tex>}
              value={tMax}
              onChange={setTMax}
              min={2}
              max={30}
              step={0.5}
            />
            <Slider
              label={<Tex>{`N_{\\text{frames}}`}</Tex>}
              value={nFrames}
              onChange={(v) => setNFrames(Math.round(v))}
              min={20}
              max={200}
              step={10}
            />
          </Section>
        </div>
      </div>

      {leaking && (
        <p className="border-t border-border bg-red-500/5 px-4 py-2 text-xs text-red-400">
          The packet is reaching the edge of the solver grid ({(traj!.boundary_leakage * 100).toFixed(1)}
          % of |ψ|²). The propagator is periodic, so these numbers are no longer
          reliable — reduce t<sub>max</sub> or the starting energy.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <Legend />
        {metadata && (
          <span className="font-mono tabular-nums">
            solved on {solverGrid.n_points} pts · drawn {metadata.x.length}
          </span>
        )}
      </div>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Key color="rgb(190 197 210)" label="V(x)" dashed />
      <Key color="rgb(124 160 255)" label="|ψ(x,t)|², drawn on E" />
      <Key color="rgb(255 200 120)" label="⟨x⟩(t)" />
      <Key color="rgb(143 152 169)" label="classical" dashed />
    </div>
  );
}

function Key({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-[2px] w-5"
        style={{
          background: dashed
            ? `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 7px)`
            : color,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PotentialSliders({
  potential,
  params,
  onChange,
}: {
  potential: PotentialType;
  params: PotentialSchemaParams;
  onChange: (p: PotentialSchemaParams) => void;
}) {
  const set = (key: string, value: number) => {
    onChange({ ...(params ?? {}), [key]: value } as PotentialSchemaParams);
  };
  const p = (params ?? {}) as Record<string, number | undefined>;

  switch (potential) {
    // No x₀: shifting a parabola sideways moves the whole figure and changes
    // nothing physical. The range is capped where the grid stays safe.
    case "harmonic":
      return (
        <Slider
          label={<Tex>{`\\omega`}</Tex>}
          hint="frequency"
          value={p.omega ?? 1}
          onChange={(v) => set("omega", v)}
          min={0.5}
          max={2}
          step={0.05}
        />
      );
    case "double_well":
      return (
        <>
          <Slider
            label={<Tex>{`a`}</Tex>}
            value={p.a ?? 1}
            onChange={(v) => set("a", v)}
            min={0.1}
            max={5}
            step={0.05}
          />
          <Slider
            label={<Tex>{`b`}</Tex>}
            value={p.b ?? 4}
            onChange={(v) => set("b", v)}
            min={0.5}
            max={10}
            step={0.1}
          />
        </>
      );
    default:
      return <p className="text-xs text-muted">No tunable parameters.</p>;
  }
}

function defaultParamsFor(p: PotentialType): PotentialSchemaParams {
  switch (p) {
    case "harmonic":
      return { omega: 1.0 };
    case "double_well":
      return { a: 1.0, b: 4.0 };
    default:
      return null;
  }
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-foreground"
    />
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors " +
        (primary
          ? "text-foreground hover:bg-surface disabled:opacity-40"
          : "text-muted hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted")
      }
    >
      {children}
    </button>
  );
}

function SpeedControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {SPEED_STOPS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={
            "rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors " +
            (s === value ? "bg-surface text-foreground" : "text-muted hover:text-foreground")
          }
          aria-pressed={s === value}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}

// ── Canvas ──────────────────────────────────────────────────────────────────

function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

/**
 * One physical picture: energy up, position across.
 *
 * V(x) is the well, E is the level the packet sits on, and |ψ(x,t)|² rides on
 * that level the way a textbook draws it — so the figure reads as "a particle
 * of this energy, sloshing between these turning points", rather than as two
 * unrelated curves stacked on top of each other.
 */
function drawWell(
  canvas: HTMLCanvasElement | null,
  metadata: EvolveMetadataMessage,
  frames: EvolveFrameMessage[],
  i: number,
  traj: TrajectoryResponse,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const xs = metadata.x;
  const V = metadata.potential;
  if (xs.length < 2) return;

  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const E = traj.energy;

  // Vertical extent: floor of the well up to as far above E as E is above the
  // floor, which leaves the density room without shrinking the well.
  let vMin = Infinity;
  for (const v of V) if (v < vMin) vMin = v;
  const span = Math.max(E - vMin, 1e-3);
  const eMin = vMin - 0.12 * span;
  const eMax = E + span;

  const padL = 8;
  const padR = 8;
  const padTop = 10;
  const padBottom = 26;
  const plotW = w - padL - padR;
  const plotH = h - padTop - padBottom;

  const xToPx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const eToPy = (e: number) =>
    padTop + plotH - ((e - eMin) / (eMax - eMin)) * plotH;

  // x-axis ticks
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padTop + plotH);
  ctx.lineTo(padL + plotW, padTop + plotH);
  ctx.stroke();

  ctx.fillStyle = "rgb(99 108 126)";
  ctx.font = `10.5px ${MONO}`;
  ctx.textAlign = "center";
  for (const tick of niceTicks(xMin, xMax, 7)) {
    const px = xToPx(tick);
    ctx.fillText(formatTick(tick), px, padTop + plotH + 15);
  }

  // Energy level, spanning the classically allowed region. The crossings are
  // read off the V(x) samples being drawn, so the markers land exactly on the
  // curve instead of near it.
  const [tpLo, tpHi] = crossingsAt(xs, V, E);
  const eY = eToPy(E);
  ctx.strokeStyle = "rgba(255, 200, 120, 0.5)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xToPx(tpLo), eY);
  ctx.lineTo(xToPx(tpHi), eY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Turning points: where the level meets the wall
  ctx.fillStyle = "rgba(255, 200, 120, 0.85)";
  for (const tp of [tpLo, tpHi]) {
    ctx.beginPath();
    ctx.arc(xToPx(tp), eY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // V(x)
  ctx.strokeStyle = "rgba(190,197,210,0.55)";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let k = 0; k < xs.length; k++) {
    const py = eToPy(V[k]);
    if (k === 0) ctx.moveTo(xToPx(xs[k]), py);
    else ctx.lineTo(xToPx(xs[k]), py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const frame = frames[Math.min(i, frames.length - 1)];
  if (frame) {
    const prob = frame.probability_density;
    const pMax = computePMaxRunning(frames);
    // Density sits on the energy line and reaches at most 80% of the way to
    // the top of the frame, so a breathing packet never leaves the picture.
    const probToPy = (p: number) =>
      eY - (p / pMax) * (eY - padTop) * 0.8;

    const gradient = ctx.createLinearGradient(0, padTop, 0, eY);
    gradient.addColorStop(0, "rgba(124, 160, 255, 0.5)");
    gradient.addColorStop(1, "rgba(124, 160, 255, 0.04)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(xToPx(xs[0]), eY);
    for (let k = 0; k < xs.length; k++) ctx.lineTo(xToPx(xs[k]), probToPy(prob[k]));
    ctx.lineTo(xToPx(xs[xs.length - 1]), eY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(140, 172, 255, 0.98)";
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let k = 0; k < xs.length; k++) {
      const px = xToPx(xs[k]);
      const py = probToPy(prob[k]);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // <x>(t): the marker that makes the motion legible as a particle
  const meanX = traj.mean_position[Math.min(i, traj.mean_position.length - 1)];
  if (typeof meanX === "number") {
    const px = xToPx(meanX);
    ctx.strokeStyle = "rgba(255, 200, 120, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, eY);
    ctx.lineTo(px, padTop + plotH);
    ctx.stroke();

    ctx.fillStyle = "rgb(255, 200, 120)";
    ctx.beginPath();
    ctx.arc(px, eY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(143,152,169,0.9)";
  ctx.font = `600 10.5px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillText(`E = ${E.toFixed(2)}`, padL + 2, eY - 6);
}

/**
 * A quantum expectation value over time, against its classical counterpart.
 *
 * Used for both <x>(t) and <p>(t). Drawn on a shared time axis so the quarter
 * period by which momentum lags position is readable straight off the pair.
 */
function drawSeries(
  canvas: HTMLCanvasElement | null,
  t: number[],
  q: number[],
  cl: number[] | null,
  label: string,
  i: number,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  if (t.length < 2 || q.length < 2) return;

  const padL = 8;
  const padR = 8;
  const padTop = 16;
  const padBottom = 12;
  const plotW = w - padL - padR;
  const plotH = h - padTop - padBottom;

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of q) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (cl) for (const v of cl) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const pad = Math.max((hi - lo) * 0.15, 0.05);
  lo -= pad;
  hi += pad;

  const tToPx = (v: number) => padL + (v / t[t.length - 1]) * plotW;
  const xToPy = (v: number) => padTop + plotH - ((v - lo) / (hi - lo)) * plotH;

  // x = 0 baseline
  if (lo < 0 && hi > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, xToPy(0));
    ctx.lineTo(padL + plotW, xToPy(0));
    ctx.stroke();
  }

  // Classical path underneath, so any divergence shows as the quantum curve
  // lifting off it.
  if (cl) {
    ctx.strokeStyle = "rgba(143,152,169,0.75)";
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let k = 0; k < cl.length; k++) {
      const px = tToPx(t[k]);
      const py = xToPy(cl[k]);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "rgb(255, 200, 120)";
  ctx.lineWidth = 1.75;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let k = 0; k < q.length; k++) {
    const px = tToPx(t[k]);
    const py = xToPy(q[k]);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Playhead
  const idx = Math.min(i, q.length - 1);
  const px = tToPx(t[idx]);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, padTop);
  ctx.lineTo(px, padTop + plotH);
  ctx.stroke();

  ctx.fillStyle = "rgb(255, 200, 120)";
  ctx.beginPath();
  ctx.arc(px, xToPy(q[idx]), 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(143,152,169,0.9)";
  ctx.font = `600 10px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillText(label, padL + 2, 11);

  // Current value, so the panel is readable while paused.
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(232,235,242,0.85)";
  ctx.fillText(q[idx].toFixed(2), w - padR - 2, 11);
}

/**
 * Where the drawn V(x) crosses a level, innermost pair around the well floor.
 * Interpolated between samples so the marker sits on the line, not beside it.
 */
function crossingsAt(
  xs: number[],
  V: number[],
  level: number,
): [number, number] {
  let floor = 0;
  for (let i = 1; i < V.length; i++) if (V[i] < V[floor]) floor = i;

  const walk = (step: -1 | 1): number => {
    let i = floor;
    while (i + step >= 0 && i + step < V.length && V[i + step] <= level) i += step;
    const j = i + step;
    if (j < 0 || j >= V.length) return xs[i];
    const denom = V[j] - V[i];
    if (denom === 0) return xs[i];
    return xs[i] + ((level - V[i]) / denom) * (xs[j] - xs[i]);
  };

  return [walk(-1), walk(1)];
}

function niceTicks(min: number, max: number, target: number): number[] {
  const raw = (max - min) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out;
}

function formatTick(v: number): string {
  const r = Math.abs(v) < 1e-9 ? 0 : v;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Running pMax so the curve is not renormalised on every animation tick.
const PMAX_CACHE = new WeakMap<EvolveFrameMessage[], { count: number; pMax: number }>();
function computePMaxRunning(frames: EvolveFrameMessage[]): number {
  const cached = PMAX_CACHE.get(frames);
  let from = 0;
  let m = 0;
  if (cached && cached.count <= frames.length) {
    from = cached.count;
    m = cached.pMax;
  }
  for (let i = from; i < frames.length; i++) {
    for (const v of frames[i].probability_density) if (v > m) m = v;
  }
  m = m || 1;
  PMAX_CACHE.set(frames, { count: frames.length, pMax: m });
  return m;
}
