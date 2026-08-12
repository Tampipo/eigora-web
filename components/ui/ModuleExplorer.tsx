"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { excerpt, normalize, queryTerms } from "@/lib/search";
import type { SearchEntry } from "@/lib/search-index";
import { ModuleCard } from "./ModuleCard";

export type ExplorerModule = {
  slug: string;
  /** Position in the suggested reading order — fixed, so it survives filtering. */
  index: number;
  title: string;
  summary: string;
  tags: string[];
};

/**
 * The suggested reading list, with a search box and a tag filter over it.
 *
 * Search runs on the same full-text index as the global ⌘K palette
 * (/{locale}/search-index.json), narrowed to this page's domain — so a word
 * that only appears in the prose, like "Bloch", finds its module here too
 * rather than only in the palette. The index is fetched on the first
 * keystroke; until it lands, matching falls back to title, summary and tags.
 *
 * The two controls narrow together (a query AND the selected tags), but
 * several tags widen each other (union, not intersection): with a handful of
 * modules an intersection empties the grid on the second tag, which reads as
 * breakage rather than as a filter. Card numbers are positions in the reading
 * order, so a filtered grid shows gaps (01, 04, 05) instead of renumbering —
 * the order is the point of the list.
 */
export function ModuleExplorer({
  domain,
  modules,
  tags,
  labels,
}: {
  domain: string;
  modules: ExplorerModule[];
  tags: string[];
  labels: {
    search: string;
    filter: string;
    clear: string;
    shown: string;
    empty: string;
    matchIn: string;
  };
}) {
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [body, setBody] = useState<Map<string, string> | null>(null);

  const toggle = (tag: string) =>
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const terms = queryTerms(query);
  const wantsIndex = terms.length > 0;

  // Fetch on first use, not on mount: most visitors never type here.
  useEffect(() => {
    if (!wantsIndex || body !== null) return;
    let cancelled = false;
    fetch(`/${locale}/search-index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchEntry[]) => {
        if (cancelled) return;
        const byslug = new Map<string, string>();
        for (const e of data) {
          if (e.domain !== domain) continue;
          byslug.set(e.slug, `${byslug.get(e.slug) ?? ""} ${e.text}`.trim());
        }
        setBody(byslug);
      })
      .catch(() => !cancelled && setBody(new Map()));
    return () => {
      cancelled = true;
    };
  }, [wantsIndex, body, locale, domain]);

  useEffect(() => setBody(null), [locale]);

  // Everything the card already shows — a hit here needs no explaining.
  const visibleText = useMemo(
    () =>
      new Map(
        modules.map((m) => [
          m.slug,
          normalize([m.title, m.summary, ...m.tags].join(" ")),
        ]),
      ),
    [modules],
  );

  const active = terms.length > 0 || selected.length > 0;

  const results = modules
    .filter(
      (m) => selected.length === 0 || m.tags.some((t) => selected.includes(t)),
    )
    .map((m) => {
      if (terms.length === 0) return { module: m, hit: null as string | null };

      const shown = visibleText.get(m.slug) ?? "";
      if (terms.every((t) => shown.includes(t))) {
        return { module: m, hit: null };
      }

      // Not on the card — look in the prose, and quote what matched.
      const prose = body?.get(m.slug);
      if (prose && terms.every((t) => normalize(prose).includes(t))) {
        return { module: m, hit: excerpt(prose, terms) };
      }
      return null;
    })
    .filter((r): r is { module: ExplorerModule; hit: string | null } => r !== null);

  const reset = () => {
    setQuery("");
    setSelected([]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            className="w-full rounded-lg border border-border bg-surface/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            {labels.filter}
          </span>
          <span
            aria-label={labels.shown}
            aria-live="polite"
            className="font-mono text-[11px] tabular-nums text-faint"
          >
            {results.length}/{modules.length}
          </span>
          {active && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent"
            >
              <X className="h-3 w-3" strokeWidth={2} aria-hidden />
              {labels.clear}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const on = selected.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(tag)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition duration-200 " +
                  (on
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border bg-surface/50 text-muted hover:border-border-strong hover:text-foreground")
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ module: m, hit }) => (
            <ModuleCard
              key={m.slug}
              href={`/${domain}/${m.slug}`}
              index={m.index}
              title={m.title}
              summary={m.summary}
              tags={m.tags}
              excerpt={hit ?? undefined}
              excerptLabel={hit ? labels.matchIn : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
