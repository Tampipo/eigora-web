// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { QM_MODULES } from "@/lib/qm-modules";
import { Wordmark } from "./Wordmark";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SidebarNavItem } from "./SidebarNavItem";

export async function Sidebar() {
  const t = await getTranslations("nav");
  const site = await getTranslations("site");
  const qm = await getTranslations("qm.modules");

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/40 px-5 py-6 backdrop-blur-sm lg:flex">
      <Link href="/" className="group flex flex-col gap-1.5">
        <Wordmark size={30} />
        <span className="text-[11px] text-muted">{site("tagline")}</span>
      </Link>

      <nav className="mt-10 flex-1 space-y-7 text-sm">
        <div className="space-y-0.5">
          <SidebarNavItem href="/" label={t("home")} />
        </div>

        <div className="space-y-1">
          <p className="px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
            {t("qm")}
          </p>
          <div className="space-y-0.5">
            <SidebarNavItem href="/qm" label="Overview" exact />
            {QM_MODULES.map((slug) => (
              <SidebarNavItem
                key={slug}
                href={`/qm/${slug}`}
                label={qm(`${slug}.title`)}
                indent
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
          Locale
        </span>
        <LocaleSwitcher />
      </div>
    </aside>
  );
}
