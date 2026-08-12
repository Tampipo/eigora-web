// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "./Wordmark";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SearchTrigger } from "./SearchTrigger";

/** Sticky top bar for viewports below `lg`, where the sidebar is hidden. */
export async function MobileHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="glass sticky top-0 z-30 lg:hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link href="/" className="group flex items-center">
          <Wordmark size={24} />
        </Link>
        <div className="flex items-center gap-1">
          <SearchTrigger label={t("search")} variant="compact" />
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
