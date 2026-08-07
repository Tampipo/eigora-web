// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

/**
 * The full Eigora wordmark — "Eig○ra", with the mark standing in for the o.
 *
 * Laid out as real text with the mark inline rather than as SVG `<text>`, so
 * the browser kerns it in the site font instead of relying on hardcoded glyph
 * positions that only hold for one typeface.
 *
 * Carries its own `group`, so the hover animation works wherever it is placed:
 * the letters slide inward and dissolve into the mark, and re-emerge on leave.
 * See `.eigora-letter` / `.eigora-mark` in globals.css. Honours
 * `prefers-reduced-motion`.
 */
export function Wordmark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Eigora"
      style={{ fontSize: size }}
      className={cn(
        "group inline-flex select-none items-center font-sans font-bold leading-none tracking-tight",
        className,
      )}
    >
      <span className="eigora-letter eigora-letter--left text-accent">Ei</span>
      <span className="eigora-letter eigora-letter--left text-foreground">g</span>
      <Logo size={size * 1.12} className="eigora-mark -mx-[0.06em]" />
      <span className="eigora-letter eigora-letter--right text-foreground">ra</span>
    </span>
  );
}
