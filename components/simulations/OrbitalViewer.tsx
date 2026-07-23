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
import { decodeOrbitalMesh } from "@/lib/orbital-mesh";
import { Tex } from "@/components/ui/Tex";

// three.js touches `window` at import, so the WebGL scene is client-only.
const OrbitalScene = dynamic(
  () => import("./OrbitalScene").then((m) => m.OrbitalScene),
  { ssr: false },
);

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

// Grid points per axis the server samples ψ on. Fixed (no user control): the
// server blurs proportionally and returns a small mesh, so this trades only
// server compute for smoothness, not payload — not something worth exposing.
const GRID_RESOLUTION = 96;

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
  n: initialN = 2,
  l: initialL = 1,
  m: initialM = 0,
  height = 460,
  caption,
}: OrbitalViewerProps) {
  // Z (atomic number) only rescales the orbital's size, which the auto-framing
  // immediately cancels out — so it had no visible effect and the slider was
  // dropped. Fixed at hydrogen.
  const Z = 1;
  const [n, setN] = useState(initialN);
  const [l, setL] = useState(initialL);
  const [m, setM] = useState(initialM);
  // The 3D scene grabs the mouse wheel for camera zoom the instant the
  // cursor crosses it, which hijacks page scrolling for anyone just reading
  // past the figure. Require a click to arm it first — same pattern as an
  // embedded Google Map — so scroll passes through until you deliberately
  // engage with the plot.
  const [armed, setArmed] = useState(false);
  // The hint pill fades on its own a few seconds after the scene first
  // renders, so it doesn't sit permanently over the orbital — clicking
  // anywhere in the scene still arms it whether or not the pill is showing.
  const [hintVisible, setHintVisible] = useState(true);

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

  // Each quantum-number change drives a fresh API round-trip (the server
  // extracts the isosurface and returns a small mesh). The controls stay driven
  // by the raw, instant state below so they never lag; only the debounced value
  // triggers the request after a short pause.
  const dN = useDebouncedValue(n, 200);
  const dL = useDebouncedValue(l, 200);
  const dM = useDebouncedValue(m, 200);

  // Box half-width, sized to contain the 80%-probability shell. Measured, that
  // radius grows like ~2n²/Z Bohr (r80 ≈ 2.05·n² for l=0, the most diffuse);
  // 2.5·n² leaves ~15% air so edge blur doesn't distort the outer shell. A
  // floor keeps the compact low-n states framed. Deliberately *no* upper cap —
  // the old min(45) clipped every state n≥5.
  const extent = useMemo(() => Math.max(9, (2.5 * dN * dN) / Z), [dN]);

  const request = useMemo<SingleAtomStateRequest>(
    () => ({
      grid: {
        x_min: -extent,
        x_max: extent,
        y_min: -extent,
        y_max: extent,
        z_min: -extent,
        z_max: extent,
        nx: GRID_RESOLUTION,
        ny: GRID_RESOLUTION,
        nz: GRID_RESOLUTION,
      },
      Z,
      n: dN,
      l: dL,
      m: dM,
    }),
    [extent, dN, dL, dM],
  );

  const { data, error, loading } = useSingleAtomState(request);

  const mesh = useMemo(
    () => (data ? decodeOrbitalMesh(data) : null),
    [data],
  );

  const triangleCount =
    (data?.positive?.triangle_count ?? 0) +
    (data?.negative?.triangle_count ?? 0);

  // Fade the hint pill 4s after the scene first has something to show.
  useEffect(() => {
    if (!data || armed) return;
    const id = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(id);
  }, [data, armed]);

  const label = `${dN}${ORBITAL_LETTERS[dL] ?? "?"}`;

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="font-serif text-xl font-medium tracking-tight text-foreground">
            {label} orbital
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            n={dN} · l={dL} · m={dM} · Re(ψ)
          </p>
        </div>
        <div className="hidden items-center gap-4 text-xs text-muted sm:flex">
          <LegendDot color={PSI_POSITIVE_COLOR} label={<Tex>{"+\\psi"}</Tex>} />
          <LegendDot color={PSI_NEGATIVE_COLOR} label={<Tex>{"-\\psi"}</Tex>} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
        <div
          className="relative"
          style={{ height }}
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
          {data && mesh && (
            <OrbitalScene
              mesh={mesh}
              positiveColor={PSI_POSITIVE_COLOR}
              negativeColor={PSI_NEGATIVE_COLOR}
              armed={armed}
            />
          )}
          {data && !armed && (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="group absolute inset-0 z-10 flex cursor-pointer items-end justify-center bg-transparent pb-4"
              aria-label="Click to enable rotate and zoom"
            >
              <span
                className={`rounded-full border border-border-strong bg-surface-2/90 px-3 py-1.5 text-xs text-muted shadow-card transition-opacity duration-700 group-hover:opacity-100 ${
                  hintVisible ? "opacity-100" : "opacity-0"
                }`}
              >
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
            <div className="space-y-2.5">
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
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border bg-surface/40 px-4 py-2 text-xs text-muted">
        <div className="flex items-center gap-4 sm:hidden">
          <LegendDot color={PSI_POSITIVE_COLOR} label={<Tex>{"+\\psi"}</Tex>} />
          <LegendDot color={PSI_NEGATIVE_COLOR} label={<Tex>{"-\\psi"}</Tex>} />
        </div>
        {data && (
          <span className="ml-auto font-mono tabular-nums">
            {triangleCount.toLocaleString()} tris
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

function LegendDot({ color, label }: { color: string; label: ReactNode }) {
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
