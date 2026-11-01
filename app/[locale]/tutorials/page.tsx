// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModuleExplorer } from "@/components/ui/ModuleExplorer";
import { TUTORIALS } from "@/lib/tutorials";

export default async function TutorialsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tutorials");

  // Tags are authored per module as one comma-separated string in
  // messages/{locale}.json, so they translate alongside title and summary.
  // Localizing here keeps the whole catalogue out of the client bundle.
  const modules = TUTORIALS.map((slug, i) => ({
    slug,
    index: i + 1,
    title: t(`modules.${slug}.title`),
    summary: t(`modules.${slug}.summary`),
    tags: t(`modules.${slug}.tags`)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  }));

  // The filter vocabulary is whatever the modules actually use — no separate
  // list to keep in sync. Alphabetical so the bar is scannable.
  const tags = [...new Set(modules.flatMap((m) => m.tags))].sort((a, b) =>
    a.localeCompare(b, locale),
  );

  return (
    <section className="animate-rise space-y-10">
      <header className="max-w-2xl space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          {t("index.eyebrow")}
        </p>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          {t("index.heading")}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{t("index.intro")}</p>
        <p className="text-sm leading-relaxed text-faint">
          {t("index.readingOrder")}
        </p>
      </header>

      <ModuleExplorer
        domain="tutorials"
        modules={modules}
        tags={tags}
        labels={{
          search: t("index.searchPlaceholder"),
          filter: t("index.filterLabel"),
          clear: t("index.clearFilters"),
          shown: t("index.shownLabel"),
          empty: t("index.noResults"),
          matchIn: t("index.matchIn"),
        }}
      />
    </section>
  );
}
