// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";

/**
 * Served at /robots.txt. Everything here is public, so the rules are open —
 * the point of the file is the sitemap pointer, which is how crawlers find
 * the URL list without being told about it out of band.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
