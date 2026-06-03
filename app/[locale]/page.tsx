// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <section className="space-y-8">
      <header className="space-y-4">
        <h1 className="font-serif text-5xl tracking-tight">{t("heading")}</h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted">
          {t("intro")}
        </p>
      </header>

      <div className="pt-2">
        <Link
          href="/qm"
          className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {t("exploreQm")}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
