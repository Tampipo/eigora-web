"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function SidebarNavItem({
  href,
  label,
  indent,
  exact,
}: {
  href: string;
  label: string;
  indent?: boolean;
  /** Match only this exact path (e.g. a section "Overview"), not descendants. */
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/" || exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href as never}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative block rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors duration-150",
        indent && "ml-3",
        active
          ? "bg-surface-2 font-medium text-foreground"
          : "text-muted hover:bg-surface-2/60 hover:text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
        />
      )}
      {label}
    </Link>
  );
}
