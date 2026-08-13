// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ImageResponse } from "next/og";

/**
 * The favicon, generated at build time as a raster PNG.
 *
 * Replaces the previous hand-written `icon.svg`. Browsers were happy with the
 * SVG, but Google runs a separate favicon crawler that expects a square raster
 * image sized to a multiple of 48px — sites offering only SVG commonly end up
 * with the generic globe in search results, which is what happened here.
 *
 * 192px rather than 48px so it stays sharp on high-density displays; both
 * browsers and Google downscale from it.
 */
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#10131b",
          borderRadius: 42,
        }}
      >
        <svg width="192" height="192" viewBox="0 0 150 150" fill="none">
          <ellipse cx="75" cy="75" rx="58" ry="24" fill="none" stroke="#aa8dff" strokeWidth="7" transform="rotate(32 75 75)" />
          <ellipse cx="75" cy="75" rx="58" ry="24" fill="none" stroke="#7ca0ff" strokeWidth="7" transform="rotate(-32 75 75)" />
          <g transform="translate(75,73)">
            <path d="M-14 -5 L0 -14 L14 -5" fill="none" stroke="#e8ebf2" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="-9" y1="-1" x2="-9" y2="11" stroke="#7ca0ff" strokeWidth="7" strokeLinecap="round" />
            <line x1="0" y1="-1" x2="0" y2="11" stroke="#5876c6" strokeWidth="7" strokeLinecap="round" />
            <line x1="9" y1="-1" x2="9" y2="11" stroke="#aa8dff" strokeWidth="7" strokeLinecap="round" />
            <line x1="-12" y1="15" x2="12" y2="15" stroke="#e8ebf2" strokeWidth="5.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
