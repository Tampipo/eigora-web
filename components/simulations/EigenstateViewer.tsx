"use client";

// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  eigenstatesQmEigenstatesPost,
  type eigenstatesQmEigenstatesPostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type {
  EigenstatesResponse,
  GridSchema,
  PotentialSchema,
  PotentialSchemaParams,
  PotentialType,
} from "@/lib/api/schemas";
import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface EigenstateViewerProps {
  potential: PotentialType;
  params?: PotentialSchemaParams;
  nStates?: number;
  grid?: GridSchema;
  height?: number;
  caption?: string;
}

export function EigenstateViewer({
  potential,
  params: initialParams,
  nStates: initialNStates = 5,
  grid,
  height = 420,
  caption,
}: EigenstateViewerProps) {
  const [params, setParams] = useState<PotentialSchemaParams>(
    initialParams ?? defaultParamsFor(potential),
  );
  const [nStates, setNStates] = useState<number>(initialNStates);

  // Reset when the underlying potential type prop changes
  useEffect(() => {
    setParams(initialParams ?? defaultParamsFor(potential));
    setNStates(initialNStates);
  }, [potential, initialParams, initialNStates]);

  // No debounce: we feed live params straight in. useEigenstates coalesces with
  // an in-flight guard (latest-wins), so the plot chases the slider as fast as
  // the server can answer instead of freezing until the drag ends.
  const schema = useMemo<PotentialSchema>(
    () => ({ type: potential, params }),
    [potential, params],
  );

  const { data, fetchedParams, error, loading } = useEigenstates(
    schema,
    nStates,
    grid,
  );

  // Optimistic translation: x0 only shifts V(x) and ψₙ(x) horizontally, so we
  // apply the delta between the live x0 and the x0 the current data was solved
  // at instantly on the client. The motion is exact, so the incoming server
  // frame lands without a visible snap.
  const liveX0 = (params as Record<string, number | undefined> | null)?.x0;
  const fetchedX0 = (fetchedParams as Record<string, number | undefined> | null)
    ?.x0;
  const xShift =
    typeof liveX0 === "number" && typeof fetchedX0 === "number"
      ? liveX0 - fetchedX0
      : 0;

  const traces = useMemo(
    () => (data ? buildTraces(data, xShift) : []),
    [data, xShift],
  );

  // Fix the x-domain to the solver grid so the optimistic shift visibly slides
  // the curve rather than being hidden by autoranging.
  const xRange = useMemo<[number, number] | undefined>(
    () => (data ? [data.x[0], data.x[data.x.length - 1]] : undefined),
    [data],
  );

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
        <div className="relative" style={{ minHeight: height }}>
          {loading && !data && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <Spinner /> Solving Schrödinger equation…
              </span>
            </div>
          )}
          {error && !data && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-400">
              {error.message}
            </div>
          )}
          {data && (
            <Plot
              data={traces}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: {
                  color: "rgb(160 168 184)",
                  family:
                    "var(--font-geist-sans), system-ui, sans-serif",
                  size: 12,
                },
                height,
                margin: { t: 20, r: 24, b: 46, l: 58 },
                // Persist zoom/pan + suppress full relayout across param updates,
                // keyed to the potential type so it resets on a genuine change.
                uirevision: potential,
                hoverlabel: {
                  bgcolor: "rgb(24 28 39)",
                  bordercolor: "rgb(52 60 77)",
                  font: {
                    family: "var(--font-geist-mono), ui-monospace, monospace",
                    color: "rgb(232 235 242)",
                    size: 11,
                  },
                },
                xaxis: {
                  title: { text: "x", standoff: 12 },
                  range: xRange,
                  autorange: xRange ? false : true,
                  gridcolor: "rgba(255,255,255,0.045)",
                  zerolinecolor: "rgba(255,255,255,0.14)",
                  tickfont: { size: 11 },
                  linecolor: "rgba(255,255,255,0.14)",
                  showline: true,
                  ticks: "outside",
                  ticklen: 4,
                  tickcolor: "rgba(255,255,255,0.18)",
                },
                yaxis: {
                  title: { text: "Energy", standoff: 16 },
                  gridcolor: "rgba(255,255,255,0.045)",
                  zerolinecolor: "rgba(255,255,255,0.14)",
                  tickfont: { size: 11 },
                  linecolor: "rgba(255,255,255,0.14)",
                  showline: true,
                  ticks: "outside",
                  ticklen: 4,
                  tickcolor: "rgba(255,255,255,0.18)",
                },
                showlegend: false,
                hovermode: "closest",
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
              <Spinner /> updating
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <ParamSliders
            potential={potential}
            params={params}
            onChange={setParams}
          />
          <div className="mt-4">
            <Slider
              label={<Tex>{`N_{\\text{states}}`}</Tex>}
              value={nStates}
              onChange={(v) => setNStates(Math.round(v))}
              min={1}
              max={12}
              step={1}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <Legend />
        {data && (
          <span className="font-mono tabular-nums">
            {data.n_states} states · {data.x.length} pts
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

function ParamSliders({
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

  // Cast to any once per slider — the underlying union is heterogeneous and
  // narrowing via discriminated checks per param would balloon the code.
  const p = (params ?? {}) as Record<string, number | undefined>;

  switch (potential) {
    case "harmonic":
      return (
        <div className="space-y-3.5">
          <Slider
            label={<Tex>{`\\omega`}</Tex>}
            hint="frequency"
            value={p.omega ?? 1}
            onChange={(v) => set("omega", v)}
            min={0.2}
            max={3}
            step={0.05}
          />
          <Slider
            label={<Tex>{`x_0`}</Tex>}
            hint="center"
            value={p.x0 ?? 0}
            onChange={(v) => set("x0", v)}
            min={-5}
            max={5}
            step={0.1}
          />
        </div>
      );
    case "barrier":
      return (
        <div className="space-y-3.5">
          <Slider
            label={<Tex>{`V_0`}</Tex>}
            hint="height"
            value={p.height ?? 2}
            onChange={(v) => set("height", v)}
            min={0.5}
            max={20}
            step={0.1}
          />
          <Slider
            label={<Tex>{`a`}</Tex>}
            hint="width"
            value={p.width ?? 1}
            onChange={(v) => set("width", v)}
            min={0.1}
            max={5}
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
        </div>
      );
    case "finite_well":
      return (
        <div className="space-y-3.5">
          <Slider
            label={<Tex>{`V_0`}</Tex>}
            hint="depth"
            value={p.depth ?? 5}
            onChange={(v) => set("depth", v)}
            min={0.5}
            max={30}
            step={0.1}
          />
          <Slider
            label={<Tex>{`L`}</Tex>}
            hint="width"
            value={p.width ?? 4}
            onChange={(v) => set("width", v)}
            min={0.5}
            max={10}
            step={0.1}
          />
          <Slider
            label={<Tex>{`x_0`}</Tex>}
            value={p.x0 ?? 0}
            onChange={(v) => set("x0", v)}
            min={-5}
            max={5}
            step={0.1}
          />
        </div>
      );
    case "infinite_well":
      return (
        <div className="space-y-3.5">
          <Slider
            label={<Tex>{`L`}</Tex>}
            hint="width"
            value={p.width ?? 4}
            onChange={(v) => set("width", v)}
            min={0.5}
            max={10}
            step={0.1}
          />
          <Slider
            label={<Tex>{`x_0`}</Tex>}
            value={p.x0 ?? 0}
            onChange={(v) => set("x0", v)}
            min={-5}
            max={5}
            step={0.1}
          />
        </div>
      );
    case "step":
      return (
        <div className="space-y-3.5">
          <Slider
            label={<Tex>{`V_0`}</Tex>}
            hint="height"
            value={p.height ?? 1}
            onChange={(v) => set("height", v)}
            min={-5}
            max={10}
            step={0.1}
          />
          <Slider
            label={<Tex>{`x_0`}</Tex>}
            value={p.x0 ?? 0}
            onChange={(v) => set("x0", v)}
            min={-5}
            max={5}
            step={0.1}
          />
        </div>
      );
    case "double_well":
      return (
        <div className="space-y-3.5">
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
        </div>
      );
    default:
      return (
        <p className="text-xs text-muted">
          No tunable parameters for this potential.
        </p>
      );
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

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <LegendKey color="rgb(190 197 210)" label="V(x)" dashed />
      <LegendKey color="rgb(124 160 255)" label="ψₙ(x) shifted by Eₙ" />
      <LegendKey color="rgb(255 200 120)" label="Eₙ" dashed />
    </div>
  );
}

function LegendKey({
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

function useEigenstates(
  potential: PotentialSchema,
  nStates: number,
  grid: GridSchema | undefined,
) {
  const [data, setData] = useState<EigenstatesResponse | null>(null);
  const [fetchedParams, setFetchedParams] =
    useState<PotentialSchemaParams>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const requestKey = JSON.stringify({
    potential,
    n_states: nStates,
    ...(grid ? { grid } : {}),
  });

  // Latest-wins scheduler: at most one request in flight. New parameter values
  // that arrive while a solve is running are stored as "pending" (only the most
  // recent is kept) and fired the instant the current one resolves. This lets
  // the plot track a dragging slider smoothly without ever flooding the API.
  const inFlight = useRef(false);
  const pending = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const fire = (key: string) => {
      inFlight.current = true;
      setLoading(true);
      setError(null);
      const body = JSON.parse(key);

      eigenstatesQmEigenstatesPost(body)
        .then((res: eigenstatesQmEigenstatesPostResponse) => {
          if (!alive.current) return;
          if (res.status === 200) {
            setData(res.data as EigenstatesResponse);
            setFetchedParams(
              (body.potential?.params ?? null) as PotentialSchemaParams,
            );
          } else {
            setError(
              new Error(
                `API returned ${res.status}: ${JSON.stringify(res.data)}`,
              ),
            );
          }
        })
        .catch((e: unknown) => {
          if (!alive.current) return;
          setError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          inFlight.current = false;
          if (!alive.current) return;
          const next = pending.current;
          if (next && next !== key) {
            pending.current = null;
            fire(next);
          } else {
            pending.current = null;
            setLoading(false);
          }
        });
    };

    if (inFlight.current) {
      pending.current = requestKey;
    } else {
      fire(requestKey);
    }
  }, [requestKey]);

  return { data, fetchedParams, error, loading };
}

function buildTraces(res: EigenstatesResponse, xShift = 0) {
  const traces: Array<Record<string, unknown>> = [];
  // Optimistic horizontal translation applied while the server catches up.
  const xs = xShift ? res.x.map((v) => v + xShift) : res.x;

  traces.push({
    x: xs,
    y: res.potential,
    mode: "lines",
    line: { color: "rgba(190, 197, 210, 0.65)", width: 1.5, dash: "dot" },
    name: "V(x)",
    hovertemplate: "V(%{x:.2f}) = %{y:.2f}<extra></extra>",
  });

  const amplitude = computeAmplitude(res.energies);

  res.energies.forEach((E, n) => {
    const psi = res.wavefunctions[n];
    const color = stateColor(n, res.energies.length);
    const shifted = psi.map((v) => v * amplitude + E);
    const baseline = xs.map(() => E);

    traces.push({
      x: xs,
      y: baseline,
      mode: "lines",
      line: { color: "rgba(255, 200, 120, 0.35)", width: 1, dash: "dot" },
      hoverinfo: "skip",
      showlegend: false,
    });

    traces.push({
      x: xs,
      y: shifted,
      mode: "lines",
      line: { color, width: 1.75 },
      fill: "tonexty",
      fillcolor: hexAlpha(color, 0.12),
      name: `ψ${subscript(n)}, E${subscript(n)} = ${E.toFixed(3)}`,
      hovertemplate: `ψ${subscript(n)}(x=%{x:.2f}) shifted = %{y:.3f}<extra></extra>`,
    });
  });

  return traces;
}

function computeAmplitude(energies: number[]) {
  if (energies.length < 2) return 1;
  const spacing = Math.abs(energies[1] - energies[0]);
  return Math.max(spacing * 0.4, 0.1);
}

// Perceptual cool→warm ramp keyed to the eigenstate index n (low energy = cool).
const STATE_PALETTE = [
  "rgb(124, 160, 255)",
  "rgb(108, 190, 240)",
  "rgb(96, 214, 208)",
  "rgb(150, 220, 156)",
  "rgb(224, 208, 132)",
  "rgb(240, 168, 128)",
  "rgb(240, 138, 150)",
];

function stateColor(n: number, total: number) {
  if (total <= STATE_PALETTE.length) return STATE_PALETTE[n];
  const t = n / Math.max(1, total - 1);
  const idx = Math.round(t * (STATE_PALETTE.length - 1));
  return STATE_PALETTE[idx];
}

function hexAlpha(rgb: string, alpha: number): string {
  return rgb.replace(/^rgb\((.+)\)$/, `rgba($1, ${alpha})`);
}

function subscript(n: number): string {
  const digits = "₀₁₂₃₄₅₆₇₈₉";
  return n
    .toString()
    .split("")
    .map((d) => digits[+d] ?? d)
    .join("");
}
