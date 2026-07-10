// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Newsreader } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Sidebar } from "@/components/ui/Sidebar";
import { MobileHeader } from "@/components/ui/MobileHeader";
import "katex/dist/katex.min.css";
import "@/app/globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Physense — Interactive physics, written clearly",
    template: "%s · Physense",
  },
  description:
    "A pedagogical physics platform blending written courses with live, interactive simulations of the Schrödinger equation.",
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

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable}`}
    >
      <body suppressHydrationWarning className="font-sans">
        <div className="page-glow" aria-hidden />
        <NextIntlClientProvider>
          <Sidebar />
          <MobileHeader />
          <main className="relative z-10 lg:pl-64">
            <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:px-14 lg:py-20">
              {children}
            </div>
            <footer className="mx-auto max-w-5xl px-6 pb-12 sm:px-8 lg:px-14">
              <div className="flex flex-col gap-2 border-t border-border pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
                <span>© {new Date().getFullYear()} Physense · AGPL-3.0</span>
                <span className="font-mono">Interactive physics, written clearly.</span>
              </div>
            </footer>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
