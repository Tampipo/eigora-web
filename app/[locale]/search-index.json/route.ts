// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { buildSearchIndex } from "@/lib/search-index";

/**
 * The full-text index, one static JSON per locale.
 *
 * `force-static` bakes it at build time, so reading the MDX files never costs
 * anything at request time. The palette fetches this lazily on first open,
 * which keeps the index out of every page's JS bundle.
 *
 * The path ends in `.json`, and middleware.ts excludes anything containing a
 * dot — so this route sidesteps the i18n rewrite instead of fighting it.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const entries = await buildSearchIndex(locale);
  return NextResponse.json(entries);
}
