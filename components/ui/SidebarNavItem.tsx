"use client";

import { Link, usePathname } from "@/i18n/navigation";

export function SidebarNavItem({
  href,
  label,
  indent,
}: {
  href: string;
  label: string;
  indent?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href as never}
      className={
        "block rounded-md px-2 py-1.5 text-sm transition-colors " +
        (indent ? "ml-3 " : "") +
        (active
          ? "bg-surface text-foreground"
          : "text-muted hover:bg-surface/60 hover:text-foreground")
      }
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
