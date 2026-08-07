// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/cn";

/**
 * Eigora brand mark — a Gaussian wavepacket riding a baseline, echoing the
 * |ψ(x)|² curves the platform renders. Uses the accent gradient; scales with
 * `size`. Purely decorative (aria-hidden); pair with a text wordmark.
 */
export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="ps-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--accent-2))" />
        </linearGradient>
      </defs>
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="8.5"
        fill="rgb(var(--surface-2))"
        stroke="url(#ps-mark)"
        strokeOpacity="0.6"
        strokeWidth="1.25"
      />
      {/* baseline */}
      <path d="M5 20.5H27" stroke="rgb(var(--muted))" strokeOpacity="0.35" strokeWidth="1.25" strokeLinecap="round" />
      {/* wavepacket */}
      <path
        d="M5 20.5 C 9 20.5, 10.5 8, 16 8 C 21.5 8, 23 20.5, 27 20.5"
        stroke="url(#ps-mark)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
