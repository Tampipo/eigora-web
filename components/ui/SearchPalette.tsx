"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Search, CornerDownLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { excerpt, normalize, queryTerms } from "@/lib/search";
import type { SearchEntry } from "@/lib/search-index";
import { OPEN_SEARCH_EVENT } from "./search-events";

type Hit = {
  domain: string;
  slug: string;
  title: string;
  heading: string;
  snippet: string;
};

const MAX_HITS = 8;

/**
 * Global full-text search over the MDX content, opened with ⌘K / Ctrl+K or by
 * any SearchTrigger. Mounted once in the layout.
 *
 * The index is fetched lazily on first open rather than shipped with the page:
 * it grows with the content, and most visits never search.
 */
export function SearchPalette({
  labels,
}: {
  labels: {
    placeholder: string;
    empty: string;
    hint: string;
    loading: string;
  };
}) {
  const locale = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [active, setActive] = useState(0);

  // Fetch once per locale, on first open.
  useEffect(() => {
    if (!open || entries !== null) return;
    let cancelled = false;
    fetch(`/${locale}/search-index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchEntry[]) => !cancelled && setEntries(data))
      .catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [open, entries, locale]);

  // Drop the cached index when the locale changes, so results follow language.
  useEffect(() => setEntries(null), [locale]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const terms = queryTerms(query);

  // One hit per module: the first matching section wins, so a common word does
  // not fill the list with six sections of the same page.
  const hits: Hit[] = [];
  if (terms.length > 0 && entries) {
    const seen = new Set<string>();
    for (const e of entries) {
      const key = `${e.domain}/${e.slug}`;
      if (seen.has(key)) continue;
      const haystack = normalize(`${e.title} ${e.heading} ${e.text}`);
      if (!terms.every((t) => haystack.includes(t))) continue;
      seen.add(key);
      hits.push({
        domain: e.domain,
        slug: e.slug,
        title: e.title,
        heading: e.heading,
        snippet: excerpt(e.text, terms),
      });
      if (hits.length >= MAX_HITS) break;
    }
  }

  const go = useCallback(
    (hit: Hit) => {
      close();
      router.push(`/${hit.domain}/${hit.slug}` as never);
    },
    [close, router],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.placeholder}
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
    >
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
      />

      <div className="card relative z-10 w-full max-w-lg overflow-hidden p-0 shadow-lift">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search
            className="h-4 w-4 shrink-0 text-faint"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                go(hits[active]);
              }
            }}
            className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder:text-faint focus:outline-none"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {terms.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-faint">
              {labels.hint}
            </p>
          ) : entries === null ? (
            <p className="px-4 py-6 text-center text-xs text-faint">
              {labels.loading}
            </p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {labels.empty}
            </p>
          ) : (
            <ul className="py-1.5">
              {hits.map((hit, i) => (
                <li key={`${hit.domain}/${hit.slug}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                    className={
                      "flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors " +
                      (i === active ? "bg-surface-2/70" : "")
                    }
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {hit.title}
                      </span>
                      {hit.heading !== hit.title && (
                        <span className="truncate text-xs text-faint">
                          {hit.heading}
                        </span>
                      )}
                      {i === active && (
                        <CornerDownLeft
                          className="ml-auto h-3 w-3 shrink-0 text-faint"
                          strokeWidth={2}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-muted">
                      {hit.snippet}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
