"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";
import type {
  DiscreteEvolutionRequest,
  DiscreteEvolutionResponse,
} from "@/lib/api/schemas";
import { useDiscreteEvolution } from "@/lib/discrete-evolution";
import { useDebouncedValue } from "@/lib/use-debounced";

// A harmonic ladder, E_n = n + 1/2. Every energy is an odd multiple of 1/2,
// so every phase closes after 2*pi/(1/2) = 4*pi and the run loops seamlessly
// at the default t_max below. Custom energies are free to be incommensurate —
// the animation then simply restarts rather than closing.
const DEFAULT_ENERGIES = [0.5, 1.5, 2.5, 3.5, 4.5];
const DEFAULT_T_MAX = 4 * Math.PI;

// Wall-clock milliseconds per unit of atomic time: one loop of the default
// run takes about three seconds.
const MS_PER_TIME_UNIT = 240;
const SPEED_STOPS = [0.25, 0.5, 1, 2] as const;

// Re and Im keep the same two colours everywhere they appear — as the axes of
// each dial, as the two curves beside it, and in the legend.
const RE_COLOR = "rgb(124 160 255)";
const IM_COLOR = "rgb(170 141 255)";
const ARROW_COLOR = "rgb(232 235 242)";
const GRID_COLOR = "rgb(35 41 54)";
const AXIS_COLOR = "rgb(52 60 77)";
const MUTED_COLOR = "rgb(143 152 169)";
const FAINT_COLOR = "rgb(99 108 126)";

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

// Canvas geometry, in CSS pixels.
const PAD = 12;
const LABEL_W = 74;
const DIAL_W = 66;
const GAP = 8;
const ROW_H = 60;
const SUM_H = 84;
const SURVIVAL_H = 84;
const SEP_H = 14;

const TAU = 2 * Math.PI;

export interface SuperpositionPhasesProps {
  /** The E_n, in atomic units. Sorted ascending — the API returns its
   *  eigenvalues that way, and the rows have to line up with them. */
  energies?: number[];
  /** |c_n(0)|, as relative weights: the state is normalised server-side. */
  amplitudes?: number[];
  /** arg c_n(0), in degrees. */
  phases?: number[];
  tMax?: number;
  nFrames?: number;
  caption?: ReactNode;
}

export function SuperpositionPhases({
  energies: initialEnergies = DEFAULT_ENERGIES,
  amplitudes: initialAmplitudes,
  phases: initialPhases,
  tMax = DEFAULT_T_MAX,
  nFrames = 180,
  caption,
}: SuperpositionPhasesProps) {
  const energies = useMemo(
    () => [...initialEnergies].sort((a, b) => a - b),
    [initialEnergies],
  );
  const dim = energies.length;

  const defaults = useMemo(
    () => ({
      // Every level equally weighted and in phase: at t = 0 all the arrows
      // point the same way, which is the picture the run then takes apart.
      amplitudes: initialAmplitudes ?? Array<number>(dim).fill(1),
      phases: initialPhases ?? Array<number>(dim).fill(0),
    }),
    [initialAmplitudes, initialPhases, dim],
  );

  const [amplitudes, setAmplitudes] = useState<number[]>(defaults.amplitudes);
  const [phases, setPhases] = useState<number[]>(defaults.phases);

  useEffect(() => {
    setAmplitudes(defaults.amplitudes);
    setPhases(defaults.phases);
  }, [defaults]);

  const debouncedAmplitudes = useDebouncedValue(amplitudes, 250);
  const debouncedPhases = useDebouncedValue(phases, 250);

  // A state with no amplitude anywhere is not a state, and the API says so
  // with a 422. Hold the request instead of asking.
  const hasAmplitude = debouncedAmplitudes.some((a) => a > 0);

  const base = useMemo(() => {
    if (!hasAmplitude) return null;
    const angle = (deg: number) => (deg * Math.PI) / 180;
    // Normalised here, not left to the API. It normalises `state` but takes
    // `reference` exactly as given — by design, since that is what lets a
    // caller project onto an unnormalised vector — and psi(0) is used as its
    // own reference below. Sent raw, the sliders' own norm would come back as
    // a factor: A(0) = ||psi(0)||^2 instead of 1.
    const norm = Math.hypot(...debouncedAmplitudes);
    const state = {
      re: debouncedAmplitudes.map(
        (a, i) => (a / norm) * Math.cos(angle(debouncedPhases[i])),
      ),
      im: debouncedAmplitudes.map(
        (a, i) => (a / norm) * Math.sin(angle(debouncedPhases[i])),
      ),
    };
    return {
      // Diagonal, so the computational basis *is* the energy eigenbasis: the
      // coefficients that come back are the c_n of the text, in this order.
      hamiltonian: {
        re: energies.map((e, i) => energies.map((_, j) => (i === j ? e : 0))),
      },
      state,
      t_max: tMax,
      n_frames: nFrames,
    };
  }, [hasAmplitude, energies, debouncedAmplitudes, debouncedPhases, tMax, nFrames]);

  // Two runs of the same evolution, differing only in what psi(t) is projected
  // onto. One reference per response is all the endpoint offers, and the two
  // projections answer genuinely different questions — see the rows they draw.
  const survivalRequest = useMemo<DiscreteEvolutionRequest | null>(
    // psi(0) as its own reference: A(t) = <psi(0)|psi(t)>, which works out to
    // sum_n |c_n|^2 exp(-i E_n t). The initial phases cancel between bra and
    // ket, so this row is blind to them — the same fact that makes it
    // independent of the phase convention chosen for each |phi_n>.
    () => (base ? { ...base, reference: base.state } : null),
    [base],
  );
  const sumRequest = useMemo<DiscreteEvolutionRequest | null>(
    // The all-ones vector: <u|psi(t)> is the plain sum of the amplitudes, the
    // arrows above laid end to end. It does move with the initial phases, at
    // the price of being tied to this figure's phase convention.
    () => (base ? { ...base, reference: { re: base.state.re.map(() => 1) } } : null),
    [base],
  );

  const { data, error, loading } = useDiscreteEvolution(survivalRequest);
  const { data: sumData, error: sumError } = useDiscreteEvolution(sumRequest);

  const series = useMemo(() => toSeries(data, sumData), [data, sumData]);

  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);

  // Playback is local: the whole run is already here, every frame computed
  // from psi(0) rather than stepped, so nothing is fetched while it plays.
  useEffect(() => {
    if (!data || !playing) return;
    const count = data.times.length;
    if (count < 2) return;
    const stepMs = (data.times[1] - data.times[0]) * MS_PER_TIME_UNIT;
    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const advance = Math.floor(((now - last) * speed) / stepMs);
      if (advance > 0) {
        last = now;
        setFrameIdx((i) => (i + advance) % count);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [data, playing, speed]);

  const frame = data ? Math.min(frameIdx, data.times.length - 1) : 0;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const height = PAD * 2 + dim * ROW_H + SEP_H + SUM_H + SURVIVAL_H;

  // Kept in a ref so the ResizeObserver can repaint without being torn down
  // and rebuilt on every frame.
  const latest = useRef({ data, series, frame });
  latest.current = { data, series, frame };

  useEffect(() => {
    if (data && series) draw(canvasRef.current, data, series, frame);
  }, [data, series, frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas(canvas);
      const current = latest.current;
      if (current.data && current.series) {
        draw(canvas, current.data, current.series, current.frame);
      }
    });
    observer.observe(canvas);
    sizeCanvas(canvas);
    return () => observer.disconnect();
  }, []);

  // Either run failing means the figure is incomplete, and the two ask the
  // same question of the same solver — whichever came back first will do.
  const failure = error ?? sumError;
  const shownEnergies = data?.energies ?? energies;
  const frameCount = data?.times.length ?? 0;
  const lastFrame = Math.max(0, frameCount - 1);
  const tNow = data?.times[frame] ?? 0;
  const pristine =
    amplitudes.every((a, i) => a === defaults.amplitudes[i]) &&
    phases.every((p, i) => p === defaults.phases[i]);

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      {/* One column per level, across the top: the controls sit in the same
          order as the rows they drive, and each slider is as wide as the
          figure can spare rather than squeezed into a side rail. */}
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            {/* normal-case: KaTeX's ψ is a real lowercase-psi glyph — the
                inherited "uppercase" transform would flip it to Ψ. */}
            <Tex className="normal-case">{`\\psi(0)`}</Tex>
          </p>
          <button
            type="button"
            onClick={() => {
              setAmplitudes(defaults.amplitudes);
              setPhases(defaults.phases);
            }}
            disabled={pristine}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground disabled:opacity-30"
          >
            reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shownEnergies.map((energy, n) => (
            <div key={n} className="space-y-2.5 rounded border border-border p-2.5">
              <div className="flex items-baseline justify-between font-mono text-[10px]">
                <span className="text-foreground">n = {n + 1}</span>
                <span className="tabular-nums text-muted">
                  E = {energy.toFixed(2)}
                </span>
              </div>
              <Slider
                label={<Tex>{`|c_{${n + 1}}|`}</Tex>}
                value={amplitudes[n] ?? 0}
                onChange={(v) => setAmplitudes(replace(amplitudes, n, v))}
                min={0}
                max={1}
                step={0.05}
              />
              <Slider
                label={<Tex>{`\\arg c_{${n + 1}}`}</Tex>}
                value={phases[n] ?? 0}
                onChange={(v) => setPhases(replace(phases, n, v))}
                min={-180}
                max={180}
                step={5}
                unit="°"
                format={(v) => v.toFixed(0)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Real and imaginary part of each coefficient of the superposition, of their sum, and of the survival amplitude"
        />
        {!data && !failure && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {hasAmplitude ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Solving…
              </span>
            ) : (
              <span>Give at least one level a non-zero amplitude.</span>
            )}
          </div>
        )}
        {failure && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
            {failure.message}
          </div>
        )}
      </div>

      {/* Scrubber. `step` is one frame, so the arrow keys walk the run image
          by image once it has focus — the phases are easier to read standing
          still than at sixty a second. Touching it stops playback, which is
          otherwise fighting you for the same index. */}
      <div className="border-t border-border">
        <input
          type="range"
          min={0}
          max={lastFrame}
          step={1}
          value={frame}
          disabled={!data}
          onChange={(e) => {
            setPlaying(false);
            setFrameIdx(Number(e.target.value));
          }}
          className="ui-slider block w-full"
          style={{
            ["--pct" as string]: `${lastFrame ? (frame / lastFrame) * 100 : 0}%`,
          }}
          aria-label="Seek through the run, one frame per arrow key"
          aria-valuetext={`t = ${tNow.toFixed(2)}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={() => setFrameIdx(0)}
            disabled={!data}
            label="Jump to t = 0"
          >
            ⏮
          </IconButton>
          <IconButton
            onClick={() => setPlaying((p) => !p)}
            disabled={!data}
            label={playing ? "Pause" : "Play"}
            primary
          >
            {playing ? "⏸" : "▶"}
          </IconButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
          <span>
            t = <span className="text-foreground">{tNow.toFixed(2)}</span>
          </span>
          <span className="text-border">·</span>
          <span>
            loop at <span className="text-foreground">{tMax.toFixed(2)}</span>
          </span>
          {loading && <Spinner />}
        </div>

        <SpeedControl value={speed} onChange={setSpeed} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted">
        <Key color={RE_COLOR} label="Re" />
        <Key color={IM_COLOR} label="Im" dashed />
        <span className="text-faint">
          <Tex>{`\\Sigma`}</Tex> adds the arrows up;{" "}
          <Tex>{`A(t) = \\langle\\psi(0)|\\psi(t)\\rangle`}</Tex> compares the
          state to its own start — so turning an initial phase moves{" "}
          <Tex>{`\\Sigma`}</Tex> and never <Tex>{`A`}</Tex>.
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

interface Series {
  re: Float64Array;
  im: Float64Array;
}

interface Reshaped {
  /** One series per level, in the order of `energies`. */
  components: Series[];
  /** Sum of the amplitudes, i.e. the overlap with the all-ones vector. */
  sum: Series | null;
  /** A(t) = <psi(0)|psi(t)>, the survival amplitude. */
  survival: Series | null;
  /** Largest modulus any single coefficient reaches — a shared scale, so the
   *  rows can be read against each other. */
  scale: number;
  /** The sum's own scale: N arrows in phase are longer than any one of them,
   *  reaching sqrt(N) for an even spread, so its dial needs the room. */
  sumScale: number;
  /** A(t)'s own scale. Comes out at 1: A(0) = 1 for a normalised state and
   *  Cauchy-Schwarz keeps it there, but it is measured rather than assumed. */
  survivalScale: number;
}

/**
 * Turn the responses' frame-by-frame vectors into one series per level.
 *
 * Purely a transpose — every number here was computed on the API, including
 * both projections. The scales are framing decisions, taken from the data
 * that came back rather than from the sliders, so a run always fills its
 * dials.
 *
 * `sumData` is the second run, the one referenced to the all-ones vector. It
 * is read for its overlap alone: its coefficients are the same evolution
 * again, and its frames are ignored unless they line up with the first run's,
 * which they will not for the instant a parameter change leaves one response
 * newer than the other.
 */
function toSeries(
  data: DiscreteEvolutionResponse | null,
  sumData: DiscreteEvolutionResponse | null,
): Reshaped | null {
  if (!data) return null;
  const count = data.times.length;
  const dim = data.energies.length;
  if (count === 0 || dim === 0) return null;

  const components: Series[] = Array.from({ length: dim }, () => ({
    re: new Float64Array(count),
    im: new Float64Array(count),
  }));

  let scale = 0;
  for (let t = 0; t < count; t++) {
    const { re, im } = data.coefficients[t];
    for (let n = 0; n < dim; n++) {
      const x = re[n] ?? 0;
      const y = im?.[n] ?? 0;
      components[n].re[t] = x;
      components[n].im[t] = y;
      scale = Math.max(scale, Math.hypot(x, y));
    }
  }

  const survival = toOverlapSeries(data.overlap, count);
  const sum = toOverlapSeries(sumData?.overlap, count);

  // A run of exactly zero would divide by nothing; it cannot happen for a
  // normalised state, but the drawing code should not have to know that.
  return {
    components,
    sum: sum?.series ?? null,
    survival: survival?.series ?? null,
    scale: scale || 1,
    sumScale: sum?.scale || 1,
    survivalScale: survival?.scale || 1,
  };
}

/** One overlap series and the largest modulus it reaches, or null. */
function toOverlapSeries(
  overlap: DiscreteEvolutionResponse["overlap"],
  count: number,
): { series: Series; scale: number } | null {
  if (!overlap || overlap.re.length !== count) return null;
  const series: Series = {
    re: Float64Array.from(overlap.re),
    im: Float64Array.from(overlap.im ?? new Array<number>(count).fill(0)),
  };
  let scale = 0;
  for (let t = 0; t < count; t++) {
    scale = Math.max(scale, Math.hypot(series.re[t], series.im[t]));
  }
  return { series, scale };
}

function replace(values: number[], index: number, value: number): number[] {
  const next = [...values];
  next[index] = value;
  return next;
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

/**
 * One row per level, then the two ways of collapsing them into one.
 *
 * Each level's row is the same coefficient twice over: an arrow in the complex
 * plane, and the two curves that arrow's shadow traces on the axes. Reading
 * down the rows, the only thing that changes is the rate — which is E_n, and
 * nothing else.
 *
 * The two rows underneath run on those same frequencies and so have no single
 * frequency of their own, but they differ in what they are referenced to.
 * Sigma c_n is the arrows laid end to end, and turning any initial phase moves
 * it. A(t) is the state against its own starting point, where those phases
 * cancel between bra and ket — which is exactly why it is the one that does
 * not care how each |phi_n> was signed.
 */
function draw(
  canvas: HTMLCanvasElement | null,
  data: DiscreteEvolutionResponse,
  series: Reshaped,
  frame: number,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const traceX = PAD + LABEL_W + DIAL_W + GAP;
  const traceW = Math.max(60, rect.width - traceX - PAD);

  let y = PAD;
  series.components.forEach((component, n) => {
    drawRow(ctx, {
      y,
      height: ROW_H,
      traceX,
      traceW,
      series: component,
      scale: series.scale,
      frame,
      label: `n = ${n + 1}`,
      sublabel: `E = ${data.energies[n].toFixed(2)}`,
    });
    y += ROW_H;
  });

  // The rule that separates the parts from the whole.
  const ruleY = y + SEP_H / 2;
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, ruleY);
  ctx.lineTo(rect.width - PAD, ruleY);
  ctx.stroke();
  y += SEP_H;

  if (series.sum) {
    drawRow(ctx, {
      y,
      height: SUM_H,
      traceX,
      traceW,
      series: series.sum,
      scale: series.sumScale,
      frame,
      label: "Σ cₙ(t)",
      sublabel: `|Σ| = ${Math.hypot(
        series.sum.re[frame],
        series.sum.im[frame],
      ).toFixed(2)}`,
      strong: true,
    });
  }
  y += SUM_H;

  // A lighter rule between the two summaries than above them: they are both
  // ways of collapsing the same five arrows into one, and belong together.
  ctx.strokeStyle = GRID_COLOR;
  ctx.beginPath();
  ctx.moveTo(PAD + LABEL_W, y);
  ctx.lineTo(rect.width - PAD, y);
  ctx.stroke();

  if (series.survival) {
    // |A|^2 rather than |A|: the probability of finding the system still in
    // the state it started in is the number worth reading off.
    const probability =
      series.survival.re[frame] ** 2 + series.survival.im[frame] ** 2;
    drawRow(ctx, {
      y,
      height: SURVIVAL_H,
      traceX,
      traceW,
      series: series.survival,
      scale: series.survivalScale,
      frame,
      label: "A(t)",
      sublabel: `|A|² = ${probability.toFixed(2)}`,
      strong: true,
    });
  }
}

interface RowSpec {
  y: number;
  height: number;
  traceX: number;
  traceW: number;
  series: Series;
  scale: number;
  frame: number;
  label: string;
  sublabel: string;
  strong?: boolean;
}

function drawRow(ctx: CanvasRenderingContext2D, spec: RowSpec) {
  const { y, height, traceX, traceW, series, scale, frame, strong } = spec;
  const midY = y + height / 2;

  ctx.font = `${strong ? 12 : 11}px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillStyle = strong ? ARROW_COLOR : MUTED_COLOR;
  ctx.fillText(spec.label, PAD, midY - 2);
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = FAINT_COLOR;
  ctx.fillText(spec.sublabel, PAD, midY + 12);

  const radius = Math.min(height, DIAL_W) / 2 - 6;
  drawDial(
    ctx,
    PAD + LABEL_W + DIAL_W / 2,
    midY,
    radius,
    series.re[frame],
    series.im[frame],
    scale,
  );

  drawTrace(ctx, traceX, y + 4, traceW, height - 8, series, scale, frame);
}

/**
 * The coefficient as an arrow in the complex plane.
 *
 * The dotted legs are its projections — the two numbers the curves to the
 * right are plotting, so the arrow and the curves are visibly the same thing.
 * The circle is drawn at the row's scale, which is the furthest the arrow
 * ever reaches.
 */
function drawDial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  re: number,
  im: number,
  scale: number,
) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  const tipX = cx + (re / scale) * radius;
  const tipY = cy - (im / scale) * radius;

  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = RE_COLOR;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, cy);
  ctx.stroke();
  ctx.strokeStyle = IM_COLOR;
  ctx.beginPath();
  ctx.moveTo(tipX, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.setLineDash([]);

  drawArrow(ctx, cx, cy, tipX, tipY);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  ctx.strokeStyle = ARROW_COLOR;
  ctx.fillStyle = ARROW_COLOR;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  const length = Math.hypot(x1 - x0, y1 - y0);
  // Below a few pixels there is no direction left to point in, and a head
  // would be all there is to see.
  if (length < 5) return;
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  const head = 6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * ux + 0.45 * head * uy, y1 - head * uy - 0.45 * head * ux);
  ctx.lineTo(x1 - head * ux - 0.45 * head * uy, y1 - head * uy + 0.45 * head * ux);
  ctx.closePath();
  ctx.fill();
}

/**
 * Re and Im over the whole run, with a playhead at the current frame.
 *
 * The window is fixed rather than scrolling, so the beat pattern of the sum
 * is visible all at once instead of arriving a sliver at a time.
 */
function drawTrace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  series: Series,
  scale: number,
  frame: number,
) {
  const count = series.re.length;
  if (count < 2) return;

  const midY = y + height / 2;
  const half = height / 2 - 2;
  const atX = (i: number) => x + (i / (count - 1)) * width;
  const atY = (v: number) => midY - (v / scale) * half;

  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID_COLOR;
  ctx.beginPath();
  ctx.moveTo(x, midY);
  ctx.lineTo(x + width, midY);
  ctx.stroke();

  const curve = (values: Float64Array) => {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const px = atX(i);
      const py = atY(values[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = RE_COLOR;
  curve(series.re);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = IM_COLOR;
  curve(series.im);
  ctx.setLineDash([]);

  const playX = atX(frame);
  ctx.lineWidth = 1;
  ctx.strokeStyle = AXIS_COLOR;
  ctx.beginPath();
  ctx.moveTo(playX, y);
  ctx.lineTo(playX, y + height);
  ctx.stroke();

  for (const [values, color] of [
    [series.re, RE_COLOR],
    [series.im, IM_COLOR],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(playX, atY(values[frame]), 2.5, 0, TAU);
    ctx.fill();
  }
}

// ── Chrome ──────────────────────────────────────────────────────────────────

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
      {SPEED_STOPS.map((stop) => (
        <button
          key={stop}
          type="button"
          onClick={() => onChange(stop)}
          className={
            "rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors " +
            (stop === value
              ? "bg-surface text-foreground"
              : "text-muted hover:text-foreground")
          }
          aria-pressed={stop === value}
        >
          {stop}×
        </button>
      ))}
    </div>
  );
}
