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
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        prose: "72ch",
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
            "--tw-prose-bullets": "rgb(var(--muted))",
            "--tw-prose-hr": "rgb(var(--border))",
            "--tw-prose-quotes": "rgb(var(--foreground))",
            "--tw-prose-quote-borders": "rgb(var(--accent) / 0.6)",
            "--tw-prose-captions": "rgb(var(--muted))",
            "--tw-prose-code": "rgb(var(--foreground))",
            "--tw-prose-pre-code": "rgb(var(--foreground))",
            "--tw-prose-pre-bg": "rgb(var(--surface))",
            "--tw-prose-th-borders": "rgb(var(--border))",
            "--tw-prose-td-borders": "rgb(var(--border))",
            maxWidth: "72ch",
            fontFamily: theme("fontFamily.sans").toString(),
            fontSize: "1rem",
            lineHeight: "1.75",
            h1: {
              fontWeight: "600",
              letterSpacing: "-0.025em",
              fontSize: "2.25rem",
            },
            h2: {
              fontWeight: "600",
              letterSpacing: "-0.02em",
              marginTop: "2.5em",
              marginBottom: "0.75em",
              fontSize: "1.5rem",
            },
            h3: {
              fontWeight: "600",
              letterSpacing: "-0.015em",
              marginTop: "2em",
              marginBottom: "0.5em",
              fontSize: "1.2rem",
            },
            "h2 + *, h3 + *": { marginTop: "0.5em" },
            p: { marginTop: "1em", marginBottom: "1em" },
            a: {
              textDecoration: "none",
              borderBottom: "1px solid rgb(var(--accent) / 0.4)",
              transition: "border-color 120ms ease",
              fontWeight: "inherit",
            },
            "a:hover": { borderBottomColor: "rgb(var(--accent))" },
            code: {
              fontFamily: theme("fontFamily.mono").toString(),
              fontSize: "0.88em",
              background: "rgb(var(--surface))",
              padding: "0.15em 0.4em",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            pre: {
              border: "1px solid rgb(var(--border))",
              background: "rgb(var(--surface))",
            },
            hr: { borderColor: "rgb(var(--border))" },
            blockquote: {
              fontStyle: "normal",
              borderLeftWidth: "2px",
              fontWeight: "400",
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};

export default config;
