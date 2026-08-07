// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function Navbar() {
  const t = await getTranslations("nav");
  const site = await getTranslations("site");

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="font-serif text-lg tracking-tight text-foreground"
        >
          {site("title")}
        </Link>
        <ul className="flex items-center gap-1 text-sm">
          <li>
            <Link
              href="/qm"
              className="rounded px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              {t("qm")}
            </Link>
          </li>
          <li className="ml-2 border-l border-border pl-2">
            <LocaleSwitcher />
          </li>
        </ul>
      </nav>
    </header>
  );
}
