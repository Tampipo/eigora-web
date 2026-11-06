// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

// NH3 in its two configurations, side by side: the nitrogen to the left of the
// plane of the hydrogens, then to the right. Nothing here is solved for. It is
// a drawing, computed once from a fixed geometry, so it renders on the server
// and needs neither the API nor a canvas.
//
// The molecule's axis is x, as in the double well below it, and the hydrogens
// sit in the plane x = 0. |R> is |L> with x -> -x and nothing else, so both are
// built from one geometry and drawn from one camera: the two pictures are
// mirror images by construction, not by hand.

// Geometry, in angstroms. The hydrogens' circumradius is the real one; the
// nitrogen's height above their plane is not. In NH3 it is about 0.38 A, which
// puts the nitrogen half inside its own hydrogens once drawn as spheres, and the
// one thing this figure has to show is which side it is on. So it is pulled out
// to 0.8 A, enough that no hydrogen hides behind it from this camera.
const H_RADIUS = 0.94;
const N_HEIGHT = 0.8;
const PLANE_RADIUS = 1.35;
const AXIS_EXTENT = 2.1;

const N_SIZE = 0.3;
const H_SIZE = 0.2;

// The camera: turned about the vertical so the plane of the hydrogens opens up
// into an ellipse rather than being seen edge-on, and raised a little so the
// two lower hydrogens separate into one in front and one behind.
const YAW = (16 * Math.PI) / 180;
const PITCH = (10 * Math.PI) / 180;

const W = 640;
const H = 228;
const CELL = W / 2;
const CY = 122;
const SCALE = 62;

// Same palette as AmmoniaInversion and DoubleWellStates, so |L> and |R> keep
// their colours across the page.
const LEFT_RGB: Rgb = [255, 160, 120];
const RIGHT_RGB: Rgb = [124, 160, 255];
const H_RGB: Rgb = [232, 235, 242];
const BACKGROUND_RGB: Rgb = [16, 19, 27];
const BOND_COLOR = "rgb(99 108 126)";
const AXIS_COLOR = "rgb(52 60 77)";
const PLANE_COLOR = "rgb(143 152 169)";
const FAINT_COLOR = "rgb(99 108 126)";
const INK_COLOR = "rgb(8 10 15)";

const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const SERIF = "var(--font-serif), Georgia, serif";

type Rgb = [number, number, number];
type Side = "L" | "R";

export interface AmmoniaConfigurationsProps {
  caption?: ReactNode;
}

export function AmmoniaConfigurations({ caption }: AmmoniaConfigurationsProps) {
  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="The ammonia molecule in its two configurations: the nitrogen to the left of the plane of the three hydrogens, and to the right"
      >
        <defs>
          <AtomGradient id="nh3-n-L" rgb={LEFT_RGB} />
          <AtomGradient id="nh3-n-R" rgb={RIGHT_RGB} />
          <AtomGradient id="nh3-h" rgb={H_RGB} />
          <marker
            id="nh3-axis-head"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill={AXIS_COLOR} />
          </marker>
        </defs>

        <Molecule side="L" cx={CELL / 2} />
        <line
          x1={CELL}
          y1={10}
          x2={CELL}
          y2={H - 10}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />
        <Molecule side="R" cx={CELL * 1.5} />
      </svg>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── Geometry ────────────────────────────────────────────────────────────────

interface Projected {
  x: number;
  y: number;
  /** Towards the viewer is positive. */
  depth: number;
}

function project(x: number, y: number, z: number): Projected {
  const sx = x * Math.cos(YAW) + z * Math.sin(YAW);
  const d = -x * Math.sin(YAW) + z * Math.cos(YAW);
  return {
    x: sx,
    y: y * Math.cos(PITCH) - d * Math.sin(PITCH),
    depth: y * Math.sin(PITCH) + d * Math.cos(PITCH),
  };
}

// One hydrogen straight down, the other two a third of a turn either side.
// With one straight up instead, the nitrogen and the two lower hydrogens line
// up from this camera and the one behind disappears behind its own bond.
const HYDROGENS = [0, 1, 2].map((k) => {
  const a = Math.PI + (k * 2 * Math.PI) / 3;
  return project(0, H_RADIUS * Math.cos(a), H_RADIUS * Math.sin(a));
});

const PLANE_OUTLINE = Array.from({ length: 73 }, (_, k) => {
  const a = (k * 2 * Math.PI) / 72;
  return project(0, PLANE_RADIUS * Math.cos(a), PLANE_RADIUS * Math.sin(a));
});

// The plane x = 0 faces the camera on its x < 0 side, the yaw having turned
// that side towards us. Whatever lies there is drawn over the plane, whatever
// lies beyond it is drawn first and seen through it.
const facesCamera = (x: number) => x < 0;

// ── Drawing ─────────────────────────────────────────────────────────────────

function Molecule({ side, cx }: { side: Side; cx: number }) {
  const sign = side === "L" ? -1 : 1;
  const nitrogen = project(sign * N_HEIGHT, 0, 0);
  const ghost = project(-sign * N_HEIGHT, 0, 0);
  const color = side === "L" ? LEFT_RGB : RIGHT_RGB;

  const at = (p: Projected) => ({ x: cx + p.x * SCALE, y: CY - p.y * SCALE });

  // Painter's order within the molecule: whatever is furthest from the viewer
  // first. Each bond is cut at its midpoint and each half drawn just before the
  // atom it belongs to, so an atom always covers the end of its own bonds and a
  // bond never runs across the face of the atom it ends in.
  const BEHIND = 1e-6;
  const items: { depth: number; node: ReactNode }[] = [];
  HYDROGENS.forEach((h, k) => {
    const a = at(nitrogen);
    const b = at(h);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    items.push({
      depth: nitrogen.depth - BEHIND,
      node: (
        <line
          key={`bond-n-${k}`}
          x1={a.x}
          y1={a.y}
          x2={mid.x}
          y2={mid.y}
          stroke={rgb(mix(color, BACKGROUND_RGB, 0.35))}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ),
    });
    items.push({
      depth: h.depth - BEHIND,
      node: (
        <line
          key={`bond-h-${k}`}
          x1={mid.x}
          y1={mid.y}
          x2={b.x}
          y2={b.y}
          stroke={BOND_COLOR}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ),
    });
    items.push({
      depth: h.depth,
      node: (
        <Atom
          key={`h-${k}`}
          at={b}
          r={H_SIZE * SCALE}
          fill="url(#nh3-h)"
          label="H"
          labelSize={10}
          shade={depthShade(h.depth)}
        />
      ),
    });
  });
  items.push({
    depth: nitrogen.depth,
    node: (
      <Atom
        key="n"
        at={at(nitrogen)}
        r={N_SIZE * SCALE}
        fill={`url(#nh3-n-${side})`}
        label="N"
        labelSize={13}
        shade={0}
      />
    ),
  });
  items.sort((p, q) => p.depth - q.depth);
  const molecule = <g>{items.map((item) => item.node)}</g>;

  // Where the tunneling would take it: the same nitrogen, mirrored through the
  // plane. Outlined only, since the molecule is not there.
  const g = at(ghost);
  const ghostNode = (
    <circle
      cx={g.x}
      cy={g.y}
      r={N_SIZE * SCALE}
      fill="none"
      stroke={rgb(mix(color, BACKGROUND_RGB, 0.45))}
      strokeWidth={1.2}
      strokeDasharray="3 3"
    />
  );

  const outline =
    PLANE_OUTLINE.map((p, k) => {
      const q = at(p);
      return `${k === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    }).join(" ") + " Z";
  const triangle =
    HYDROGENS.map((p, k) => {
      const q = at(p);
      return `${k === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    }).join(" ") + " Z";
  const plane = (
    <g>
      <path
        d={outline}
        fill={PLANE_COLOR}
        fillOpacity={0.09}
        stroke={PLANE_COLOR}
        strokeOpacity={0.45}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <path
        d={triangle}
        fill="none"
        stroke={PLANE_COLOR}
        strokeOpacity={0.35}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
    </g>
  );

  const axisFrom = at(project(-AXIS_EXTENT, 0, 0));
  const axisTo = at(project(AXIS_EXTENT, 0, 0));
  const planeFoot = at(project(0, -PLANE_RADIUS, 0));

  const nFront = facesCamera(sign * N_HEIGHT);

  return (
    <g>
      <line
        x1={axisFrom.x}
        y1={axisFrom.y}
        x2={axisTo.x}
        y2={axisTo.y}
        stroke={AXIS_COLOR}
        strokeWidth={1.2}
        markerEnd="url(#nh3-axis-head)"
      />
      <text
        x={axisTo.x + 4}
        y={axisTo.y - 8}
        fill={FAINT_COLOR}
        fontSize={15}
        fontStyle="italic"
        style={{ fontFamily: SERIF }}
      >
        x
      </text>

      {nFront ? ghostNode : molecule}
      {plane}
      {nFront ? molecule : ghostNode}

      <text
        x={planeFoot.x}
        y={planeFoot.y + 16}
        fill={FAINT_COLOR}
        fontSize={10}
        textAnchor="middle"
        style={{ fontFamily: MONO }}
      >
        x = 0
      </text>
      <text
        x={cx}
        y={24}
        fill={rgb(color)}
        fontSize={14}
        fontWeight={600}
        textAnchor="middle"
        style={{ fontFamily: MONO }}
      >
        {`|${side}⟩`}
      </text>
    </g>
  );
}

function Atom({
  at,
  r,
  fill,
  label,
  labelSize,
  shade,
}: {
  at: { x: number; y: number };
  r: number;
  fill: string;
  label: string;
  labelSize: number;
  shade: number;
}) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={r} fill={fill} />
      {/* Atoms further back are dimmed towards the surface, the only depth cue
          an orthographic drawing has besides overlap. */}
      {shade > 0 && (
        <circle cx={at.x} cy={at.y} r={r} fill={rgb(BACKGROUND_RGB)} fillOpacity={shade} />
      )}
      <text
        x={at.x}
        y={at.y}
        dy="0.36em"
        fill={INK_COLOR}
        fillOpacity={0.8}
        fontSize={labelSize}
        fontWeight={600}
        textAnchor="middle"
        style={{ fontFamily: MONO }}
      >
        {label}
      </text>
    </g>
  );
}

/** A sphere lit from the upper left: a highlight, the colour, a darker rim. */
function AtomGradient({ id, rgb: base }: { id: string; rgb: Rgb }) {
  return (
    <radialGradient id={id} cx="0.38" cy="0.34" r="0.7">
      <stop offset="0" stopColor={rgb(mix(base, [255, 255, 255], 0.6))} />
      <stop offset="0.45" stopColor={rgb(base)} />
      <stop offset="1" stopColor={rgb(mix(base, BACKGROUND_RGB, 0.55))} />
    </radialGradient>
  );
}

function depthShade(depth: number) {
  return Math.min(0.4, Math.max(0, (-depth / H_RADIUS) * 0.4));
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
}

function rgb([r, g, b]: Rgb) {
  return `rgb(${r} ${g} ${b})`;
}
