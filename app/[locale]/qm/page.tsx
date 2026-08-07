// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { QM_MODULES } from "@/lib/qm-modules";

export default async function QmIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("qm");

  return (
    <section className="animate-rise space-y-10">
      <header className="max-w-2xl space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Quantum mechanics
        </p>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          {t("index.heading")}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{t("index.intro")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QM_MODULES.map((slug, i) => (
          <ModuleCard
            key={slug}
            href={`/qm/${slug}`}
            index={i + 1}
            title={t(`modules.${slug}.title`)}
            summary={t(`modules.${slug}.summary`)}
          />
        ))}
      </div>
    </section>
  );
}
