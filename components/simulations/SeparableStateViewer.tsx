"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";
import { customFetch } from "@/lib/http";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Hand-written until POST /qm/separable-state ships in the published
// openapi.yaml and orval regenerates the client into @/lib/api/schemas.
interface SeparableStateResponse {
  x: number[];
  y: number[];
  psi_x: number[];
  psi_y: number[];
  potential_x: number[];
  potential_y: number[];
  energy: number;
  energy_x: number;
  energy_y: number;
  label: number[];
  quantum_numbers: string[];
  degeneracy: number;
  is_exact: boolean;
}

export interface SeparableStateViewerProps {
  /** Width of the well along x; the y width is this divided by the ratio. */
  length?: number;
  /** Initial quantum numbers (physical, 1-based for a box). */
  n1?: number;
  n2?: number;
  /** Initial width ratio L_x / L_y. */
  ratio?: number;
  points?: number;
  height?: number;
  caption?: ReactNode;
}

export function SeparableStateViewer({
  length = 6,
  n1: initialN1 = 3,
  n2: initialN2 = 4,
  ratio: initialRatio = 2,
  points = 96,
  height = 420,
  caption,
}: SeparableStateViewerProps) {
  const [n1, setN1] = useState(initialN1);
  const [n2, setN2] = useState(initialN2);
  const [ratio, setRatio] = useState(initialRatio);

  const lengthY = length / ratio;
  const { data, error, loading } = useSeparableState({
    length,
    lengthY,
    n1,
    n2,
    points,
  });

  // psi(x, y) = psi_x(x) psi_y(y): Plotly wants z indexed [row][col] = [y][x].
  const z = useMemo(() => {
    if (!data) return null;
    return data.psi_y.map((py) => data.psi_x.map((px) => px * py));
  }, [data]);

  const peak = useMemo(
    () => (z ? Math.max(...z.map((row) => Math.max(...row.map(Math.abs)))) : 1),
    [z],
  );

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="relative" style={{ minHeight: height }}>
          {loading && !data && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
              Solving…
            </div>
          )}
          {error && !data && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
              {error.message}
            </div>
          )}
          {data && z && (
            <Plot
              data={[
                {
                  x: data.x,
                  y: data.y,
                  z,
                  type: "heatmap",
                  // Diverging about zero, so a sign change reads as a colour
                  // change: blue for psi < 0, white at the nodes, red for
                  // psi > 0. Symmetric zmin/zmax keep white pinned to 0.
                  colorscale: [
                    [0, "rgb(59 130 246)"],
                    [0.5, "rgb(255 255 255)"],
                    [1, "rgb(239 68 68)"],
                  ],
                  zmin: -peak,
                  zmax: peak,
                  hovertemplate:
                    "x=%{x:.2f}, y=%{y:.2f}<br>ψ=%{z:.3f}<extra></extra>",
                  colorbar: {
                    thickness: 10,
                    outlinewidth: 0,
                    tickfont: {
                      family: "var(--font-geist-mono), ui-monospace, monospace",
                      size: 10,
                      color: "rgb(99 108 126)",
                    },
                  },
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
                uirevision: "separable-state",
                hoverlabel: {
                  bgcolor: "rgb(24 28 39)",
                  bordercolor: "rgb(52 60 77)",
                  font: {
                    family: "var(--font-geist-mono), ui-monospace, monospace",
                    color: "rgb(232 235 242)",
                    size: 11,
                  },
                },
                xaxis: axis("x", [0, length]),
                yaxis: axis("y", [0, lengthY]),
              }}
              config={{
                displayModeBar: false,
                responsive: true,
                doubleClick: "reset",
              }}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          )}
          {loading && data && (
            <div className="absolute right-3 top-3 text-[10px] uppercase tracking-wider text-muted">
              updating
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <div className="space-y-3.5">
            <Slider
              label={<Tex>{`n_1`}</Tex>}
              hint={<Tex>{`\\text{nodes across } x`}</Tex>}
              value={n1}
              onChange={(v) => setN1(Math.round(v))}
              min={1}
              max={8}
              step={1}
              format={(v) => v.toFixed(0)}
            />
            <Slider
              label={<Tex>{`n_2`}</Tex>}
              hint={<Tex>{`\\text{nodes across } y`}</Tex>}
              value={n2}
              onChange={(v) => setN2(Math.round(v))}
              min={1}
              max={8}
              step={1}
              format={(v) => v.toFixed(0)}
            />
            <Slider
              label={<Tex>{`r`}</Tex>}
              hint={<Tex>{`\\text{width ratio } L_x/L_y`}</Tex>}
              value={ratio}
              onChange={setRatio}
              min={0.5}
              max={3}
              step={0.05}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <span className="inline-flex flex-wrap items-center gap-x-1">
          {data ? (
            <>
              {data.quantum_numbers.map((qn, i) => (
                <span key={qn} className="inline-flex items-center">
                  <Tex>{`${qn} = ${data.label[i]}`}</Tex>
                  {i < data.quantum_numbers.length - 1 ? "," : ""}
                </span>
              ))}
              <span>
                {data.degeneracy > 1
                  ? `· ${data.degeneracy}-fold degenerate`
                  : "· non-degenerate"}
              </span>
            </>
          ) : (
            "—"
          )}
        </span>
        {data && (
          <span className="shrink-0 font-mono tabular-nums">
            E = {data.energy.toFixed(3)}
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

function useSeparableState({
  length,
  lengthY,
  n1,
  n2,
  points,
}: {
  length: number;
  lengthY: number;
  n1: number;
  n2: number;
  points: number;
}) {
  const [data, setData] = useState<SeparableStateResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  // Latest-wins: a slider drag fires faster than the server answers, and only
  // the newest request may write to state.
  const latest = useRef(0);

  const body = useMemo(
    () =>
      JSON.stringify({
        grid: {
          x_min: 0,
          x_max: length,
          y_min: 0,
          y_max: lengthY,
          nx: points,
          ny: points,
        },
        potential_x: {
          type: "infinite_well",
          params: { width: length, x0: length / 2 },
        },
        potential_y: {
          type: "infinite_well",
          params: { width: lengthY, x0: lengthY / 2 },
        },
        // The API indexes states from 0; a box numbers them from 1.
        n1: n1 - 1,
        n2: n2 - 1,
      }),
    [length, lengthY, n1, n2, points],
  );

  useEffect(() => {
    const ticket = ++latest.current;
    setLoading(true);
    customFetch<{ data: SeparableStateResponse; status: number }>(
      "/v1/qm/separable-state",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      },
    )
      .then((res) => {
        if (ticket !== latest.current) return;
        if (res.status >= 400) {
          throw new Error(`The solver rejected these parameters (${res.status})`);
        }
        setData(res.data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ticket !== latest.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
  }, [body]);

  return { data, error, loading };
}

function axis(title: string, range: [number, number]) {
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
    range,
    autorange: false,
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
