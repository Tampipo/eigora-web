"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  GridSchema,
  PotentialSchema,
  PotentialSchemaParams,
  PotentialType,
} from "@/lib/api/schemas";
import {
  evolveWs,
  type EvolveFrameMessage,
  type EvolveMetadataMessage,
  type Wavepacket,
} from "@/lib/ws";
import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";
import { useDebouncedValue } from "@/lib/use-debounced";

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

export function WavepacketEvolution({
  potential,
  params: initialParams,
  wavepacket: initialWavepacket,
  tMax: initialTMax = 10,
  dt = 0.01,
  nFrames: initialNFrames = 120,
  grid,
  height = 300,
  caption,
}: WavepacketEvolutionProps) {
  const [potParams, setPotParams] = useState<PotentialSchemaParams>(
    initialParams ?? defaultParamsFor(potential),
  );
  const [wavepacket, setWavepacket] = useState<Wavepacket>(
    initialWavepacket ?? { x0: -5, k0: 1.5, sigma: 1 },
  );
  const [tMax, setTMax] = useState<number>(initialTMax);
  const [nFrames, setNFrames] = useState<number>(initialNFrames);

  useEffect(() => {
    setPotParams(initialParams ?? defaultParamsFor(potential));
    setWavepacket(initialWavepacket ?? { x0: -5, k0: 1.5, sigma: 1 });
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

  const {
    metadata,
    framesRef,
    bufferedCount,
    totalFrames,
    status,
    error,
  } = useEvolveRun({
    potential: potentialSchema,
    wavepacket: debouncedWavepacket,
    tMax: debouncedTMax,
    dt,
    nFrames: debouncedNFrames,
    grid,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(true);

  // Reset playback when a new stream starts (metadata identity flips)
  useEffect(() => {
    if (!metadata) return;
    setFrameIdx(0);
    setPlaying(true);
  }, [metadata]);

  // Animation tick — runs as soon as metadata arrives and >= 1 frame is buffered.
  // Pauses (without exposing it) when it catches the buffer head while streaming.
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

          // Cap at the buffer head — wait silently for more frames if streaming.
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

  const vRef = useMemo(() => vReferenceFor(potential), [potential]);

  // Redraw whenever the displayed frame changes
  useEffect(() => {
    if (!metadata) return;
    drawFrame(canvasRef.current, metadata, framesRef.current, frameIdx, vRef);
  }, [metadata, framesRef, frameIdx, vRef]);

  // Keep canvas HiDPI-correct + redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas(canvas);
      if (metadata) drawFrame(canvas, metadata, framesRef.current, frameIdx, vRef);
    });
    observer.observe(canvas);
    sizeCanvas(canvas);
    return () => observer.disconnect();
  }, [metadata, framesRef, frameIdx, vRef]);

  const tNow =
    framesRef.current[frameIdx]?.t ??
    (metadata
      ? (frameIdx / Math.max(1, metadata.n_frames - 1)) * metadata.t_max
      : 0);
  const tMaxLabel = metadata?.t_max ?? tMax;
  const norm = framesRef.current[frameIdx]?.norm;
  const seekMax = Math.max(0, bufferedCount - 1);
  const expectedTotal = totalFrames || nFrames;
  const streamingPct = expectedTotal
    ? Math.min(100, (bufferedCount / expectedTotal) * 100)
    : 0;

  const seek = (i: number) => {
    setFrameIdx(Math.max(0, Math.min(seekMax, i)));
  };

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/30">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="flex flex-col">
          <div className="relative" style={{ height }}>
            <canvas
              ref={canvasRef}
              className="block h-full w-full"
              aria-label="Wavepacket probability density |ψ(x,t)|² over time"
            />
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

          {/* Scrubber with streaming-progress fill behind the played portion */}
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
              <IconButton
                onClick={() => seek(0)}
                disabled={!metadata}
                label="Jump to start"
              >
                ⏮
              </IconButton>
              <IconButton
                onClick={() => seek(frameIdx - 1)}
                disabled={!metadata || frameIdx === 0}
                label="Previous frame"
              >
                ◀
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
                onClick={() => seek(frameIdx + 1)}
                disabled={!metadata || frameIdx >= seekMax}
                label="Next frame"
              >
                ▶
              </IconButton>
              <IconButton
                onClick={() => seek(seekMax)}
                disabled={!metadata}
                label="Jump to buffered end"
              >
                ⏭
              </IconButton>
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span>
                t = <span className="text-foreground">{tNow.toFixed(2)}</span> /{" "}
                {tMaxLabel.toFixed(2)}
              </span>
              <span className="text-border">·</span>
              <span>
                {frameIdx + 1}/{bufferedCount || "–"}
                {status === "streaming" &&
                  expectedTotal &&
                  bufferedCount < expectedTotal && (
                    <span className="ml-1 text-accent">
                      ({bufferedCount}/{expectedTotal} streaming)
                    </span>
                  )}
              </span>
              {typeof norm === "number" && (
                <>
                  <span className="text-border">·</span>
                  <span>‖ψ‖ = {norm.toFixed(3)}</span>
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
              hint="position"
              value={wavepacket.x0}
              onChange={(v) => setWavepacket({ ...wavepacket, x0: v })}
              min={-10}
              max={10}
              step={0.1}
            />
            <Slider
              label={<Tex>{`k_0`}</Tex>}
              hint="momentum"
              value={wavepacket.k0}
              onChange={(v) => setWavepacket({ ...wavepacket, k0: v })}
              min={-5}
              max={5}
              step={0.1}
            />
            <Slider
              label={<Tex>{`\\sigma`}</Tex>}
              hint="width"
              value={wavepacket.sigma}
              onChange={(v) => setWavepacket({ ...wavepacket, sigma: v })}
              min={0.2}
              max={3}
              step={0.05}
            />
          </Section>

          <Section title="Simulation">
            <Slider
              label={<Tex>{`t_{\\max}`}</Tex>}
              value={tMax}
              onChange={setTMax}
              min={1}
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

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
    case "harmonic":
      return (
        <>
          <Slider
            label={<Tex>{`\\omega`}</Tex>}
            value={p.omega ?? 1}
            onChange={(v) => set("omega", v)}
            min={0.2}
            max={3}
            step={0.05}
          />
          <Slider
            label={<Tex>{`x_0`}</Tex>}
            value={p.x0 ?? 0}
            onChange={(v) => set("x0", v)}
            min={-5}
            max={5}
            step={0.1}
          />
        </>
      );
    case "barrier":
      return (
        <>
          <Slider
            label={<Tex>{`V_0`}</Tex>}
            value={p.height ?? 2}
            onChange={(v) => set("height", v)}
            min={0.5}
            max={20}
            step={0.1}
          />
          <Slider
            label={<Tex>{`a`}</Tex>}
            value={p.width ?? 1}
            onChange={(v) => set("width", v)}
            min={0.1}
            max={5}
            step={0.05}
          />
        </>
      );
    case "finite_well":
      return (
        <>
          <Slider
            label={<Tex>{`V_0`}</Tex>}
            value={p.depth ?? 5}
            onChange={(v) => set("depth", v)}
            min={0.5}
            max={30}
            step={0.1}
          />
          <Slider
            label={<Tex>{`L`}</Tex>}
            value={p.width ?? 4}
            onChange={(v) => set("width", v)}
            min={0.5}
            max={10}
            step={0.1}
          />
        </>
      );
    case "infinite_well":
      return (
        <Slider
          label={<Tex>{`L`}</Tex>}
          value={p.width ?? 4}
          onChange={(v) => set("width", v)}
          min={0.5}
          max={10}
          step={0.1}
        />
      );
    case "step":
      return (
        <Slider
          label={<Tex>{`V_0`}</Tex>}
          value={p.height ?? 1}
          onChange={(v) => set("height", v)}
          min={-5}
          max={10}
          step={0.1}
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
      return { omega: 1.0, x0: 0.0 };
    case "barrier":
      return { height: 2.0, width: 1.0, x0: 0.0 };
    case "finite_well":
      return { depth: 5.0, width: 4.0, x0: 0.0 };
    case "infinite_well":
      return { width: 4.0, x0: 0.0 };
    case "step":
      return { height: 1.0, x0: 0.0 };
    case "double_well":
      return { a: 1.0, b: 4.0 };
    default:
      return null;
  }
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
            (s === value
              ? "bg-surface text-foreground"
              : "text-muted hover:text-foreground")
          }
          aria-pressed={s === value}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}

interface UseEvolveRunArgs {
  potential: PotentialSchema;
  wavepacket?: Wavepacket;
  tMax: number;
  dt: number;
  nFrames: number;
  grid?: GridSchema;
}

type RunStatus = "idle" | "connecting" | "streaming" | "ready" | "error";

function useEvolveRun(args: UseEvolveRunArgs) {
  // Frames live in a ref to avoid per-frame re-renders; bufferedCount in state
  // triggers minimal re-renders (one per arriving frame) so the UI can react.
  const framesRef = useRef<EvolveFrameMessage[]>([]);
  const [metadata, setMetadata] = useState<EvolveMetadataMessage | null>(null);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const requestKey = JSON.stringify({
    potential: args.potential,
    ...(args.wavepacket ? { wavepacket: args.wavepacket } : {}),
    t_max: args.tMax,
    dt: args.dt,
    n_frames: args.nFrames,
    ...(args.grid ? { grid: args.grid } : {}),
  });

  useEffect(() => {
    setStatus("connecting");
    setError(null);
    setMetadata(null);
    setBufferedCount(0);
    framesRef.current = [];

    const session = evolveWs(JSON.parse(requestKey), {
      onMetadata: (m) => {
        setMetadata(m);
        setStatus("streaming");
      },
      onFrame: (f) => {
        framesRef.current.push(f);
        setBufferedCount(framesRef.current.length);
      },
      onDone: () => {
        setStatus("ready");
      },
      onError: (e) => {
        setError(e);
        setStatus("error");
      },
    });

    return () => session.close();
  }, [requestKey]);

  return {
    metadata,
    framesRef,
    bufferedCount,
    totalFrames: metadata?.n_frames ?? 0,
    status,
    error,
  };
}

// ── V(x) reference scale ────────────────────────────────────────────────────
// Used to keep the potential band's vertical scale fixed for the lifetime of
// a figure, so changing V₀ via the slider actually changes the visible
// barrier/well height. Ranges roughly match each potential's slider bounds.

interface VReference {
  vMin: number;
  vMax: number;
}

function vReferenceFor(p: PotentialType): VReference {
  switch (p) {
    case "harmonic":
      return { vMin: 0, vMax: 12 };
    case "barrier":
      return { vMin: 0, vMax: 22 };
    case "finite_well":
      return { vMin: -32, vMax: 2 };
    case "infinite_well":
      return { vMin: 0, vMax: 12 };
    case "step":
      return { vMin: -6, vMax: 11 };
    case "double_well":
      return { vMin: -6, vMax: 12 };
    default:
      return { vMin: -5, vMax: 15 };
  }
}

// ── Canvas rendering ────────────────────────────────────────────────────────

function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFrame(
  canvas: HTMLCanvasElement | null,
  metadata: EvolveMetadataMessage,
  frames: EvolveFrameMessage[],
  i: number,
  vRef: VReference,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const { x: xs, potential: V } = metadata;
  const frame = frames[Math.min(i, frames.length - 1)];

  const xMin = xs[0];
  const xMax = xs[xs.length - 1];

  // Fixed V range per potential type so changes in V₀ are visually meaningful
  const vMin = vRef.vMin;
  const vMax = vRef.vMax;
  const vRange = vMax - vMin || 1;

  const padTop = 12;
  const padBottom = 16;
  const usable = h - padTop - padBottom;
  const probArea = usable * 0.62;
  const potArea = usable * 0.38;

  const xToPx = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
  // Clamp V to the fixed band so harmonic edges don't explode visually
  const vToY = (v: number) => {
    const clamped = Math.max(vMin, Math.min(vMax, v));
    return padTop + probArea + potArea - ((clamped - vMin) / vRange) * potArea;
  };

  // Separator
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, padTop + probArea);
  ctx.lineTo(w, padTop + probArea);
  ctx.stroke();

  // V(x) — dotted
  ctx.strokeStyle = "rgba(200,205,215,0.5)";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let k = 0; k < xs.length; k++) {
    const px = xToPx(xs[k]);
    const py = vToY(V[k]);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (frame) {
    const prob = frame.probability_density;
    const pMax = computePMaxRunning(frames);
    const probToY = (p: number) => padTop + probArea - (p / pMax) * probArea;

    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + probArea);
    gradient.addColorStop(0, "rgba(130, 180, 255, 0.55)");
    gradient.addColorStop(1, "rgba(130, 180, 255, 0.04)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(xToPx(xs[0]), padTop + probArea);
    for (let k = 0; k < xs.length; k++) {
      ctx.lineTo(xToPx(xs[k]), probToY(prob[k]));
    }
    ctx.lineTo(xToPx(xs[xs.length - 1]), padTop + probArea);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(130, 180, 255, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < xs.length; k++) {
      const px = xToPx(xs[k]);
      const py = probToY(prob[k]);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(132,138,150,0.9)";
  ctx.font = '11px var(--font-geist-sans), system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("|ψ|²", 10, padTop + 12);
  ctx.fillText("V(x)", 10, padTop + probArea + 14);
}

// Running pMax — refreshed live as frames arrive so the curve doesn't get
// renormalised every animation tick. Cached by frames-array identity so the
// scan only happens when the array grows or is replaced.
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
