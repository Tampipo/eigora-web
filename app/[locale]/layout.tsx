// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Newsreader } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/metadata";
import { LEGAL_PAGES } from "@/lib/legal-pages";
import { Sidebar } from "@/components/ui/Sidebar";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { SearchPalette } from "@/components/ui/SearchPalette";
import "katex/dist/katex.min.css";
import "@/app/globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  // Required so relative OG image and canonical URLs resolve to absolute ones;
  // scrapers fetch from their own servers and cannot resolve a bare path.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Eigora — Interactive physics, written clearly",
    template: "%s · Eigora",
  },
  description:
    "A pedagogical platform blending written courses with live, interactive simulations. Learn and understand physics at your own pace, with clarity and interactivity.",
  openGraph: {
    type: "website",
    siteName: "Eigora",
    title: "Eigora — Interactive physics, written clearly",
    description:
      "A pedagogical platform blending written courses with live, interactive simulations. Learn and understand physics at your own pace, with clarity and interactivity.",
  },
  twitter: { card: "summary_large_image" },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations("search");
  const legal = await getTranslations("legal");

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable}`}
    >
      <body suppressHydrationWarning className="font-sans">
        {/* Google infers a site name from the domain unless told otherwise, which
            for tampipo.fr means results read "- Tampipo". This is the signal it
            documents as taking precedence. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Eigora",
              alternateName: "Eigora — Interactive physics, written clearly",
              url: SITE_URL,
            }),
          }}
        />
        <div className="page-glow" aria-hidden />
        <NextIntlClientProvider>
          <Sidebar />
          <MobileHeader />
          {/* Mounted once: the sidebar and mobile triggers both dispatch to it,
              so there is a single dialog and a single ⌘K listener. */}
          <SearchPalette
            labels={{
              placeholder: t("placeholder"),
              hint: t("hint"),
              loading: t("loading"),
              empty: t("empty"),
            }}
          />
          <main className="relative z-10 lg:pl-64">
            <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-14 lg:py-20">
              {children}
            </div>
            <footer className="mx-auto max-w-5xl px-6 pb-12 sm:px-8 lg:px-14">
              <div className="flex flex-col gap-3 border-t border-border pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
                <span>© {new Date().getFullYear()} Eigora · AGPL-3.0</span>
                <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {LEGAL_PAGES.map((slug) => (
                    <Link
                      key={slug}
                      href={`/legal/${slug}`}
                      className="transition-colors hover:text-muted"
                    >
                      {legal(`pages.${slug}.footer`)}
                    </Link>
                  ))}
                  {/* AGPL §13: anyone interacting with the running instance over
                      a network must be offered its source, so the offer has to
                      live in the service itself — not only in the repository. */}
                  <a
                    href="https://github.com/Tampipo/eigora-web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-muted"
                  >
                    {legal("footer.source")}
                  </a>
                </nav>
              </div>
            </footer>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
