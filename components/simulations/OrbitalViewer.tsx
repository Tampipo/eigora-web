"use client";

// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import dynamic from "next/dynamic";
import { Minus, Plus } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  singleAtomStateQmSingleAtomStatePost,
  type singleAtomStateQmSingleAtomStatePostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type {
  SingleAtomStateRequest,
  SingleAtomStateResponse,
} from "@/lib/api/schemas";
import { useDebouncedValue } from "@/lib/use-debounced";
import { Slider } from "@/components/ui/Slider";
import { Tex } from "@/components/ui/Tex";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Spectroscopic notation skips "j" by convention (avoids confusion with total
// angular momentum quantum number j). Covers l = 0..9, the API's full range.
const ORBITAL_LETTERS = ["s", "p", "d", "f", "g", "h", "i", "k", "l", "m"];

// Diverging blue↔red pair (dataviz skill palette, dark-mode steps) — the
// wavefunction's sign is a polarity, not a magnitude, so it gets two hues
// rather than one light→dark ramp. Validated together: `node
// validate_palette.js "#3987e5,#e66767" --mode dark --surface "#10131b"`
// passes every check (worst CVD ΔE 19.2, normal-vision ΔE 29.0).
const PSI_POSITIVE_COLOR = "#3987e5";
const PSI_NEGATIVE_COLOR = "#e66767";

const PLOT_CONFIG = { displayModeBar: false, responsive: true };

export interface OrbitalViewerProps {
  Z?: number;
  n?: number;
  l?: number;
  m?: number;
  resolution?: number;
  height?: number;
  caption?: string;
}

export function OrbitalViewer({
  Z: initialZ = 1,
  n: initialN = 2,
  l: initialL = 1,
  m: initialM = 0,
  resolution: initialResolution = 112,
  height = 460,
  caption,
}: OrbitalViewerProps) {
  const [Z, setZ] = useState(initialZ);
  const [n, setN] = useState(initialN);
  const [l, setL] = useState(initialL);
  const [m, setM] = useState(initialM);
  const [resolution, setResolution] = useState(initialResolution);
  const [isoFraction, setIsoFraction] = useState(0.12);
  // The 3D scene grabs the mouse wheel for camera zoom the instant the
  // cursor crosses it, which hijacks page scrolling for anyone just reading
  // past the figure. Require a click to arm it first — same pattern as an
  // embedded Google Map — so scroll passes through until you deliberately
  // engage with the plot.
  const [armed, setArmed] = useState(false);

  // n, l, m are coupled (0 <= l < n, -l <= m <= l) — clamp downstream values
  // on every change instead of round-tripping an invalid combo to the API.
  const changeN = (nextN: number) => {
    setN(nextN);
    setL((prevL) => {
      const nextL = Math.min(prevL, nextN - 1);
      setM((prevM) => Math.max(-nextL, Math.min(nextL, prevM)));
      return nextL;
    });
  };

  const changeL = (nextL: number) => {
    setL(nextL);
    setM((prevM) => Math.max(-nextL, Math.min(nextL, prevM)));
  };

  // Every one of these sliders drives an expensive round-trip: a new API
  // request over a ≤160³-point grid, then a full client-side rebuild of the
  // WebGL isosurface mesh. Doing that synchronously on every drag tick starves
  // the browser's own pointer-tracking for the <input type="range"> and makes
  // it feel like the slider "freezes" mid-drag. The slider itself must stay
  // driven by the raw, instant state (below) so it always tracks the pointer
  // smoothly — only the heavy downstream work waits for a short pause.
  const dZ = useDebouncedValue(Z, 200);
  const dN = useDebouncedValue(n, 200);
  const dL = useDebouncedValue(l, 200);
  const dM = useDebouncedValue(m, 200);
  const dResolution = useDebouncedValue(resolution, 200);
  const dIsoFraction = useDebouncedValue(isoFraction, 150);

  // Characteristic radius of a hydrogen-like state scales like n²/Z (Bohr
  // radii). Kept tight (not just "padded generously") because every point
  // spent on near-empty outer space is a point *not* resolving the nodal
  // structure — an over-wide domain at fixed resolution is what turns the
  // isosurface into a coarse, faceted mess for higher n.
  const extent = useMemo(
    () => Math.min(45, Math.max(8, (2.5 * dN * dN) / dZ + 3 * dN)),
    [dN, dZ],
  );

  const request = useMemo<SingleAtomStateRequest>(
    () => ({
      grid: {
        x_min: -extent,
        x_max: extent,
        y_min: -extent,
        y_max: extent,
        z_min: -extent,
        z_max: extent,
        nx: dResolution,
        ny: dResolution,
        nz: dResolution,
      },
      Z: dZ,
      n: dN,
      l: dL,
      m: dM,
    }),
    [extent, dResolution, dZ, dN, dL, dM],
  );

  const { data, error, loading } = useSingleAtomState(request);

  const { traces, boundRadius } = useMemo(
    () =>
      data
        ? buildOrbitalTraces(data, dIsoFraction)
        : { traces: [], boundRadius: extent },
    [data, dIsoFraction, extent],
  );

  const layout = useMemo(
    () => ({
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        color: "rgb(160 168 184)",
        family: "var(--font-geist-sans), system-ui, sans-serif",
        size: 12,
      },
      height,
      margin: { t: 8, r: 0, b: 0, l: 0 },
      // Persist camera position across param updates so exploring quantum
      // numbers doesn't reset the view you rotated to.
      uirevision: "orbital-viewer",
      hoverlabel: {
        bgcolor: "rgb(24 28 39)",
        bordercolor: "rgb(52 60 77)",
        font: {
          family: "var(--font-geist-mono), ui-monospace, monospace",
          color: "rgb(232 235 242)",
          size: 11,
        },
      },
      scene: {
        aspectmode: "cube" as const,
        dragmode: "orbit" as const,
        camera: { eye: { x: 1.35, y: 1.35, z: 1.05 } },
        // No wireframe box, ticks, or axis lines — just the shape. Ranges
        // still sized to its own bounding box (not the much larger
        // computational grid), or it'd float shrunken in a huge empty cube.
        xaxis: sceneAxis(boundRadius),
        yaxis: sceneAxis(boundRadius),
        zaxis: sceneAxis(boundRadius),
      },
    }),
    [height, boundRadius],
  );

  const label = `${dN}${ORBITAL_LETTERS[dL] ?? "?"}`;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="font-serif text-xl font-medium tracking-tight text-foreground">
            {label} orbital
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            Z={dZ} · n={dN} · l={dL} · m={dM} · Re(ψ)
          </p>
        </div>
        <div className="hidden items-center gap-4 text-xs text-muted sm:flex">
          <LegendDot color={PSI_POSITIVE_COLOR} label="+ψ" />
          <LegendDot color={PSI_NEGATIVE_COLOR} label="−ψ" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
        <div
          className="relative"
          style={{ minHeight: height }}
          onMouseLeave={() => setArmed(false)}
        >
          {loading && !data && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <Spinner /> Computing orbital…
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
              layout={layout}
              config={PLOT_CONFIG}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          )}
          {data && !armed && (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-transparent"
              aria-label="Click to enable rotate and zoom"
            >
              <span className="rounded-full border border-border-strong bg-surface-2/90 px-3 py-1.5 text-xs text-muted shadow-card">
                Click to rotate · scroll to zoom
              </span>
            </button>
          )}
          {loading && data && (
            <div className="absolute right-3 top-3 text-[10px] uppercase tracking-wider text-muted">
              <Spinner /> updating
            </div>
          )}
        </div>

        <div className="space-y-6 border-t border-border p-5 lg:border-l lg:border-t-0">
          <div className="space-y-3.5">
            <SectionLabel>Quantum numbers</SectionLabel>
            <Slider
              label={<Tex>{"Z"}</Tex>}
              hint="atomic number"
              value={Z}
              onChange={(v) => setZ(Math.round(v))}
              min={1}
              max={20}
              step={1}
            />
            <div className="space-y-2.5 pt-1">
              <Stepper
                label={<Tex>{"n"}</Tex>}
                hint="principal"
                value={n}
                onChange={changeN}
                min={1}
                max={10}
              />
              <Stepper
                label={<Tex>{"l"}</Tex>}
                hint="angular momentum"
                value={l}
                onChange={changeL}
                min={0}
                max={Math.max(0, n - 1)}
                disabled={n <= 1}
              />
              <Stepper
                label={<Tex>{"m"}</Tex>}
                hint="magnetic"
                value={m}
                onChange={setM}
                min={-l}
                max={l}
                disabled={l === 0}
              />
            </div>
          </div>

          <div className="space-y-3.5 border-t border-border pt-5">
            <SectionLabel>Rendering</SectionLabel>
            <Slider
              label="Iso level"
              hint="% of peak |ψ|"
              value={isoFraction}
              onChange={setIsoFraction}
              min={0.02}
              max={0.6}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Slider
              label="Resolution"
              hint="grid pts / axis"
              value={resolution}
              onChange={(v) => setResolution(Math.round(v))}
              min={32}
              max={160}
              step={4}
              format={(v) => `${v}³`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <div className="flex items-center gap-4 sm:hidden">
          <LegendDot color={PSI_POSITIVE_COLOR} label="+ψ" />
          <LegendDot color={PSI_NEGATIVE_COLOR} label="−ψ" />
        </div>
        {data && (
          <span className="ml-auto font-mono tabular-nums">
            {data.x.length}×{data.y.length}×{data.z.length} pts
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
      {children}
    </p>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

// Compact +/- control for small coupled integer ranges (n, l, m). A
// continuous-look range slider is the wrong affordance for a handful of
// discrete, tightly coupled values — this also fires one discrete change per
// click instead of a flood of onChange events during a drag.
function Stepper({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: ReactNode;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-baseline gap-1.5 text-foreground">
        {label}
        {hint && (
          <span className="text-[10px] font-normal text-muted">{hint}</span>
        )}
      </span>
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2/60 p-0.5">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          aria-label={`Decrease ${hint ?? "value"}`}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Minus className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <span className="w-5 text-center font-mono text-xs tabular-nums text-foreground">
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${hint ?? "value"}`}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function sceneAxis(boundRadius: number) {
  return {
    visible: false,
    range: [-boundRadius, boundRadius],
    autorange: false,
  };
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-foreground"
    />
  );
}

// Every param change kills whatever request is still in flight and starts a
// fresh one — never lets a stale response land. Letting the in-flight
// request finish and render before moving on to the latest one is exactly
// backwards: a user landing on n=4 wants that state, not a flash of n=2 and
// n=3 on the way there.
function useSingleAtomState(request: SingleAtomStateRequest) {
  const [data, setData] = useState<SingleAtomStateResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const requestKey = JSON.stringify(request);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    const body = JSON.parse(requestKey) as SingleAtomStateRequest;

    singleAtomStateQmSingleAtomStatePost(body, { signal: controller.signal })
      .then((res: singleAtomStateQmSingleAtomStatePostResponse) => {
        if (controller.signal.aborted) return;
        if (res.status === 200) {
          setData(res.data as SingleAtomStateResponse);
        } else {
          setError(
            new Error(
              `API returned ${res.status}: ${JSON.stringify(res.data)}`,
            ),
          );
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
  }, [requestKey]);

  return { data, error, loading };
}

// The API returns axis-aligned coordinates (x, y, z each length n·) plus a
// dense (nx, ny, nz) array of the signed wavefunction ψ; Plotly's isosurface
// trace wants flat, per-point x/y/z/value arrays instead, in matching order.
function flattenField(data: SingleAtomStateResponse) {
  const { x, y, z, psi } = data;
  const nx = x.length;
  const ny = y.length;
  const nz = z.length;
  const total = nx * ny * nz;

  const xs = new Float64Array(total);
  const ys = new Float64Array(total);
  const zs = new Float64Array(total);
  const vs = new Float64Array(total);

  let maxAbs = 0;
  let idx = 0;
  for (let i = 0; i < nx; i++) {
    const xi = x[i];
    const plane = psi[i];
    for (let j = 0; j < ny; j++) {
      const yj = y[j];
      const row = plane[j];
      for (let k = 0; k < nz; k++) {
        const v = row[k];
        xs[idx] = xi;
        ys[idx] = yj;
        zs[idx] = z[k];
        vs[idx] = v;
        const a = Math.abs(v);
        if (a > maxAbs) maxAbs = a;
        idx++;
      }
    }
  }

  return { xs, ys, zs, vs, maxAbs };
}

// One solid, opaque shell per sign of ψ — not a stack of translucent shells
// (a wide isomin..isomax band with a partial `fill` produced a perforated,
// layered look; two near-duplicate isovalues with count:2 produced a
// speckled, seamed one). A single exact isovalue with count:1 is the
// standard, well-behaved Plotly invocation. Also returns a tight bounding
// radius around the points that actually cross the threshold, so the scene
// can be framed on the visible shape instead of the much larger
// computational grid.
function buildOrbitalTraces(
  data: SingleAtomStateResponse,
  isoFraction: number,
): { traces: Record<string, unknown>[]; boundRadius: number } {
  const { xs, ys, zs, vs, maxAbs } = flattenField(data);
  const safeMaxAbs = maxAbs > 0 ? maxAbs : 1;
  const threshold = isoFraction * safeMaxAbs;

  let boundRadius = 0;
  const total = vs.length;
  for (let idx = 0; idx < total; idx++) {
    if (Math.abs(vs[idx]) < threshold) continue;
    const r = Math.max(Math.abs(xs[idx]), Math.abs(ys[idx]), Math.abs(zs[idx]));
    if (r > boundRadius) boundRadius = r;
  }
  boundRadius = boundRadius > 0 ? boundRadius * 1.25 : 8;

  const shell = (sign: 1 | -1, color: string): Record<string, unknown> => ({
    type: "isosurface",
    x: xs,
    y: ys,
    z: zs,
    value: vs,
    isomin: sign > 0 ? threshold : -threshold,
    isomax: sign > 0 ? threshold : -threshold,
    surface: { count: 1, fill: 1 },
    caps: { x: { show: false }, y: { show: false }, z: { show: false } },
    colorscale: [
      [0, color],
      [1, color],
    ],
    opacity: 1,
    showscale: false,
    lighting: {
      ambient: 0.35,
      diffuse: 0.9,
      specular: 0.9,
      roughness: 0.35,
      fresnel: 0.2,
    },
    lightposition: { x: 2000, y: 1000, z: 1500 },
    flatshading: false,
    hovertemplate: `x=%{x:.2f}, y=%{y:.2f}, z=%{z:.2f}<br>${sign > 0 ? "+" : "−"}ψ=%{value:.3e}<extra></extra>`,
  });

  return {
    traces: [shell(1, PSI_POSITIVE_COLOR), shell(-1, PSI_NEGATIVE_COLOR)],
    boundRadius,
  };
}
