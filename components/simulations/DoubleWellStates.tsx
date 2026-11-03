"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import type { Config, Layout } from "plotly.js";

import { Tex } from "@/components/ui/Tex";
import type { GridSchema, PotentialSchema } from "@/lib/api/schemas";
import { useEigenstates } from "@/lib/use-eigenstates";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// V(x) = x^4 - 4x^2: minima at x = +-sqrt(2), barrier of height 4 at x = 0.
// One tunneling doublet fits under the barrier and the third level lands just
// above its top, which is the whole story of the two-state model in a picture.
const POTENTIAL: PotentialSchema = {
  type: "double_well",
  params: { a: 1, b: 4 },
};
const WELL_X = Math.SQRT2;

// Wide enough that every state shown has died off long before the walls.
const GRID: GridSchema = { x_min: -4, x_max: 4, n_points: 801 };

const X_RANGE: [number, number] = [-2.5, 2.5];
const E_RANGE: [number, number] = [-4.4, 1.4];
// One shared scale for both wavefunction panels, so the localized states are
// visibly sqrt(2) taller than the eigenstates they are built from.
const PSI_RANGE: [number, number] = [-1.15, 1.15];

const ENERGY_HEIGHT = 230;
const PSI_HEIGHT = 140;

// Same palette as AmmoniaInversion, so |S>, |A>, |L>, |R> keep their colours
// across the page.
const SYM_COLOR = "rgb(120, 220, 180)";
const ANTI_COLOR = "rgb(232, 160, 210)";
const RIGHT_COLOR = "rgb(124, 160, 255)";
const LEFT_COLOR = "rgb(255, 160, 120)";
const WALL_COLOR = "rgb(200, 205, 215)";
const THIRD_COLOR = "rgb(143, 152, 169)";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

export interface DoubleWellStatesProps {
  caption?: ReactNode;
}

export function DoubleWellStates({ caption }: DoubleWellStatesProps) {
  const { data, error, loading } = useEigenstates(POTENTIAL, 3, GRID);

  const states = useMemo(() => {
    if (!data || data.wavefunctions.length < 3) return null;
    const [sym, odd] = data.wavefunctions;

    // The solver signs each state positive at its largest value, but the odd
    // state's two lobes are equal, so which one wins is down to rounding. Fix
    // psi_A positive in the right well: then psi_R is always the sum, matching
    // |R> = (|S> + |A>)/sqrt(2) in the text.
    const iRight = data.x.findIndex((v) => v >= WELL_X);
    const sign = odd[iRight] < 0 ? -1 : 1;
    const anti = odd.map((v) => sign * v);

    return {
      x: data.x,
      potential: data.potential,
      energies: data.energies,
      sym,
      anti,
      left: sym.map((v, i) => (v - anti[i]) * Math.SQRT1_2),
      right: sym.map((v, i) => (v + anti[i]) * Math.SQRT1_2),
    };
  }, [data]);

  const levels = states
    ? [
        { E: states.energies[0], color: SYM_COLOR, tex: "E_S", html: "E<sub>S</sub>" },
        { E: states.energies[1], color: ANTI_COLOR, tex: "E_A", html: "E<sub>A</sub>" },
        { E: states.energies[2], color: THIRD_COLOR, tex: "E_3", html: "E<sub>3</sub>" },
      ]
    : [];

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border px-4 py-2.5 text-[11px] text-muted">
        <Tex className="normal-case">{`V(x) = x^4 - 4x^2`}</Tex>
        <span className="text-border">·</span>
        <span className="text-faint">
          units with <Tex className="normal-case">{`\\hbar = m = 1`}</Tex>
        </span>
      </div>

      <div className="relative" style={{ minHeight: ENERGY_HEIGHT + 2 * PSI_HEIGHT + 80 }}>
        {!states && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {loading ? "Solving Schrödinger equation…" : null}
          </div>
        )}
        {error && !states && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
            {error.message}
          </div>
        )}

        {states && (
          <>
            <Plot
              data={[
                {
                  x: states.x,
                  y: states.potential,
                  type: "scatter",
                  mode: "lines",
                  line: { color: WALL_COLOR, width: 2 },
                  hovertemplate: "V(%{x:.2f}) = %{y:.2f}<extra></extra>",
                },
                ...levels.map((l) => ({
                  x: X_RANGE,
                  y: [l.E, l.E],
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: l.color, width: 1.6 },
                  hovertemplate: `${l.html} = ${l.E.toFixed(3)}<extra></extra>`,
                })),
              ]}
              layout={layout(ENERGY_HEIGHT, {
                yaxis: { ...axis("E"), range: E_RANGE, dtick: 1 },
                xaxis: { ...axis(""), range: X_RANGE, showticklabels: false },
                // E_S and E_A sit a few pixels apart, too close for two labels,
                // so the doublet is named once.
                annotations: [
                  {
                    x: X_RANGE[1],
                    y: levels[1].E,
                    xanchor: "right",
                    yanchor: "bottom",
                    text: `<span style="color:${SYM_COLOR}">E<sub>S</sub></span>, <span style="color:${ANTI_COLOR}">E<sub>A</sub></span>`,
                    showarrow: false,
                    font: { family: MONO, size: 11 },
                  },
                  {
                    x: X_RANGE[1],
                    y: levels[2].E,
                    xanchor: "right",
                    yanchor: "bottom",
                    text: "E<sub>3</sub>",
                    showarrow: false,
                    font: { family: MONO, size: 11, color: THIRD_COLOR },
                  },
                ],
              })}
              config={CONFIG}
              useResizeHandler
              style={{ width: "100%" }}
            />

            <PanelHeader>
              <Key color={SYM_COLOR}>
                <Tex>{`\\psi_S`}</Tex> symmetric
              </Key>
              <Key color={ANTI_COLOR} dashed>
                <Tex>{`\\psi_A`}</Tex> antisymmetric
              </Key>
            </PanelHeader>
            <Plot
              data={[
                wave(states.x, states.sym, SYM_COLOR, "ψ<sub>S</sub>"),
                wave(states.x, states.anti, ANTI_COLOR, "ψ<sub>A</sub>", true),
              ]}
              layout={layout(PSI_HEIGHT, {
                yaxis: { ...axis("ψ"), range: PSI_RANGE, dtick: 1 },
                xaxis: { ...axis(""), range: X_RANGE, showticklabels: false },
              })}
              config={CONFIG}
              useResizeHandler
              style={{ width: "100%" }}
            />

            <PanelHeader>
              <Key color={RIGHT_COLOR}>
                <Tex>{`\\psi_R = (\\psi_S + \\psi_A)/\\sqrt2`}</Tex>
              </Key>
              <Key color={LEFT_COLOR}>
                <Tex>{`\\psi_L = (\\psi_S - \\psi_A)/\\sqrt2`}</Tex>
              </Key>
            </PanelHeader>
            <Plot
              data={[
                wave(states.x, states.right, RIGHT_COLOR, "ψ<sub>R</sub>"),
                wave(states.x, states.left, LEFT_COLOR, "ψ<sub>L</sub>"),
              ]}
              layout={layout(PSI_HEIGHT + 36, {
                margin: { t: 6, r: 18, b: 42, l: 52 },
                yaxis: { ...axis("ψ"), range: PSI_RANGE, dtick: 1 },
                xaxis: { ...axis("x"), range: X_RANGE, dtick: 1 },
              })}
              config={CONFIG}
              useResizeHandler
              style={{ width: "100%" }}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-surface/40 px-4 py-2.5 font-mono text-xs tabular-nums text-muted">
        {states ? (
          <>
            {levels.map((l) => (
              <span key={l.tex}>
                <span style={{ color: l.color }}>
                  <Tex>{l.tex}</Tex>
                </span>{" "}
                ={" "}
                <span className="text-foreground">{l.E.toFixed(3)}</span>
              </span>
            ))}
            <span className="text-border">·</span>
            <span>
              <Tex>{`2\\Delta = E_A - E_S`}</Tex> ={" "}
              <span className="text-foreground">
                {(states.energies[1] - states.energies[0]).toFixed(3)}
              </span>
            </span>
          </>
        ) : (
          <span>solving…</span>
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

const CONFIG: Partial<Config> = {
  displayModeBar: false,
  responsive: true,
  doubleClick: false,
};

function wave(x: number[], y: number[], color: string, name: string, dashed = false) {
  return {
    x,
    y,
    type: "scatter" as const,
    mode: "lines" as const,
    line: { color, width: 1.9, dash: dashed ? ("dash" as const) : ("solid" as const) },
    fill: "tozeroy" as const,
    fillcolor: color.replace(/^rgb\((.+)\)$/, "rgba($1, 0.1)"),
    hovertemplate: `${name}(%{x:.2f}) = %{y:.3f}<extra></extra>`,
  };
}

function layout(height: number, extra: Partial<Layout>): Partial<Layout> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      color: "rgb(143 152 169)",
      family: "var(--font-geist-sans), system-ui, sans-serif",
      size: 12,
    },
    height,
    margin: { t: 6, r: 18, b: 8, l: 52 },
    showlegend: false,
    hovermode: "closest" as const,
    dragmode: false as const,
    hoverlabel: {
      bgcolor: "rgb(24 28 39)",
      bordercolor: "rgb(52 60 77)",
      font: { family: MONO, color: "rgb(232 235 242)", size: 11 },
    },
    // x = 0, the top of the barrier, carried through every panel.
    shapes: [
      {
        type: "line" as const,
        xref: "x" as const,
        yref: "paper" as const,
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 1,
        line: { color: "rgb(52 60 77)", width: 1, dash: "dot" as const },
        layer: "below" as const,
      },
    ],
    ...extra,
  };
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
    fixedrange: true,
    showline: true,
    linecolor: "rgb(143 152 169)",
    linewidth: 1.2,
    ticks: "outside" as const,
    ticklen: 5,
    tickcolor: "rgb(143 152 169)",
    tickwidth: 1.2,
    showgrid: false,
    zeroline: false,
    tickfont: { family: MONO, size: 10.5, color: "rgb(99 108 126)" },
  };
}

function PanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 pb-1 pt-2.5 text-[11px] text-muted">
      {children}
    </div>
  );
}

function Key({
  color,
  dashed,
  children,
}: {
  color: string;
  dashed?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-0 w-4 shrink-0"
        style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
      />
      <span>{children}</span>
    </span>
  );
}
