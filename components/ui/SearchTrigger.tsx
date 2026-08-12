"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { OPEN_SEARCH_EVENT } from "./search-events";

/**
 * Opens the global palette. Deliberately just an event dispatcher: the sidebar
 * and the mobile header both render a trigger, but only one SearchPalette is
 * mounted (in the layout), so there is one dialog and one shortcut listener
 * rather than two competing ones.
 */
export function SearchTrigger({
  label,
  variant = "sidebar",
}: {
  label: string;
  variant?: "sidebar" | "compact";
}) {
  const open = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));

  // The palette accepts both modifiers; only the printed hint has to pick one.
  // Default to Ctrl and correct to ⌘ after mount — reading `navigator` during
  // render would make the server and client markup disagree.
  // Whole label, not just the modifier: Mac writes ⌘K, everywhere else Ctrl+K.
  const [shortcut, setShortcut] = useState("Ctrl+K");
  useEffect(() => {
    if (/mac/i.test(navigator.userAgent)) setShortcut("⌘K");
  }, []);

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={label}
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="group flex w-full items-center gap-2 rounded-lg border border-border bg-surface/50 px-2.5 py-2 text-left text-sm text-faint transition-colors hover:border-border-strong hover:text-muted"
    >
      <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      <kbd className="hidden shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
        {shortcut}
      </kbd>
    </button>
  );
}
