// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { QM_MODULES } from "@/lib/qm-modules";
import { LEGAL_PAGES } from "@/lib/legal-pages";
import { SITE_URL } from "@/lib/metadata";

/**
 * Every public URL, one entry per locale, each pointing at its translations.
 *
 * The `alternates.languages` block is what stops search engines reading the
 * English and French versions of a page as duplicates competing with each
 * other — they are told explicitly that the two are the same page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/qm",
    ...QM_MODULES.map((slug) => `/qm/${slug}`),
    ...LEGAL_PAGES.map((slug) => `/legal/${slug}`),
  ];
  const lastModified = new Date();

  // The legal pages have to be indexable — a mentions légales page nobody can
  // reach serves no purpose — but they are not what the site is for, so they
  // are ranked below the course material rather than competing with it.
  const isLegal = (path: string) => path.startsWith("/legal/");

  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency: isLegal(path) ? ("yearly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : isLegal(path) ? 0.3 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((other) => [other, `${SITE_URL}/${other}${path}`]),
        ),
      },
    })),
  );
}
