// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function Well2DPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    const { default: Content } = await import(
      `@/content/${locale}/qm/well-2d.mdx`
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
  return routing.locales.map((locale) => ({ locale }));
}
