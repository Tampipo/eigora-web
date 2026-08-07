// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
    "./mdx-components.tsx",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "Cambria", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        prose: "72ch",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.28), 0 8px 24px -12px rgb(0 0 0 / 0.55)",
        lift: "0 2px 4px rgb(0 0 0 / 0.3), 0 18px 40px -16px rgb(0 0 0 / 0.6)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.35), 0 12px 40px -12px rgb(var(--accent) / 0.35)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      typography: ({ theme }: { theme: (path: string) => string }) => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": "rgb(var(--foreground))",
            "--tw-prose-headings": "rgb(var(--foreground))",
            "--tw-prose-lead": "rgb(var(--muted))",
            "--tw-prose-links": "rgb(var(--accent))",
            "--tw-prose-bold": "rgb(var(--foreground))",
            "--tw-prose-counters": "rgb(var(--muted))",
            "--tw-prose-bullets": "rgb(var(--border-strong))",
            "--tw-prose-hr": "rgb(var(--border))",
            "--tw-prose-quotes": "rgb(var(--muted))",
            "--tw-prose-quote-borders": "rgb(var(--accent) / 0.5)",
            "--tw-prose-captions": "rgb(var(--muted))",
            "--tw-prose-code": "rgb(var(--foreground))",
            "--tw-prose-pre-code": "rgb(var(--foreground))",
            "--tw-prose-pre-bg": "rgb(var(--surface))",
            "--tw-prose-th-borders": "rgb(var(--border))",
            "--tw-prose-td-borders": "rgb(var(--border))",
            maxWidth: "72ch",
            fontFamily: theme("fontFamily.sans").toString(),
            fontSize: "1.05rem",
            lineHeight: "1.8",
            h1: {
              fontFamily: theme("fontFamily.serif").toString(),
              fontWeight: "560",
              letterSpacing: "-0.02em",
              fontSize: "2.4rem",
              lineHeight: "1.1",
            },
            h2: {
              fontFamily: theme("fontFamily.serif").toString(),
              fontWeight: "560",
              letterSpacing: "-0.015em",
              marginTop: "2.6em",
              marginBottom: "0.75em",
              fontSize: "1.6rem",
              lineHeight: "1.25",
            },
            h3: {
              fontFamily: theme("fontFamily.serif").toString(),
              fontWeight: "560",
              letterSpacing: "-0.01em",
              marginTop: "2em",
              marginBottom: "0.5em",
              fontSize: "1.25rem",
            },
            "h2 + *, h3 + *": { marginTop: "0.5em" },
            p: { marginTop: "1.1em", marginBottom: "1.1em" },
            a: {
              textDecoration: "none",
              borderBottom: "1px solid rgb(var(--accent) / 0.4)",
              transition: "border-color 120ms ease, color 120ms ease",
              fontWeight: "inherit",
            },
            "a:hover": { borderBottomColor: "rgb(var(--accent))" },
            code: {
              fontFamily: theme("fontFamily.mono").toString(),
              fontSize: "0.86em",
              background: "rgb(var(--surface-2))",
              padding: "0.15em 0.4em",
              borderRadius: "0.3rem",
              border: "1px solid rgb(var(--border))",
              fontWeight: "400",
            },
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            pre: {
              border: "1px solid rgb(var(--border))",
              background: "rgb(var(--surface))",
              borderRadius: "0.6rem",
            },
            hr: {
              borderColor: "rgb(var(--border))",
              marginTop: "3em",
              marginBottom: "3em",
            },
            blockquote: {
              fontStyle: "normal",
              borderLeftWidth: "2px",
              fontWeight: "400",
              paddingLeft: "1.1em",
            },
            strong: { fontWeight: "600" },
          },
        },
      }),
    },
  },
  plugins: [typography],
};

export default config;
