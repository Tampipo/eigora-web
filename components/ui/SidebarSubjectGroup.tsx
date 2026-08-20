// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SidebarNavItem } from "./SidebarNavItem";

/** Module links shown per subject before the rest fold behind "Show more". */
export const SIDEBAR_MODULE_LIMIT = 5;

/**
 * One subject block in the sidebar: a heading, its first
 * SIDEBAR_MODULE_LIMIT module links, and — once a subject has more modules
 * than that — a "Show more" row linking straight to the subject's own index
 * page instead of listing every module here. Keeps the sidebar's height
 * bounded as subjects (quantum mechanics today, statistical physics etc.
 * later) and their module counts grow — add a subject by rendering another
 * of these in Sidebar.tsx, same as the qm one.
 */
export function SidebarSubjectGroup({
  heading,
  href,
  modules,
  showMoreLabel,
}: {
  heading: string;
  /** Subject index page, e.g. "/qm" — also where "Show more" points. */
  href: string;
  modules: { slug: string; label: string }[];
  showMoreLabel: string;
}) {
  const visible = modules.slice(0, SIDEBAR_MODULE_LIMIT);
  const hidden = modules.length - visible.length;

  return (
    <div className="space-y-1">
      <p className="px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
        {heading}
      </p>
      <div className="space-y-0.5">
        {visible.map((m) => (
          <SidebarNavItem
            key={m.slug}
            href={`${href}/${m.slug}`}
            label={m.label}
            indent
          />
        ))}
        {hidden > 0 && (
          <SidebarNavItem href={href} label={showMoreLabel} indent />
        )}
      </div>
    </div>
  );
}
