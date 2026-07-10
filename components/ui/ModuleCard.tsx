// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** A linked course-module card with an index, title and one-line summary. */
export function ModuleCard({
  href,
  index,
  title,
  summary,
}: {
  href: string;
  index: number;
  title: string;
  summary: string;
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
      <span
        aria-hidden
        className="mt-auto h-px w-full origin-left scale-x-0 bg-gradient-to-r from-accent/70 to-transparent transition-transform duration-300 ease-out-expo group-hover:scale-x-100"
      />
    </Link>
  );
}
