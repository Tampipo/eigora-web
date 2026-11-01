// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { moduleMetadata } from "@/lib/metadata";
import { TUTORIALS } from "@/lib/tutorials";

type Params = Promise<{ locale: string; slug: string }>;

export default async function TutorialPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  try {
    const { default: Content } = await import(
      `@/content/${locale}/tutorials/${slug}.mdx`
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
    TUTORIALS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, slug } = await params;
  return moduleMetadata(locale, slug, "tutorials");
}
