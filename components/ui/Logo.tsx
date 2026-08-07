// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/cn";

/**
 * The Eigora mark on its own — two crossed orbits around a temple, one electron
 * on the outer path. The same glyph stands in for the o in `Wordmark`; use this
 * where there is no room for the full word.
 *
 * Colours come from the theme tokens. Decorative by default (aria-hidden);
 * pass a label through `title` when it carries meaning on its own.
 */
export function Logo({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 150 150"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="eigora-mark-a" x1="9" y1="75" x2="141" y2="75" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--accent-2))" />
          <stop offset="1" stopColor="rgb(var(--accent))" />
        </linearGradient>
        <linearGradient id="eigora-mark-b" x1="9" y1="75" x2="141" y2="75" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--accent-soft))" />
        </linearGradient>
      </defs>

      <ellipse cx="75" cy="75" rx="66" ry="27" fill="none" stroke="url(#eigora-mark-a)" strokeWidth="4" transform="rotate(32 75 75)" />
      <ellipse cx="75" cy="75" rx="66" ry="27" fill="none" stroke="url(#eigora-mark-b)" strokeWidth="4" transform="rotate(-32 75 75)" />
      <circle cx="129" cy="46" r="5" fill="rgb(var(--accent))" />

      {/* Temple, nudged 2u up so it reads optically centred inside the orbits */}
      <g transform="translate(75,73)">
        <path d="M-15 -5 L0 -15 L15 -5" fill="none" stroke="rgb(var(--foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="-9.5" y1="-1" x2="-9.5" y2="11" stroke="rgb(var(--accent))" strokeWidth="4" strokeLinecap="round" />
        <line x1="0" y1="-1" x2="0" y2="11" stroke="rgb(var(--accent-soft))" strokeWidth="4" strokeLinecap="round" />
        <line x1="9.5" y1="-1" x2="9.5" y2="11" stroke="rgb(var(--accent-2))" strokeWidth="4" strokeLinecap="round" />
        <line x1="-13" y1="15" x2="13" y2="15" stroke="rgb(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
