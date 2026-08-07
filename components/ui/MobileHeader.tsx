// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";

/** Sticky top bar for viewports below `lg`, where the sidebar is hidden. */
export async function MobileHeader() {
  const t = await getTranslations("nav");
  const site = await getTranslations("site");

  return (
    <header className="glass sticky top-0 z-30 lg:hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={24} />
          <span className="font-serif text-lg tracking-tight text-foreground">
            {site("title")}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/qm"
            className="rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {t("qm")}
          </Link>
          <span className="mx-1 h-4 w-px bg-border" />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
