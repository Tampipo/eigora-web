// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // The dot-exclusion covers robots.txt and sitemap.xml, but Next's generated
  // metadata routes have no extension — without naming them here they get
  // locale-prefixed to a path that does not exist, and the favicon and social
  // card silently 404.
  matcher: [
    "/((?!api|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|manifest|.*\\..*).*)",
  ],
};
