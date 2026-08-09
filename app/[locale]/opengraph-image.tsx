// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ImageResponse } from "next/og";

/**
 * The card shown when a link is pasted into WhatsApp, Discord, Slack or X.
 *
 * Rendered once at build time and served for every route, so a shared link
 * always carries the brand rather than falling back to a bare URL. The
 * per-page title and description still vary — those come from `generateMetadata`
 * and appear as the card's heading and subtitle beside this image.
 *
 * Note `next/og` supports only a subset of CSS (flexbox, no grid) and no
 * external fonts unless fetched explicitly, so this deliberately sticks to the
 * system stack and inline SVG.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Eigora — Interactive physics, written clearly";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#080a0f",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 132, fontWeight: 700, color: "#7ca0ff", letterSpacing: -4 }}>
            Ei
          </span>
          <span style={{ fontSize: 132, fontWeight: 700, color: "#e8ebf2", letterSpacing: -4 }}>
            g
          </span>
          <svg width="150" height="150" viewBox="0 0 150 150" fill="none">
            <ellipse cx="75" cy="75" rx="66" ry="27" fill="none" stroke="#aa8dff" strokeWidth="6" transform="rotate(32 75 75)" />
            <ellipse cx="75" cy="75" rx="66" ry="27" fill="none" stroke="#7ca0ff" strokeWidth="6" transform="rotate(-32 75 75)" />
            <circle cx="129" cy="46" r="6" fill="#7ca0ff" />
            <g transform="translate(75,73)">
              <path d="M-15 -5 L0 -15 L15 -5" fill="none" stroke="#e8ebf2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="-9.5" y1="-1" x2="-9.5" y2="11" stroke="#7ca0ff" strokeWidth="5" strokeLinecap="round" />
              <line x1="0" y1="-1" x2="0" y2="11" stroke="#5876c6" strokeWidth="5" strokeLinecap="round" />
              <line x1="9.5" y1="-1" x2="9.5" y2="11" stroke="#aa8dff" strokeWidth="5" strokeLinecap="round" />
              <line x1="-13" y1="15" x2="13" y2="15" stroke="#e8ebf2" strokeWidth="4" strokeLinecap="round" />
            </g>
          </svg>
          <span style={{ fontSize: 132, fontWeight: 700, color: "#e8ebf2", letterSpacing: -4 }}>
            ra
          </span>
        </div>

        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#8f98a9" }}>
          Interactive physics, written clearly
        </div>
      </div>
    ),
    size,
  );
}
