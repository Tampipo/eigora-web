"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { Tex } from "@/components/ui/Tex";
import { useSpinMeasurement } from "@/lib/use-spin-measurement";

// The figure is the x–z great circle of the Bloch sphere, drawn face on: +z up,
// +x right, and theta swept from +z so that the arrow sits where the algebra
// says the spin points. Angles are held as whole degrees — the readouts stay
// clean, and one request per degree of drag is already plenty.
const VIEW = 320;
const CENTER = VIEW / 2;
const RADIUS = 118;
const ARC_RADIUS = 46;

// Echoes the videos above: blue arrow for the spin, amber needle for the axis
// being measured. Neither is a theme token — the pairing is the page's own
// visual language, like the red markers in DegeneracyLattice.
const SPIN_COLOR = "rgb(124 160 255)";
const APPARATUS_COLOR = "rgb(234 179 8)";

export interface SpinMeasurementProps {
  /** Initial angle between the spin and the measured axis, in degrees. */
  theta?: number;
  /** Shots per pack. */
  shots?: number;
  caption?: ReactNode;
}

export function SpinMeasurement({
  theta: initialTheta = 60,
  shots = 100,
  caption,
}: SpinMeasurementProps) {
  const [theta, setTheta] = useState(clampDeg(initialTheta));
  const svgRef = useRef<SVGSVGElement>(null);
  const arrowId = useId();

  const { probabilities, tally, draw, drawing, reset, error } =
    useSpinMeasurement(theta, shots);

  const total = tally.plus + tally.minus;

  const pointTo = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    // The viewBox is square and centred, so under the default
    // preserveAspectRatio the circle's centre always lands on the element's
    // centre — no need to unproject through the SVG's own coordinate system.
    const rect = svg.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    if (dx === 0 && dy === 0) return;
    // atan2(dx, -dy) puts 0° at the top and grows clockwise, matching theta
    // swept from +z towards +x.
    setTheta(clampDeg(Math.round((Math.atan2(dx, -dy) * 180) / Math.PI)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointTo(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    pointTo(e.clientX, e.clientY);
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : e.key === "PageUp"
            ? 15
            : e.key === "PageDown"
              ? -15
              : 0;
    if (step === 0 && e.key !== "Home") return;
    e.preventDefault();
    setTheta(e.key === "Home" ? 0 : (prev) => clampDeg(prev + step));
  };

  const rad = (theta * Math.PI) / 180;
  const tipX = CENTER + RADIUS * Math.sin(rad);
  const tipY = CENTER - RADIUS * Math.cos(rad);

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
        <div className="flex items-center justify-center p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="w-full max-w-[360px] cursor-grab touch-none select-none active:cursor-grabbing"
            role="slider"
            tabIndex={0}
            aria-label="Direction of the spin, in degrees from the measured axis"
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={theta}
            aria-valuetext={`${theta} degrees`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onKeyDown}
          >
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={SPIN_COLOR} />
              </marker>
            </defs>

            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="rgb(var(--border-strong))"
              strokeWidth={1}
            />

            {/* The apparatus: fixed along z, the axis every reading refers to. */}
            <line
              x1={CENTER}
              y1={CENTER - RADIUS - 14}
              x2={CENTER}
              y2={CENTER + RADIUS + 14}
              stroke={APPARATUS_COLOR}
              strokeWidth={1.2}
              strokeDasharray="5 4"
              opacity={0.75}
            />
            <line
              x1={CENTER - RADIUS - 14}
              y1={CENTER}
              x2={CENTER + RADIUS + 14}
              y2={CENTER}
              stroke="rgb(var(--border-strong))"
              strokeWidth={1}
            />

            <PoleLabel x={CENTER} y={CENTER - RADIUS - 22}>
              <Tex>{`|u\\rangle`}</Tex>&nbsp;&nbsp;+1
            </PoleLabel>
            <PoleLabel x={CENTER} y={CENTER + RADIUS + 30}>
              <Tex>{`|d\\rangle`}</Tex>&nbsp;&nbsp;−1
            </PoleLabel>
            <AxisLabel x={CENTER + RADIUS + 20} y={CENTER + 4} text="+x" />
            <AxisLabel x={CENTER - RADIUS - 20} y={CENTER + 4} text="−x" />

            {/* theta, swept from the apparatus axis to the spin. */}
            {theta > 0 && (
              <path
                d={arcPath(theta)}
                fill="none"
                stroke="rgb(var(--muted))"
                strokeWidth={1}
              />
            )}
            <foreignObject
              x={CENTER + (ARC_RADIUS + 14) * Math.sin(rad / 2) - 10}
              y={CENTER - (ARC_RADIUS + 14) * Math.cos(rad / 2) - 8}
              width={20}
              height={16}
            >
              <div className="flex h-full items-center justify-center text-[11px] text-muted">
                <Tex>{`\\theta`}</Tex>
              </div>
            </foreignObject>

            <line
              x1={CENTER}
              y1={CENTER}
              x2={tipX}
              y2={tipY}
              stroke={SPIN_COLOR}
              strokeWidth={2.5}
              markerEnd={`url(#${arrowId})`}
            />
            <circle cx={CENTER} cy={CENTER} r={3} fill={SPIN_COLOR} />
            {/* Grab handle — visibly draggable, and a wide hit area on touch. */}
            <circle cx={tipX} cy={tipY} r={9} fill={SPIN_COLOR} opacity={0.18} />
          </svg>
        </div>

        <div className="space-y-4 border-t border-border p-4 lg:border-l lg:border-t-0">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted">Drag the arrow</span>
            <span className="flex items-baseline gap-1 font-mono text-lg tabular-nums text-foreground">
              <Tex>{`\\theta`}</Tex> = {theta}°
            </span>
          </div>

          <div className="space-y-2.5">
            <OutcomeRow
              label={<Tex>{`P(+1) = \\cos^2\\tfrac{\\theta}{2}`}</Tex>}
              theory={probabilities?.plus}
              count={tally.plus}
              total={total}
            />
            <OutcomeRow
              label={<Tex>{`P(-1) = \\sin^2\\tfrac{\\theta}{2}`}</Tex>}
              theory={probabilities?.minus}
              count={tally.minus}
              total={total}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={draw}
              disabled={drawing || !probabilities}
              className="flex-1 rounded border border-border-strong bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-3 disabled:opacity-40"
            >
              {drawing ? "Measuring…" : `Draw ${shots} shots`}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={total === 0}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-30"
            >
              Reset
            </button>
          </div>

          {error ? (
            <p className="text-xs text-red-400">{error.message}</p>
          ) : (
            <Statistics theta={theta} tally={tally} total={total} />
          )}
        </div>
      </div>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * One outcome: its exact probability, and the fraction actually drawn.
 *
 * The bar is the empirical fraction, the tick is the theory — so a fresh angle
 * shows only a tick, and every pack drawn walks the bar towards it.
 */
function OutcomeRow({
  label,
  theory,
  count,
  total,
}: {
  label: React.ReactNode;
  theory: number | undefined;
  count: number;
  total: number;
}) {
  const fraction = total > 0 ? count / total : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-foreground">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {theory === undefined ? "—" : theory.toFixed(3)}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-sm bg-surface-2">
        <div
          className="h-full bg-accent/70 transition-[width] duration-200 ease-out"
          style={{ width: `${fraction * 100}%` }}
        />
        {theory !== undefined && (
          <div
            className="absolute inset-y-0 w-px bg-foreground"
            style={{ left: `${theory * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between font-mono text-[10px] tabular-nums text-faint">
        <span>{count} shots</span>
        <span>{total > 0 ? fraction.toFixed(3) : "—"}</span>
      </div>
    </div>
  );
}

/**
 * The running average against cos θ.
 *
 * The point the page closes on: no single reading is ever anything but ±1, and
 * the number the theory predicts only shows up in the average of many.
 */
function Statistics({
  theta,
  tally,
  total,
}: {
  theta: number;
  tally: { plus: number; minus: number };
  total: number;
}) {
  if (total === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-muted">
        Each shot prepares the spin afresh and reads it along the amber axis,
        returning nothing but +1 or −1.
      </p>
    );
  }
  const mean = (tally.plus - tally.minus) / total;
  const expected = Math.cos((theta * Math.PI) / 180);

  return (
    <dl className="space-y-1 font-mono text-[11px] tabular-nums text-muted">
      <Stat label="shots" value={String(total)} />
      <Stat
        label={
          <>
            <Tex>{`\\langle\\sigma_z\\rangle`}</Tex> measured
          </>
        }
        value={mean.toFixed(3)}
      />
      <Stat label={<Tex>{`\\cos\\theta`}</Tex>} value={expected.toFixed(3)} />
    </dl>
  );
}

function Stat({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-faint">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function PoleLabel({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  const w = 70;
  const h = 18;
  return (
    <foreignObject x={x - w / 2} y={y - h / 2} width={w} height={h}>
      <div className="flex h-full items-center justify-center whitespace-nowrap font-mono text-[11px] text-muted">
        {children}
      </div>
    </foreignObject>
  );
}

function AxisLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="fill-faint font-mono text-[10px]"
    >
      {text}
    </text>
  );
}

/** The theta arc, from +z clockwise to the arrow. */
function arcPath(thetaDeg: number): string {
  const rad = (thetaDeg * Math.PI) / 180;
  const x = CENTER + ARC_RADIUS * Math.sin(rad);
  const y = CENTER - ARC_RADIUS * Math.cos(rad);
  const largeArc = thetaDeg > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER - ARC_RADIUS} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArc} 1 ${x} ${y}`;
}

/** Wrap into [0, 360), so dragging past a pole keeps going instead of sticking. */
function clampDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}
