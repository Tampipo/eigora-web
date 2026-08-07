// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/cn";

/**
 * The full Eigora wordmark — "Eig○ra", where the mark itself stands in for the
 * letter o: two crossed orbits around a temple, the platform's two halves
 * (physics and teaching) sharing one centre.
 *
 * Place inside an element carrying Tailwind's `group` class and the letters
 * converge into the mark on hover, leaving the symbol alone; see
 * `.eigora-letter` / `.eigora-mark` in globals.css. Honours
 * `prefers-reduced-motion`.
 *
 * Colours come from the theme tokens, so the same component works on light and
 * dark without a second asset.
 */
export function Wordmark({
  height = 34,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <svg
      height={height}
      viewBox="0 0 232 96"
      fill="none"
      role="img"
      aria-label="Eigora"
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id="eigora-orbit-a" x1="-33" y1="0" x2="33" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--accent-2))" />
          <stop offset="1" stopColor="rgb(var(--accent))" />
        </linearGradient>
        <linearGradient id="eigora-orbit-b" x1="-33" y1="0" x2="33" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--accent-soft))" />
        </linearGradient>
      </defs>

      {/* Letters left of the mark */}
      <g className="eigora-letter eigora-letter--left">
        <text x="0" y="64" className="font-sans" fontSize="56" fontWeight="700" letterSpacing="-2" fill="rgb(var(--accent))">
          Ei
        </text>
        <text x="50" y="64" className="font-sans" fontSize="56" fontWeight="700" letterSpacing="-2" fill="rgb(var(--foreground))">
          g
        </text>
      </g>

      {/* The mark, standing in for the o */}
      <g transform="translate(122,46)">
        <g className="eigora-mark">
          <ellipse cx="0" cy="0" rx="33" ry="13.5" fill="none" stroke="url(#eigora-orbit-a)" strokeWidth="3" transform="rotate(32)" />
          <ellipse cx="0" cy="0" rx="33" ry="13.5" fill="none" stroke="url(#eigora-orbit-b)" strokeWidth="3" transform="rotate(-32)" />
          <circle cx="27" cy="-15" r="3.4" fill="rgb(var(--accent))" />
          <g transform="translate(0,-1) scale(0.5)">
            <path d="M-15 -5 L0 -15 L15 -5" fill="none" stroke="rgb(var(--foreground))" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="-9.5" y1="-1" x2="-9.5" y2="11" stroke="rgb(var(--accent))" strokeWidth="6" strokeLinecap="round" />
            <line x1="0" y1="-1" x2="0" y2="11" stroke="rgb(var(--accent-soft))" strokeWidth="6" strokeLinecap="round" />
            <line x1="9.5" y1="-1" x2="9.5" y2="11" stroke="rgb(var(--accent-2))" strokeWidth="6" strokeLinecap="round" />
            <line x1="-13" y1="15" x2="13" y2="15" stroke="rgb(var(--foreground))" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        </g>
      </g>

      {/* Letters right of the mark */}
      <g className="eigora-letter eigora-letter--right">
        <text x="165" y="64" className="font-sans" fontSize="56" fontWeight="700" letterSpacing="-2" fill="rgb(var(--foreground))">
          ra
        </text>
      </g>
    </svg>
  );
}
