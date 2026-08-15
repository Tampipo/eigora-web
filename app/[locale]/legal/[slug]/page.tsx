// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";
import { LEGAL_PAGES } from "@/lib/legal-pages";

type Params = Promise<{ locale: string; slug: string }>;

export default async function LegalPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  try {
    const { default: Content } = await import(
      `@/content/${locale}/legal/${slug}.mdx`
    );
    return (
      <article className="prose">
        <Content />
      </article>
    );
  } catch {
    notFound();
  }
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    LEGAL_PAGES.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "legal.pages" });

  return pageMetadata(
    locale,
    `/legal/${slug}`,
    t(`${slug}.title`),
    t(`${slug}.summary`),
  );
}
