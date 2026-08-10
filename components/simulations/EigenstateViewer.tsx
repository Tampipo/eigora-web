"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Annotations } from "plotly.js";

import type {
  EigenstatesResponse,
  GridSchema,
  PotentialSchema,
  PotentialSchemaParams,
  PotentialType,
} from "@/lib/api/schemas";
import { useEigenstates } from "@/lib/use-eigenstates";
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

type DisplayMode = "psi" | "prob";

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
  const [mode, setMode] = useState<DisplayMode>("psi");

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

  // The solver grid is much wider than the physics: for ω = 1 the walls reach
  // V = 50 at x = ±10 while the plotted levels sit below 5, so autoranging
  // buries every state in the bottom tenth of the frame. Frame the window on
  // the levels themselves instead.
  const view = useMemo(() => (data ? computeView(data) : null), [data]);

  const traces = useMemo(
    () => (data && view ? buildTraces(data, view, mode, xShift) : []),
    [data, view, mode, xShift],
  );

  const annotations = useMemo<Partial<Annotations>[]>(() => {
    if (!data || !view) return [];
    return data.energies.map((E, n) => ({
      x: view.xRange[1],
      y: E,
      xanchor: "right" as const,
      yanchor: "bottom" as const,
      text: `n = ${n}`,
      showarrow: false,
      font: {
        family: "var(--font-geist-mono), ui-monospace, monospace",
        size: 10,
        color: stateColor(n, data.energies.length),
      },
    }));
  }, [data, view]);

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
                  color: "rgb(143 152 169)",
                  family:
                    "var(--font-geist-sans), system-ui, sans-serif",
                  size: 12,
                },
                height,
                margin: { t: 28, r: 28, b: 52, l: 60 },
                // Persist zoom/pan + suppress full relayout across param updates,
                // keyed to the potential type so it resets on a genuine change.
                uirevision: potential,
                annotations,
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
                  title: {
                    text: "x",
                    standoff: 16,
                    font: {
                      family: "var(--font-serif), Georgia, serif",
                      size: 15,
                      color: "rgb(143 152 169)",
                    },
                  },
                  range: view?.xRange,
                  autorange: view ? false : true,
                  // Clean chart: no vertical grid, no spine, no tick marks —
                  // just floating labels. Vertical rules and outward ticks are
                  // what make a plot read like a spreadsheet.
                  showgrid: false,
                  zeroline: false,
                  showline: false,
                  ticks: "",
                  nticks: 7,
                  tickfont: {
                    family: "var(--font-geist-mono), ui-monospace, monospace",
                    size: 10.5,
                    color: "rgb(99 108 126)",
                  },
                },
                yaxis: {
                  title: {
                    text: "Energy",
                    standoff: 20,
                    font: {
                      family: "var(--font-serif), Georgia, serif",
                      size: 15,
                      color: "rgb(143 152 169)",
                    },
                  },
                  range: view?.yRange,
                  autorange: view ? false : true,
                  // A few very faint horizontal rules only — enough to read a
                  // level off, not enough to compete with the curves.
                  showgrid: true,
                  gridcolor: "rgba(255,255,255,0.05)",
                  gridwidth: 1,
                  zeroline: true,
                  zerolinecolor: "rgba(255,255,255,0.12)",
                  zerolinewidth: 1,
                  showline: false,
                  ticks: "",
                  nticks: 6,
                  tickfont: {
                    family: "var(--font-geist-mono), ui-monospace, monospace",
                    size: 10.5,
                    color: "rgb(99 108 126)",
                  },
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
          <div className="mt-4">
            <ModeToggle value={mode} onChange={setMode} />
          </div>
          {data && <EnergyList energies={data.energies} />}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <Legend mode={mode} />
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
    // No x₀ here: for a parabola centred anywhere, x₀ only slides the whole
    // figure sideways — it changes nothing about the spectrum or the states.
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

function ModeToggle({
  value,
  onChange,
}: {
  value: DisplayMode;
  onChange: (m: DisplayMode) => void;
}) {
  const options: Array<{ id: DisplayMode; label: string }> = [
    { id: "psi", label: "ψₙ" },
    { id: "prob", label: "|ψₙ|²" },
  ];
  return (
    <div>
      <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        Display
      </p>
      <div className="flex gap-0.5 rounded-md bg-surface-2/60 p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={
              "flex-1 rounded px-2 py-1 text-[11px] transition-colors " +
              (value === o.id
                ? "bg-surface-3 text-foreground"
                : "text-muted hover:text-foreground")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EnergyList({ energies }: { energies: number[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        Levels
      </p>
      <ul className="space-y-1 font-mono text-[11px] tabular-nums">
        {energies.map((E, n) => (
          <li key={n} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-[2px] w-3 shrink-0 rounded-full"
              style={{ backgroundColor: stateColor(n, energies.length) }}
            />
            <span className="text-muted">E{subscript(n)}</span>
            <span className="ml-auto text-foreground">{E.toFixed(3)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function defaultParamsFor(p: PotentialType): PotentialSchemaParams {
  switch (p) {
    case "harmonic":
      return { omega: 1.0 };
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

function Legend({ mode }: { mode: DisplayMode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <LegendKey color="rgb(190 197 210)" label="V(x)" dashed />
      <LegendKey
        gradient
        label={
          mode === "psi"
            ? "ψₙ(x), drawn on its level Eₙ"
            : "|ψₙ(x)|², drawn on its level Eₙ"
        }
      />
      <LegendKey color="rgb(255 200 120)" label="Eₙ" dashed />
    </div>
  );
}

function LegendKey({
  color,
  label,
  dashed,
  gradient,
}: {
  color?: string;
  label: string;
  dashed?: boolean;
  gradient?: boolean;
}) {
  // The ψ key stands for a whole family of curves, one colour per n, so it
  // shows the palette ramp rather than pretending they are all one blue.
  const background = gradient
    ? `linear-gradient(to right, ${STATE_PALETTE[0]}, ${
        STATE_PALETTE[Math.floor(STATE_PALETTE.length / 2)]
      }, ${STATE_PALETTE[STATE_PALETTE.length - 1]})`
    : dashed
      ? `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 7px)`
      : color;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-[2px] w-5"
        style={{ background }}
      />
      <span>{label}</span>
    </span>
  );
}

interface View {
  xRange: [number, number];
  yRange: [number, number];
  /** Vertical size, in energy units, of the tallest plotted state. */
  amplitude: number;
}

/**
 * Frame the plot on the states rather than on the solver grid.
 *
 * The grid is deliberately wide so the boundary never clips a wavefunction,
 * which for a rising potential means the *plotted* value range is dominated by
 * the walls: at ω = 1 on x ∈ [-10, 10] the parabola reaches V = 50 while the
 * levels being drawn sit below 5. Autoranging on that squashes every state
 * into the bottom tenth of the figure. So: choose the energy window from the
 * levels, then keep only the x where the potential still fits inside it —
 * which is the classically allowed region plus a little tunnelling tail.
 */
function computeView(res: EigenstatesResponse): View {
  const { energies, potential, x } = res;
  const amplitude = computeAmplitude(energies);
  const eLow = energies[0];
  const eTop = energies[energies.length - 1];

  let vMin = Infinity;
  for (const v of potential) if (v < vMin) vMin = v;

  const yLow = Math.min(vMin, eLow - amplitude);
  const yHigh = eTop + amplitude * 1.9;
  const pad = (yHigh - yLow) * 0.06;

  const yRange: [number, number] = [yLow - pad, yHigh + pad];

  // Walk in from both edges while the potential is off the top of the frame.
  let lo = 0;
  let hi = x.length - 1;
  while (lo < hi && potential[lo] > yRange[1]) lo++;
  while (hi > lo && potential[hi] > yRange[1]) hi--;

  const xPad = Math.max((x[hi] - x[lo]) * 0.1, 1e-6);
  const xRange: [number, number] = [
    Math.max(x[0], x[lo] - xPad),
    Math.min(x[x.length - 1], x[hi] + xPad),
  ];

  return { xRange, yRange, amplitude };
}

function buildTraces(
  res: EigenstatesResponse,
  view: View,
  mode: DisplayMode,
  xShift = 0,
) {
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

  const curves = res.wavefunctions.map((psi) =>
    mode === "prob" ? psi.map((v) => v * v) : psi,
  );

  // One shared vertical scale for every state, sized so the tallest one is
  // `amplitude` high. Scaling each state to its own peak would hide the fact
  // that higher states spread out and flatten.
  let peak = 0;
  for (const curve of curves) {
    for (const v of curve) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
  }
  // |ψ|² only ever goes up, so it can use the full slot; ψ swings both ways
  // and is kept smaller to stop its negative lobes reaching the level below.
  const slot = view.amplitude * (mode === "prob" ? 1 : 0.72);
  const scale = slot / (peak || 1);
  const label = mode === "prob" ? "|ψ|²" : "ψ";

  res.energies.forEach((E, n) => {
    const color = stateColor(n, res.energies.length);
    const shifted = curves[n].map((v) => v * scale + E);
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
      name: `${label}${subscript(n)}, E${subscript(n)} = ${E.toFixed(3)}`,
      hovertemplate: `${label}${subscript(n)}(x=%{x:.2f}) on E${subscript(
        n,
      )} = ${E.toFixed(3)}<extra></extra>`,
    });
  });

  return traces;
}

function computeAmplitude(energies: number[]) {
  if (energies.length < 2) return 1;
  const spacing = Math.abs(energies[1] - energies[0]);
  return Math.max(spacing * 0.75, 0.1);
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
