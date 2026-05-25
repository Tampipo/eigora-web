import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Sidebar } from "@/components/ui/Sidebar";
import "katex/dist/katex.min.css";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Physense",
  description: "Interactive physics, written clearly.",
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
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body suppressHydrationWarning className="font-sans">
        <NextIntlClientProvider>
          <Sidebar />
          <main className="lg:pl-64">
            <div className="mx-auto max-w-5xl px-6 py-12 lg:px-12 lg:py-16">
              {children}
            </div>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
