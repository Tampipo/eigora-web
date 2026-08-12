// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * A linked course-module card with an index, title and one-line summary.
 * `tags` render as inert chips — the card is a link, so selecting a tag
 * belongs to the filter bar, not in here.
 */
export function ModuleCard({
  href,
  index,
  title,
  summary,
  tags,
  excerpt,
  excerptLabel,
}: {
  href: string;
  index: number;
  title: string;
  summary: string;
  tags?: readonly string[];
  /** Why this card matched, when the hit was in the body rather than on screen. */
  excerpt?: string;
  excerptLabel?: string;
}) {
  return (
    <Link
      href={href as never}
      className="card group relative flex flex-col gap-3 p-5 transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2/60 hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tabular-nums text-faint">
          {String(index).padStart(2, "0")}
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-faint transition-all duration-300 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
          strokeWidth={1.75}
        />
      </div>
      <div className="space-y-1.5">
        <h3 className="font-serif text-xl font-medium tracking-tight text-foreground transition-colors group-hover:text-accent">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted">{summary}</p>
      </div>
      {excerpt && (
        <div className="border-l-2 border-accent/40 pl-3">
          {excerptLabel && (
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
              {excerptLabel}
            </p>
          )}
          <p className="line-clamp-3 text-xs leading-relaxed text-muted">
            {excerpt}
          </p>
        </div>
      )}
      {tags && tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-border bg-surface-2/50 px-2 py-0.5 text-[11px] text-faint transition-colors group-hover:border-border-strong"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      <span
        aria-hidden
        className="mt-auto h-px w-full origin-left scale-x-0 bg-gradient-to-r from-accent/70 to-transparent transition-transform duration-300 ease-out-expo group-hover:scale-x-100"
      />
    </Link>
  );
}
