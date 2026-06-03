"use client";

// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            disabled={isPending || active}
            onClick={() =>
              startTransition(() =>
                router.replace(pathname, { locale: l }),
              )
            }
            className={
              "rounded px-2 py-1 text-xs uppercase tracking-wide transition-colors " +
              (active
                ? "text-foreground"
                : "text-muted hover:bg-surface hover:text-foreground")
            }
            aria-current={active ? "true" : undefined}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
