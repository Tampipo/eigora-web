"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// A state of a particle in a 2D box sits at an integer point of the (n1, n2)
// lattice, and its energy in units of pi^2 / 2 L_x^2 is
//
//     E = n1^2 + r^2 n2^2,   r = L_x / L_y
//
// so the states of a given energy are the lattice points on an ellipse. Nothing
// here needs the API: the whole picture is that one equation.
const N_MAX = 20;

// Two energies count as equal within this much — E moves in steps of 1, but r
// is continuous, so exact hits would otherwise be measure-zero.
const TOLERANCE = 0.15;

export interface DegeneracyLatticeProps {
  /** Initial width ratio L_x / L_y. */
  ratio?: number;
  /** Initial energy in units of pi^2 / 2 L_x^2. */
  energy?: number;
  height?: number;
  caption?: ReactNode;
}

export function DegeneracyLattice({
  ratio: initialRatio = 1.0,
  energy: initialEnergy = 25,
  height = 420,
  caption,
}: DegeneracyLatticeProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const [energy, setEnergy] = useState(initialEnergy);

  const { lattice, degenerate, ellipse } = useMemo(
    () => buildLattice(ratio, energy),
    [ratio, energy],
  );

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="relative" style={{ minHeight: height }}>
          <Plot
            data={[
              {
                x: lattice.x,
                y: lattice.y,
                type: "scatter",
                mode: "markers",
                marker: { size: 4.5, color: "rgb(99 108 126)" },
                hovertemplate: "n₁=%{x}, n₂=%{y}<extra></extra>",
              },
              {
                x: ellipse.x,
                y: ellipse.y,
                type: "scatter",
                mode: "lines",
                line: { color: "rgb(232 235 242)", width: 1.5 },
                hoverinfo: "skip",
              },
              {
                x: degenerate.x,
                y: degenerate.y,
                type: "scatter",
                mode: "markers",
                marker: { size: 9, color: "rgb(239 68 68)" },
                hovertemplate: "n₁=%{x}, n₂=%{y}<extra>on the ellipse</extra>",
              },
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
              margin: { t: 18, r: 18, b: 40, l: 44 },
              showlegend: false,
              hovermode: "closest",
              uirevision: "degeneracy-lattice",
              hoverlabel: {
                bgcolor: "rgb(24 28 39)",
                bordercolor: "rgb(52 60 77)",
                font: {
                  family: "var(--font-geist-mono), ui-monospace, monospace",
                  color: "rgb(232 235 242)",
                  size: 11,
                },
              },
              // No scaleanchor: tying the two axes together lets Plotly rewrite
              // the ranges to satisfy the aspect ratio, which slides the origin
              // off-view and cuts the arc short of the axes. Both ranges are
              // pinned to [0, N_MAX + 1] instead, so the arc always lands on
              // the spines at (sqrt(E), 0) and (0, sqrt(E)/r).
              xaxis: axis("n₁"),
              yaxis: axis("n₂"),
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
          <div className="space-y-3.5">
            <Slider
              label={<Tex>{`r`}</Tex>}
              hint={<Tex>{`\\text{width ratio } L_x/L_y`}</Tex>}
              value={ratio}
              onChange={setRatio}
              min={0.25}
              max={3}
              step={0.01}
            />
            <Slider
              label={<Tex>{`E`}</Tex>}
              hint={<Tex>{`\\text{in units of } \\pi^2/2L_x^2`}</Tex>}
              value={energy}
              onChange={setEnergy}
              min={1}
              max={200}
              step={1}
              format={(v) => v.toFixed(0)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <Readout ratio={ratio} states={degenerate.labels} />
        <span className="shrink-0 font-mono tabular-nums">
          ×{degenerate.labels.length}
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

function Readout({
  ratio,
  states,
}: {
  ratio: number;
  states: [number, number][];
}) {
  if (states.length === 0) {
    return <span>No state on this ellipse — tune E until it meets a point.</span>;
  }
  const list = states.map(([n1, n2]) => `(${n1}, ${n2})`).join(", ");
  if (states.length === 1) {
    return <span>{list} alone on this ellipse — not degenerate.</span>;
  }
  const square = Math.abs(ratio - 1) < 0.005;
  return (
    <span>
      {list} —{" "}
      {square
        ? "degenerate by the symmetry of the square"
        : "an accidental degeneracy, no symmetry relates them"}
    </span>
  );
}

function buildLattice(ratio: number, energy: number) {
  const lattice = { x: [] as number[], y: [] as number[] };
  const degenerate = {
    x: [] as number[],
    y: [] as number[],
    labels: [] as [number, number][],
  };

  for (let n1 = 1; n1 <= N_MAX; n1++) {
    for (let n2 = 1; n2 <= N_MAX; n2++) {
      lattice.x.push(n1);
      lattice.y.push(n2);
      if (Math.abs(n1 * n1 + ratio * ratio * n2 * n2 - energy) < TOLERANCE) {
        degenerate.x.push(n1);
        degenerate.y.push(n2);
        degenerate.labels.push([n1, n2]);
      }
    }
  }

  // The ellipse n1^2 + r^2 n2^2 = E, over the visible quadrant only.
  const semiX = Math.sqrt(energy);
  const semiY = Math.sqrt(energy) / ratio;
  const ellipse = { x: [] as number[], y: [] as number[] };
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const theta = (Math.PI / 2) * (i / steps);
    ellipse.x.push(semiX * Math.cos(theta));
    ellipse.y.push(semiY * Math.sin(theta));
  }

  return { lattice, degenerate, ellipse };
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
    // Start hard at 0 so the arc visibly meets both axes at (sqrt(E), 0) and
    // (0, sqrt(E)/r), and leave a little air past the last lattice column.
    range: [0, N_MAX + 1],
    autorange: false,
    // A quadrant of integers reads best with real axes: a spine, outward ticks
    // every 5, and labels sitting right against them.
    showline: true,
    linecolor: "rgb(143 152 169)",
    linewidth: 1.2,
    ticks: "outside" as const,
    ticklen: 5,
    tickcolor: "rgb(143 152 169)",
    tickwidth: 1.2,
    dtick: 5,
    tick0: 0,
    showgrid: false,
    zeroline: false,
    tickfont: {
      family: "var(--font-geist-mono), ui-monospace, monospace",
      size: 10.5,
      color: "rgb(99 108 126)",
    },
  };
}
