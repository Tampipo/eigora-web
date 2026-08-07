"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";
import {
  branchY,
  predictedCount,
  statesFromEigenstates,
  threshold,
  wellForRadius,
  type WellState,
} from "@/lib/finite-well";
import { useEigenstates } from "@/lib/use-eigenstates";
import type { EigenstatesResponse, GridSchema } from "@/lib/api/schemas";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const EVEN_COLOR = "rgb(124,160,255)";
const ODD_COLOR = "rgb(255,170,110)";
const CIRCLE_COLOR = "rgb(232 235 242)";

// Points per branch. The curves are smooth except right at their asymptotes,
// which get clipped away anyway.
const SAMPLES = 240;

const GRID: GridSchema = { x_min: -10, x_max: 10, n_points: 2048 };

export interface FiniteWellGraphicalProps {
  /** Initial well radius R = sqrt(2 m V0 a^2)/hbar. */
  radius?: number;
  rMax?: number;
  height?: number;
  caption?: string;
}

export function FiniteWellGraphical({
  radius: initialRadius = 5,
  rMax = 12,
  height = 460,
  caption,
}: FiniteWellGraphicalProps) {
  const [R, setR] = useState(initialRadius);

  const well = useMemo(() => wellForRadius(R), [R]);
  // Ask for a couple more than the construction predicts, then keep whichever
  // come back bound — the count on screen is the solver's, not the formula's.
  const { data, error, loading } = useEigenstates(
    useMemo(
      () => ({ type: "finite_well" as const, params: well }),
      [well],
    ),
    Math.min(24, predictedCount(R) + 2),
    GRID,
  );

  const states = useMemo(() => statesFor(data, well.depth), [data, well.depth]);

  // Quantised so the axes step in whole units instead of sliding continuously
  // under the cursor while R is dragged. The margin past R leaves the next
  // uncrossed branch visible, which is what makes the count read as a count.
  const M = Math.max(4, Math.ceil(R * 1.15));

  const { even, odd } = useMemo(() => buildBranches(M), [M]);
  const circle = useMemo(() => buildCircle(R), [R]);

  const evenStates = states.filter((s) => s.parity === "even");
  const oddStates = states.filter((s) => s.parity === "odd");
  const missing = states.length > 0 ? predictedCount(R) - states.length : 0;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="relative" style={{ minHeight: height }}>
          {error && !data && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
              {error.message}
            </div>
          )}
          <Plot
            data={[
              {
                x: even.x,
                y: even.y,
                type: "scatter",
                mode: "lines",
                line: { color: EVEN_COLOR, width: 1.6 },
                hovertemplate: "even branch<extra></extra>",
              },
              {
                x: odd.x,
                y: odd.y,
                type: "scatter",
                mode: "lines",
                line: { color: ODD_COLOR, width: 1.6 },
                hovertemplate: "odd branch<extra></extra>",
              },
              {
                x: circle.x,
                y: circle.y,
                type: "scatter",
                mode: "lines",
                line: { color: CIRCLE_COLOR, width: 1.5, dash: "dot" },
                hoverinfo: "skip",
              },
              markerTrace(evenStates, EVEN_COLOR),
              markerTrace(oddStates, ODD_COLOR),
            ]}
            layout={{
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: {
                color: "rgb(143 152 169)",
                family: "var(--font-geist-sans), system-ui, sans-serif",
                size: 12,
              },
              height,
              margin: { t: 18, r: 18, b: 44, l: 48 },
              showlegend: false,
              hovermode: "closest",
              uirevision: `graphical-${M}`,
              hoverlabel: {
                bgcolor: "rgb(24 28 39)",
                bordercolor: "rgb(52 60 77)",
                font: {
                  family: "var(--font-geist-mono), ui-monospace, monospace",
                  color: "rgb(232 235 242)",
                  size: 11,
                },
              },
              // Both axes need constrain: "domain". It makes Plotly satisfy the
              // 1:1 scale ratio by shrinking the drawing area rather than by
              // widening a range — leave it off the x axis and Plotly stretches
              // x past M instead, which flattens the circle into an ellipse and
              // lifts it off the y axis.
              xaxis: { ...axis("X = ka", M), constrain: "domain" as const },
              yaxis: {
                ...axis("Y = βa", M),
                scaleanchor: "x" as const,
                scaleratio: 1,
                constrain: "domain" as const,
              },
            }}
            config={{
              displayModeBar: false,
              responsive: true,
              doubleClick: "reset",
            }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <Slider
            label={<Tex>{`R`}</Tex>}
            hint="well radius √(2mV₀a²)/ℏ"
            value={R}
            onChange={setR}
            min={0.2}
            max={rMax}
            step={0.01}
          />

          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-[11px] text-muted">
            <LegendRow color={EVEN_COLOR} label="Y = X tan X" note="even" />
            <LegendRow color={ODD_COLOR} label="Y = −X cot X" note="odd" />
            <LegendRow color={CIRCLE_COLOR} label="X² + Y² = R²" dashed />
            <div className="pt-1 text-[10.5px] leading-relaxed">
              Curves are the matching condition; dots are the solved states.
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface/40 px-4 py-2.5 text-xs text-muted">
        <span>
          {loading && states.length === 0 ? (
            "solving…"
          ) : (
            <>
              {states.length} bound state{states.length === 1 ? "" : "s"} —{" "}
              {states.map((s) => s.parity).join(", ")}
            </>
          )}
        </span>
        {/* Just past a threshold the newest state is bound by a whisker, and
            its tail is longer than the solver's box — so the solver legitimately
            fails to find a state the construction promises. Say so rather than
            quietly disagreeing with the formula on screen. */}
        {missing > 0 && (
          <span className="shrink-0">
            {missing} more predicted, too diffuse for the solver box
          </span>
        )}
        <span className="ml-auto shrink-0">
          next branch at R ={" "}
          <span className="font-mono text-foreground">
            {threshold(predictedCount(R)).toFixed(2)}
          </span>
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

function statesFor(data: EigenstatesResponse | null, depth: number): WellState[] {
  if (!data) return [];
  return statesFromEigenstates(data.x, data.energies, data.wavefunctions, depth);
}

function LegendRow({
  color,
  label,
  note,
  dashed,
}: {
  color: string;
  label: string;
  note?: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-0 w-4 shrink-0"
        style={{ borderTop: `2px ${dashed ? "dotted" : "solid"} ${color}` }}
      />
      <span className="font-mono">{label}</span>
      {note && <span className="ml-auto">{note}</span>}
    </div>
  );
}

function markerTrace(states: WellState[], color: string) {
  return {
    x: states.map((s) => s.X),
    y: states.map((s) => s.Y),
    type: "scatter" as const,
    mode: "markers" as const,
    marker: {
      size: 9,
      color,
      line: { color: "rgb(16 19 27)", width: 1.5 },
    },
    text: states.map((s) => `n=${s.n} ${s.parity}, E/V₀=${s.energy.toFixed(3)}`),
    hovertemplate: "%{text}<br>X=%{x:.3f}, Y=%{y:.3f}<extra></extra>",
  };
}

// Every branch of both families, as one polyline per parity with null gaps
// between branches so a single trace carries a single colour.
function buildBranches(M: number) {
  const even = { x: [] as (number | null)[], y: [] as (number | null)[] };
  const odd = { x: [] as (number | null)[], y: [] as (number | null)[] };

  for (let n = 0; threshold(n) < M; n++) {
    const target = n % 2 === 0 ? even : odd;
    const lo = threshold(n);
    const hi = Math.min(threshold(n + 1), M);

    if (target.x.length > 0) {
      target.x.push(null);
      target.y.push(null);
    }

    for (let i = 0; i <= SAMPLES; i++) {
      const X = lo + ((hi - lo) * i) / SAMPLES;
      const Y = branchY(n, X);
      if (!Number.isFinite(Y)) continue;
      // Y climbs monotonically on each branch, so cutting at the top of the
      // frame just ends the line there instead of leaving a spike.
      if (Y > M * 1.1) break;
      // Every branch starts at Y = 0, but tan at the foot (X = nπ/2) lands a
      // hair on the wrong side of zero — tan(π) is -1.2e-16 — so the first
      // sample of each branch comes back very slightly negative. Clamp it
      // rather than treating it as the end of the curve.
      target.x.push(X);
      target.y.push(Math.max(0, Y));
    }
  }

  return { even, odd };
}

function buildCircle(R: number) {
  const x: number[] = [];
  const y: number[] = [];
  const steps = 300;
  for (let i = 0; i <= steps; i++) {
    const theta = (Math.PI / 2) * (i / steps);
    x.push(R * Math.cos(theta));
    y.push(R * Math.sin(theta));
  }
  return { x, y };
}

function axis(title: string, M: number) {
  return {
    title: {
      text: title,
      standoff: 8,
      font: {
        family: "var(--font-serif), Georgia, serif",
        size: 15,
        color: "rgb(143 152 169)",
      },
    },
    range: [0, M],
    autorange: false as const,
    showline: true,
    linecolor: "rgb(143 152 169)",
    linewidth: 1.2,
    ticks: "outside" as const,
    ticklen: 5,
    tickcolor: "rgb(143 152 169)",
    tickwidth: 1.2,
    showgrid: false,
    zeroline: false,
    tickfont: {
      family: "var(--font-geist-mono), ui-monospace, monospace",
      size: 10.5,
      color: "rgb(99 108 126)",
    },
  };
}
