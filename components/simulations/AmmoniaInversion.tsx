"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Tex } from "@/components/ui/Tex";
import type { DiscreteEvolutionRequest } from "@/lib/api/schemas";
import { useDiscreteEvolution } from "@/lib/discrete-evolution";

// Two states, one coupling. H = [[0, -A], [-A, 0]] in the {|1>, |2>} basis:
// E_0 is set to zero, since a common diagonal shifts both levels together and
// only a global phase comes of it. Eigenvalues are then -A and +A, ascending,
// so the API's coefficients arrive as (c_+, c_-) in that order, the symmetric
// combination being the one tunneling pushes *down*.
//
// A is fixed rather than exposed. It is the only scale in the problem, so it
// sets the unit of time and nothing else: rescaling A rescales t by the same
// factor, and since the run spans one full recurrence 2*pi/A, every frame
// drawn is identical for any A. A control for it would relabel the clock and
// move not one pixel. Read t below in units of hbar/A.
const A = 1;
const T_MAX = (2 * Math.PI) / A;

const MS_PER_TIME_UNIT = 200;
const SPEED_STOPS = [0.25, 0.5, 1, 2] as const;

const RE_COLOR = "rgb(124 160 255)";
const IM_COLOR = "rgb(170 141 255)";
const P1_COLOR = "rgb(124 160 255)";
const P2_COLOR = "rgb(255 160 120)";
const PLUS_COLOR = "rgb(120 220 180)";
const MINUS_COLOR = "rgb(232 160 210)";
const ARROW_COLOR = "rgb(232 235 242)";
const GRID_COLOR = "rgb(35 41 54)";
const AXIS_COLOR = "rgb(52 60 77)";
const MUTED_COLOR = "rgb(143 152 169)";
const FAINT_COLOR = "rgb(99 108 126)";

const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const TAU = 2 * Math.PI;

// psi(0) = |1>, the nitrogen definitely on one side. There is no control for
// this: the eigenstates are the only other preparations worth naming, and
// starting from one of those makes every curve on the figure a flat line, an
// eigenstate having nothing to do but collect a phase. The point of the module
// is the state that *does* move.
const INITIAL_STATE = { re: [1, 0] };

export interface AmmoniaInversionProps {
  nFrames?: number;
  caption?: ReactNode;
}

export function AmmoniaInversion({
  nFrames = 180,
  caption,
}: AmmoniaInversionProps) {
  // Fixed, so this resolves to one pair of requests for the life of the page:
  // fetched once, cached, never refetched. psi(t) returns to itself after
  // T_MAX, and the beat in P_1 has half that period, so the run closes on a
  // whole number of both and loops without a seam.
  const base = useMemo(
    () => ({
      hamiltonian: { re: [[0, -A], [-A, 0]] },
      state: INITIAL_STATE,
      t_max: T_MAX,
      n_frames: nFrames,
    }),
    [nFrames],
  );

  // The API projects psi(t) onto one reference per run, and the two
  // configurations are two different references, so two runs. Both carry the
  // same coefficients (c_+, c_-) in the energy eigenbasis; only `overlap`
  // differs, giving <1|psi(t)> and <2|psi(t)> respectively. Nothing on this
  // figure is computed here: every amplitude below arrives from the solver.
  const req1 = useMemo<DiscreteEvolutionRequest>(
    () => ({ ...base, reference: { re: [1, 0] } }),
    [base],
  );
  const req2 = useMemo<DiscreteEvolutionRequest>(
    () => ({ ...base, reference: { re: [0, 1] } }),
    [base],
  );

  const { data, dataKey, error, loading } = useDiscreteEvolution(req1);
  const { data: data2, dataKey: dataKey2, error: error2 } =
    useDiscreteEvolution(req2);

  // Both runs change together on every click, and they land in either order.
  // Their frame counts always match, so length is no help in telling a fresh
  // response from a leftover: only the key each one came back under says
  // whether the two halves describe the same state. Until both agree with what
  // was just asked for, the previous complete pair stays on screen.
  const pairKey = `${JSON.stringify(req1)}|${JSON.stringify(req2)}`;
  const paired =
    dataKey === JSON.stringify(req1) && dataKey2 === JSON.stringify(req2);
  const shown = useRef<Series | null>(null);

  const fresh = useMemo(() => {
    if (!paired || !data || !data2) return null;
    const n = data.times.length;
    if (n === 0 || data2.overlap?.re.length !== n) return null;

    const o1 = data.overlap;
    const o2 = data2.overlap;
    if (!o1 || !o2) return null;

    const out = {
      times: data.times,
      // The solver's own eigenvalues, not the E_0 -/+ A this figure assumed
      // when it built H. Everything downstream that names an energy or a
      // period reads them from here, so the labels state what came back
      // rather than what was asked for.
      energies: data.energies,
      // <1|psi(t)> and <2|psi(t)>: the state read in the configuration basis.
      a1re: Float64Array.from(o1.re),
      a1im: Float64Array.from(o1.im ?? new Array<number>(n).fill(0)),
      a2re: Float64Array.from(o2.re),
      a2im: Float64Array.from(o2.im ?? new Array<number>(n).fill(0)),
      // |c_+|^2 and |c_-|^2 straight off the eigenbasis coefficients, which
      // arrive ascending in energy: index 0 is E_0 - A, the symmetric state.
      pPlus: new Float64Array(n),
      pMinus: new Float64Array(n),
      p1: new Float64Array(n),
      p2: new Float64Array(n),
    };

    for (let t = 0; t < n; t++) {
      const { re, im } = data.coefficients[t];
      const plusRe = re[0] ?? 0;
      const plusIm = im?.[0] ?? 0;
      const minusRe = re[1] ?? 0;
      const minusIm = im?.[1] ?? 0;
      out.pPlus[t] = plusRe * plusRe + plusIm * plusIm;
      out.pMinus[t] = minusRe * minusRe + minusIm * minusIm;
      out.p1[t] = out.a1re[t] ** 2 + out.a1im[t] ** 2;
      out.p2[t] = out.a2re[t] ** 2 + out.a2im[t] ** 2;
    }
    return out;
  }, [paired, data, data2]);

  if (fresh) shown.current = fresh;
  const series = fresh ?? shown.current;

  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);

  // A click lands on a run of a different length whenever A moved with it, and
  // an index left over from the old run would point past the end of the new
  // one. Restarting is also the honest reading: it is a different experiment.
  useEffect(() => {
    setFrameIdx(0);
  }, [pairKey]);

  useEffect(() => {
    if (!series || !playing) return;
    const count = series.times.length;
    if (count < 2) return;
    const stepMs = (series.times[1] - series.times[0]) * MS_PER_TIME_UNIT;
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
  }, [series, playing, speed]);

  const frame = series ? Math.min(frameIdx, series.times.length - 1) : 0;

  const stateRef = useRef<HTMLCanvasElement | null>(null);
  const probRef = useRef<HTMLCanvasElement | null>(null);

  const latest = useRef({ series, frame });
  latest.current = { series, frame };

  useEffect(() => {
    if (!series) return;
    drawState(stateRef.current, series, frame);
    drawProbabilities(probRef.current, series, frame);
  }, [series, frame]);

  useEffect(() => {
    const s = stateRef.current;
    const p = probRef.current;
    if (!s || !p) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas(s);
      sizeCanvas(p);
      const cur = latest.current;
      if (cur.series) {
        drawState(s, cur.series, cur.frame);
        drawProbabilities(p, cur.series, cur.frame);
      }
    });
    observer.observe(s);
    observer.observe(p);
    sizeCanvas(s);
    sizeCanvas(p);
    return () => observer.disconnect();
  }, []);

  const failure = error ?? error2;
  const lastFrame = Math.max(0, (series?.times.length ?? 0) - 1);
  const tNow = series?.times[frame] ?? 0;

  // Both read off the solver's eigenvalues rather than the A this figure sent.
  // The splitting is E_- - E_+, which is 2A for the H above, and P_1 beats at
  // that difference: one full flip and back takes 2*pi/gap.
  const gap = series ? series.energies[1] - series.energies[0] : 0;
  const flipPeriod = gap > 0 ? TAU / gap : 0;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      {/* Nothing to tune: psi(0) is fixed and A only names the clock. What is
          worth stating is the setup itself, so it reads as a caption rather
          than as a control panel with the knobs greyed out. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border px-4 py-2.5 text-[11px] text-muted">
        <Tex className="normal-case">{`\\hat H = \\begin{pmatrix} 0 & -A \\\\ -A & 0 \\end{pmatrix}`}</Tex>
        <span className="text-border">·</span>
        <Tex className="normal-case">{`\\psi(0) = |1\\rangle`}</Tex>
        <span className="text-border">·</span>
        <span className="text-faint">
          <Tex className="normal-case">{`t`}</Tex> in units of{" "}
          <Tex className="normal-case">{`\\hbar/A`}</Tex>
        </span>
      </div>

      <div className="relative" style={{ height: 168 }}>
        <canvas
          ref={stateRef}
          className="block h-full w-full"
          aria-label="The two complex amplitudes of the state, as arrows in the complex plane"
        />
        {!series && !failure && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <Spinner /> Solving…
            </span>
          </div>
        )}
        {failure && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
            {failure.message}
          </div>
        )}
      </div>

      <div className="relative border-t border-border" style={{ height: 208 }}>
        <canvas
          ref={probRef}
          className="block h-full w-full"
          aria-label="Probabilities of finding the molecule in each configuration, and of measuring each energy"
        />
      </div>

      <div className="border-t border-border">
        <input
          type="range"
          min={0}
          max={lastFrame}
          step={1}
          value={frame}
          disabled={!series}
          onChange={(e) => {
            setPlaying(false);
            setFrameIdx(Number(e.target.value));
          }}
          className="ui-slider block w-full"
          aria-label="Seek through the run"
          aria-valuetext={`t = ${tNow.toFixed(2)}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <div className="flex items-center gap-0.5">
          <IconButton onClick={() => setFrameIdx(0)} disabled={!series} label="Jump to t = 0">
            ⏮
          </IconButton>
          <IconButton
            onClick={() => setPlaying((p) => !p)}
            disabled={!series}
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
            gap <span className="text-foreground">{gap.toFixed(2)}</span>
          </span>
          <span className="text-border">·</span>
          <span>
            flip period{" "}
            <span className="text-foreground">{flipPeriod.toFixed(2)}</span>
          </span>
          {loading && <Spinner />}
        </div>

        <SpeedControl value={speed} onChange={setSpeed} />
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
  times: number[];
  /** Eigenvalues of H, ascending, exactly as the solver returned them. */
  energies: number[];
  a1re: Float64Array;
  a1im: Float64Array;
  a2re: Float64Array;
  a2im: Float64Array;
  pPlus: Float64Array;
  pMinus: Float64Array;
  p1: Float64Array;
  p2: Float64Array;
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
 * The state itself: two complex numbers, nothing more.
 *
 * A two-level system has no wavefunction over space. psi(t) *is* the pair
 * (<1|psi>, <2|psi>), so it is drawn as the pair. Each amplitude is an arrow
 * in its own complex plane, with the length of that arrow squared written
 * underneath as the probability of finding the nitrogen on that side. Watch
 * one arrow shorten as the other lengthens: that is the molecule flipping.
 */
function drawState(
  canvas: HTMLCanvasElement | null,
  s: Series,
  frame: number,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const cells = [
    {
      re: s.a1re[frame],
      im: s.a1im[frame],
      p: s.p1[frame],
      label: "⟨1|ψ(t)⟩",
      sub: "nitrogen up",
      color: P1_COLOR,
    },
    {
      re: s.a2re[frame],
      im: s.a2im[frame],
      p: s.p2[frame],
      label: "⟨2|ψ(t)⟩",
      sub: "nitrogen down",
      color: P2_COLOR,
    },
  ];

  const half = w / 2;
  cells.forEach((cell, i) => {
    const cx = half * (i + 0.5);
    const cy = h / 2 - 6;
    const radius = Math.min(h * 0.30, 46);

    ctx.font = `600 11px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillStyle = cell.color;
    ctx.fillText(cell.label, cx, 20);
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = FAINT_COLOR;
    ctx.fillText(cell.sub, cx, 34);

    // Unit circle: every amplitude of this normalised state lives inside it,
    // so the two arrows share one scale and can be compared directly.
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

    const tipX = cx + cell.re * radius;
    const tipY = cy - cell.im * radius;

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

    drawArrow(ctx, cx, cy, tipX, tipY, cell.color);

    ctx.font = `600 11px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(`|·|² = ${cell.p.toFixed(3)}`, cx, h - 8);
  });

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(half, 10);
  ctx.lineTo(half, h - 22);
  ctx.stroke();
}

/**
 * The two questions, one above the other.
 *
 * Top, with the room: "which side is the nitrogen on". P_1 and P_2 trade
 * places at 2A/hbar, the molecule inverting. That is the only thing on this
 * figure that moves, so it gets the time axis.
 *
 * Bottom, as a strip: "what energy would a measurement return". |c_+|^2 and
 * |c_-|^2 are constants of the motion, and plotting two flat lines against time
 * would spend half the figure saying nothing. They still earn their place,
 * because they change with the *preparation*: a half-and-half pair for |1>,
 * all-or-nothing for either eigenstate.
 */
function drawProbabilities(
  canvas: HTMLCanvasElement | null,
  s: Series,
  frame: number,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const stripH = 62;
  const traceH = h - stripH;

  drawProbPanel(ctx, {
    y: 0,
    height: traceH,
    width: w,
    title: "configuration, where the nitrogen is",
    frame,
    times: s.times,
    curves: [
      { values: s.p1, color: P1_COLOR, name: "P₁" },
      { values: s.p2, color: P2_COLOR, name: "P₂" },
    ],
  });

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, traceH);
  ctx.lineTo(w - 10, traceH);
  ctx.stroke();

  drawEnergyStrip(ctx, {
    y: traceH,
    width: w,
    pPlus: s.pPlus[frame],
    pMinus: s.pMinus[frame],
    energies: s.energies,
  });
}

/**
 * |c_+|^2 and |c_-|^2 as two horizontal bars sharing one 0-to-1 track.
 *
 * Flat in time by construction, so they are stated rather than plotted, with
 * the energy of each level written alongside, the pair of numbers a photon
 * has to bridge.
 */
function drawEnergyStrip(
  ctx: CanvasRenderingContext2D,
  spec: {
    y: number;
    width: number;
    pPlus: number;
    pMinus: number;
    energies: number[];
  },
) {
  const { y, width, energies } = spec;
  const padL = 10;

  ctx.font = `600 10px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED_COLOR;
  ctx.fillText("energy, what a measurement returns", padL, y + 14);
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = FAINT_COLOR;
  ctx.textAlign = "right";
  ctx.fillText("constant in time", width - padL, y + 14);

  const rows = [
    {
      p: spec.pPlus,
      color: PLUS_COLOR,
      name: "|c₊|²",
      energy: `E = ${(energies[0] ?? 0).toFixed(2)}`,
    },
    {
      p: spec.pMinus,
      color: MINUS_COLOR,
      name: "|c₋|²",
      energy: `E = ${(energies[1] ?? 0).toFixed(2)}`,
    },
  ];

  const labelW = 42;
  const energyW = 52;
  const trackX = padL + labelW;
  const trackW = Math.max(60, width - trackX - padL - energyW - 34);
  const rowH = 15;
  const top = y + 24;

  rows.forEach((row, i) => {
    const ry = top + i * (rowH + 4);

    ctx.font = `10px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillStyle = row.color;
    ctx.fillText(row.name, padL, ry + 11);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(trackX, ry, trackW, rowH);

    ctx.fillStyle = row.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(trackX, ry, row.p * trackW, rowH);
    ctx.globalAlpha = 1;

    ctx.font = `10px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(row.p.toFixed(2), trackX + trackW + 6, ry + 11);

    ctx.textAlign = "right";
    ctx.fillStyle = FAINT_COLOR;
    ctx.fillText(row.energy, width - padL, ry + 11);
  });
}

interface PanelSpec {
  y: number;
  height: number;
  width: number;
  title: string;
  frame: number;
  times: number[];
  curves: { values: Float64Array; color: string; name: string }[];
}

function drawProbPanel(ctx: CanvasRenderingContext2D, spec: PanelSpec) {
  const { y, height, width, frame, times, curves } = spec;
  const padL = 10;
  const barW = 46;
  const gap = 12;
  const padTop = 22;
  const padBottom = 16;
  const plotTop = y + padTop;
  const plotH = height - padTop - padBottom;

  ctx.font = `600 10px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED_COLOR;
  ctx.fillText(spec.title, padL, y + 14);

  // Current values as bars on the left, so the panel reads while paused.
  const barX = padL;
  curves.forEach((curve, i) => {
    const v = curve.values[frame];
    const x = barX + i * (barW / 2 + 4);
    const bw = barW / 2 - 4;
    const bh = Math.max(1, v * plotH);
    ctx.fillStyle = curve.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, plotTop + plotH - bh, bw, bh);
    ctx.globalAlpha = 1;
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillStyle = FAINT_COLOR;
    ctx.fillText(v.toFixed(2), x + bw / 2, plotTop + plotH + 12);
  });

  // Frame for the bars: full height is probability 1.
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX - 1, plotTop, barW, plotH);

  const traceX = barX + barW + gap;
  const traceW = Math.max(40, width - traceX - padL - 34);

  // 0 and 1 guides: a flat line at 0.5 is only meaningful against them.
  ctx.strokeStyle = GRID_COLOR;
  for (const level of [0, 0.5, 1]) {
    const py = plotTop + plotH - level * plotH;
    ctx.setLineDash(level === 0.5 ? [2, 3] : []);
    ctx.beginPath();
    ctx.moveTo(traceX, py);
    ctx.lineTo(traceX + traceW, py);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const atX = (i: number) => traceX + (i / (times.length - 1)) * traceW;
  const atY = (v: number) => plotTop + plotH - v * plotH;

  for (const curve of curves) {
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < times.length; i++) {
      const px = atX(i);
      const py = atY(curve.values[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  const playX = atX(frame);
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(playX, plotTop);
  ctx.lineTo(playX, plotTop + plotH);
  ctx.stroke();

  for (const curve of curves) {
    ctx.fillStyle = curve.color;
    ctx.beginPath();
    ctx.arc(playX, atY(curve.values[frame]), 2.5, 0, TAU);
    ctx.fill();

    // Name the curve at its own final height, so the two never collide.
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(
      curve.name,
      traceX + traceW + 4,
      atY(curve.values[times.length - 1]) + 3,
    );
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 5) {
    // A vanished amplitude still deserves a mark, or the dial reads as broken.
    ctx.fillStyle = ARROW_COLOR;
    ctx.beginPath();
    ctx.arc(x0, y0, 2.5, 0, TAU);
    ctx.fill();
    return;
  }
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  const head = 7;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * ux + 0.45 * head * uy, y1 - head * uy - 0.45 * head * ux);
  ctx.lineTo(x1 - head * ux - 0.45 * head * uy, y1 - head * uy + 0.45 * head * ux);
  ctx.closePath();
  ctx.fill();
}

// ── Chrome ──────────────────────────────────────────────────────────────────

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
          : "text-muted hover:bg-surface hover:text-foreground disabled:opacity-30")
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
