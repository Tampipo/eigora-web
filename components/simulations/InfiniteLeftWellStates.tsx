"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";
import {
  HALF_WIDTH,
  halfPredictedCount,
  halfWellForRadius,
  halfWellStatesFromEigenstates,
  type HalfWellState,
} from "@/lib/finite-well";
import { useEigenstates } from "@/lib/use-eigenstates";
import type { EigenstatesResponse, GridSchema } from "@/lib/api/schemas";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const STATE_COLOR = "rgb(255,170,110)";
const WALL_COLOR = "rgb(200,205,215)";

// Half-width of the frame, in units of a. Fixed rather than fitted to the
// shallowest state's tail, so a barely-bound state visibly runs off the edge
// instead of being quietly rescaled to look ordinary.
const U_MAX = 4;

// A strip of the forbidden side is kept in frame so the wall reads as a wall
// rather than as the edge of the drawing.
const U_MIN = -0.55;

// The solver's box edge is itself a hard wall — its finite-difference
// Hamiltonian couples only the points it holds, which forces psi to zero one
// step outside the box — so the infinite left wall is the box, and no custom
// V(x) has to be shipped for it. Offsetting x_min by exactly one dx, i.e. by
// x_max / n_points, puts that implied zero at x = 0 rather than at -dx.
const N_POINTS = 2048;
const X_MAX = 10;
const GRID: GridSchema = {
  x_min: X_MAX / N_POINTS,
  x_max: X_MAX,
  n_points: N_POINTS,
};

export interface InfiniteLeftWellStatesProps {
  /** Initial well radius R = sqrt(2 m V0 a^2)/hbar. */
  radius?: number;
  rMax?: number;
  height?: number;
  caption?: ReactNode;
}

export function InfiniteLeftWellStates({
  radius: initialRadius = 5,
  rMax = 12,
  height = 480,
  caption,
}: InfiniteLeftWellStatesProps) {
  const [R, setR] = useState(initialRadius);

  const well = useMemo(() => halfWellForRadius(R), [R]);
  const { data, error, loading } = useEigenstates(
    useMemo(() => ({ type: "finite_well" as const, params: well }), [well]),
    Math.min(20, halfPredictedCount(R) + 2),
    GRID,
  );

  const states = useMemo(() => statesFor(data, well.depth), [data, well.depth]);

  // Every state is drawn on its own level, so the drawing height has to shrink
  // as levels crowd together. Scaling by the state count rather than by the
  // tightest gap keeps this readable: the gaps are wildly uneven — the ground
  // state sits almost on the well floor — and keying off the smallest one
  // flattens every curve in the figure to suit a single crowded pair.
  const amplitude = useMemo(
    () => Math.max(0.07, Math.min(0.22, 0.85 / (states.length + 1))),
    [states.length],
  );

  const yRange: [number, number] = [
    -1 - amplitude - 0.1,
    Math.max(amplitude, 0.12) + 0.1,
  ];

  const gridX = data?.x ?? [];

  // An empty spectrum is a real answer here, not just a slow one, so the two
  // have to be told apart: mid-drag the states on screen still belong to the
  // previous R, and counting them against this one describes the wrong well.
  const settled = data !== null && !loading;
  const missing = settled ? halfPredictedCount(R) - states.length : 0;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="relative" style={{ minHeight: height }}>
          {loading && states.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
              Solving Schrödinger equation…
            </div>
          )}
          {error && !data && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
              {error.message}
            </div>
          )}
          <Plot
            data={[
              // The half-line the wall excludes outright, hatched to say that
              // no amount of energy buys a state any of it.
              {
                x: [U_MIN, 0, 0, U_MIN],
                y: [yRange[0], yRange[0], yRange[1], yRange[1]],
                type: "scatter",
                mode: "lines",
                line: { width: 0, color: "rgba(0,0,0,0)" },
                fill: "toself",
                fillcolor: "rgba(0,0,0,0)",
                fillpattern: {
                  shape: "/",
                  fgcolor: WALL_COLOR,
                  bgcolor: "rgba(0,0,0,0)",
                  size: 7,
                  solidity: 0.1,
                },
                hoverinfo: "skip",
              },
              // The wall, drawn off the top of the frame rather than stopping
              // at a height that would read as a finite step.
              {
                x: [0, 0],
                y: [-1, yRange[1]],
                type: "scatter",
                mode: "lines",
                line: { color: WALL_COLOR, width: 3 },
                hoverinfo: "skip",
              },
              // The rest of the well: the floor across to the open edge, then
              // V = 0 out to the frame.
              {
                x: [0, HALF_WIDTH, HALF_WIDTH, U_MAX],
                y: [-1, -1, 0, 0],
                type: "scatter",
                mode: "lines",
                line: { color: WALL_COLOR, width: 2 },
                hoverinfo: "skip",
              },
              // The energy ladder, faint, under the wavefunctions.
              ...states.map((s) => ({
                x: [0, U_MAX],
                y: [s.energy, s.energy],
                type: "scatter" as const,
                mode: "lines" as const,
                line: { color: "rgb(52 60 77)", width: 1, dash: "dot" as const },
                hoverinfo: "skip" as const,
              })),
              // Every bound state at once, each of them pinned to the wall.
              ...states.map((s) => ({
                x: gridX,
                y: s.psi.map((v) => s.energy + amplitude * v),
                type: "scatter" as const,
                mode: "lines" as const,
                line: { color: STATE_COLOR, width: 1.9 },
                text: `n=${s.n} (odd branch ${s.branch}), E/V₀=${s.energy.toFixed(
                  3,
                )}, ${(s.outsideFraction * 100).toFixed(1)}% outside`,
                hovertemplate: "%{text}<extra></extra>",
              })),
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
              margin: { t: 18, r: 18, b: 44, l: 52 },
              showlegend: false,
              hovermode: "closest",
              uirevision: "infinite-left-well-states",
              hoverlabel: {
                bgcolor: "rgb(24 28 39)",
                bordercolor: "rgb(52 60 77)",
                font: {
                  family: "var(--font-geist-mono), ui-monospace, monospace",
                  color: "rgb(232 235 242)",
                  size: 11,
                },
              },
              // The open edge of the well, carried up through the wavefunctions
              // so it is obvious where the classically forbidden region begins.
              // The other edge needs no such line — it is the wall.
              shapes: [
                {
                  type: "line" as const,
                  x0: HALF_WIDTH,
                  x1: HALF_WIDTH,
                  y0: yRange[0],
                  y1: yRange[1],
                  line: { color: "rgb(52 60 77)", width: 1 },
                  layer: "below" as const,
                },
              ],
              xaxis: { ...axis("x / a"), range: [U_MIN, U_MAX], dtick: 1 },
              yaxis: { ...axis("E / V₀"), range: yRange, dtick: 0.25 },
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
            hint={<Tex>{`R = \\sqrt{2mV_0a^2}/\\hbar`}</Tex>}
            value={R}
            onChange={setR}
            min={0.2}
            max={rMax}
            step={0.01}
          />

          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-[11px] text-muted">
            <LegendRow
              color={WALL_COLOR}
              label={<Tex>{`V(x)`}</Tex>}
              note={<Tex>{`\\infty \\text{ at } x=0`}</Tex>}
            />
            <LegendRow color={STATE_COLOR} label={<Tex>{`\\psi_n`}</Tex>} note="sin inside" />
            <div className="pt-1 text-[10.5px] leading-relaxed">
              The wall forces <Tex>{`\\psi(0) = 0`}</Tex>, so only the odd
              states of the symmetric well survive — and none at all below{" "}
              <Tex>{`R = \\pi/2`}</Tex>.
            </div>
          </div>

          <div className="mt-3 max-h-[190px] overflow-y-auto border-t border-border pt-3">
            <table className="w-full font-mono text-[10.5px] tabular-nums">
              <thead>
                <tr className="text-muted">
                  <th className="pb-1 text-left font-normal">
                    <Tex>{`n`}</Tex>
                  </th>
                  <th className="pb-1 text-right font-normal">
                    <Tex>{`E/V_0`}</Tex>
                  </th>
                  <th className="pb-1 text-right font-normal">out</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.n} style={{ color: STATE_COLOR }}>
                    <td className="py-0.5">{s.n}</td>
                    <td className="py-0.5 text-right">{s.energy.toFixed(3)}</td>
                    <td className="py-0.5 text-right">
                      {(s.outsideFraction * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface/40 px-4 py-2.5 text-xs text-muted">
        <span>
          {states.length > 0
            ? `${states.length} bound state${
                states.length === 1 ? "" : "s"
              } — odd branch${states.length === 1 ? "" : "es"} ${states
                .map((s) => s.branch)
                .join(", ")}`
            : settled
              ? "no bound state — the wall costs this well its ground state"
              : "solving…"}
        </span>
        {/* See FiniteWellGraphical: just past a threshold the newest state's
            tail outruns the solver box, so the count can fall one short of the
            construction's. */}
        {missing > 0 && (
          <span className="shrink-0">
            {missing} more predicted, too diffuse for the solver box
          </span>
        )}
        {states.length > 0 && (
          <span className="ml-auto shrink-0">
            highest state leaks{" "}
            <span className="font-mono text-foreground">
              {(states[states.length - 1].outsideFraction * 100).toFixed(1)}%
            </span>{" "}
            outside
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

function statesFor(
  data: EigenstatesResponse | null,
  depth: number,
): HalfWellState[] {
  if (!data) return [];
  return halfWellStatesFromEigenstates(
    data.x,
    data.energies,
    data.wavefunctions,
    depth,
  );
}

function LegendRow({
  color,
  label,
  note,
  dashed,
}: {
  color: string;
  label: ReactNode;
  note?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-0 w-4 shrink-0"
        style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
      />
      <span>{label}</span>
      {note && <span className="ml-auto font-mono">{note}</span>}
    </div>
  );
}

function axis(title: string) {
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
