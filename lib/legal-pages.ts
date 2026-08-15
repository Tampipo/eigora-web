// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Single source of truth for the legal page slugs — drives the route's static
// params (app/[locale]/legal/[slug]/page.tsx), the footer links and the
// sitemap. Each slug must have a matching content/{locale}/legal/{slug}.mdx
// and a legal.pages.{slug}.{title,summary,footer} entry in messages/{locale}.json.
//
// "notice" is the French mentions légales (LCEN art. 6 III), which every
// publicly reachable site published from France must carry, commercial or not.
// "privacy" covers the GDPR information duty — the site keeps no accounts and
// runs no analytics, but the reverse proxy logs IP addresses, and that alone
// is a processing that has to be disclosed. "credits" names the third-party
// work the site is built on, which the MIT and OFL licences require.
export const LEGAL_PAGES = ["notice", "privacy", "credits"] as const;

export type LegalSlug = (typeof LEGAL_PAGES)[number];
