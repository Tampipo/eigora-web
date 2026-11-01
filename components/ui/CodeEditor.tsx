"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";

/**
 * A CodeMirror editor, loaded only in the browser. Until it arrives, and for
 * readers without JavaScript, the code is still there as plain text.
 *
 * Tab indents, as a Python editor must. CodeMirror's standard escape applies for
 * keyboard users: Esc, then Tab, moves focus out of the editor.
 */
export function CodeEditor({
  value,
  readOnly,
  label,
  onChange,
  onRun,
}: {
  value: string;
  readOnly: boolean;
  label: string;
  onChange: (value: string) => void;
  onRun: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLPreElement>(null);
  const view = useRef<EditorView | null>(null);
  // The editor outlives renders, so its callbacks read the latest props here.
  const latest = useRef({ onChange, onRun, value });
  latest.current = { onChange, onRun, value };

  useEffect(() => {
    let disposed = false;
    const plainText = fallback.current;

    (async () => {
      const [
        { EditorState },
        { EditorView, keymap, lineNumbers },
        { defaultKeymap, history, historyKeymap, indentWithTab },
        { python },
        { HighlightStyle, indentUnit, syntaxHighlighting },
        { tags },
      ] = await Promise.all([
        import("@codemirror/state"),
        import("@codemirror/view"),
        import("@codemirror/commands"),
        import("@codemirror/lang-python"),
        import("@codemirror/language"),
        import("@lezer/highlight"),
      ]);
      if (disposed || !host.current) return;

      const highlight = HighlightStyle.define([
        { tag: tags.keyword, color: "rgb(244 112 103)" },
        { tag: [tags.string, tags.special(tags.string)], color: "rgb(150 208 255)" },
        { tag: tags.comment, color: "rgb(var(--faint))", fontStyle: "italic" },
        { tag: [tags.number, tags.bool, tags.null], color: "rgb(108 182 255)" },
        {
          tag: [
            tags.function(tags.variableName),
            tags.function(tags.propertyName),
            tags.definition(tags.className),
          ],
          color: "rgb(220 189 251)",
        },
      ]);

      view.current = new EditorView({
        parent: host.current,
        state: EditorState.create({
          doc: latest.current.value,
          extensions: [
            lineNumbers(),
            history(),
            python(),
            indentUnit.of("    "),
            syntaxHighlighting(highlight),
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
            EditorView.contentAttributes.of({ "aria-label": label }),
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  latest.current.onRun();
                  return true;
                },
              },
              ...defaultKeymap,
              ...historyKeymap,
              indentWithTab,
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                latest.current.onChange(update.state.doc.toString());
              }
            }),
            EditorView.theme(
              {
                "&": { backgroundColor: "transparent", fontSize: "13px" },
                "&.cm-focused": { outline: "none" },
                ".cm-scroller": {
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  lineHeight: "1.6",
                  overflow: "auto",
                },
                ".cm-content": {
                  caretColor: "rgb(var(--foreground))",
                  padding: "12px 0",
                },
                ".cm-cursor": { borderLeftColor: "rgb(var(--foreground))" },
                ".cm-gutters": {
                  backgroundColor: "transparent",
                  border: "none",
                  color: "rgb(var(--faint))",
                },
                "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
                  { backgroundColor: "rgb(124 160 255 / 0.25)" },
              },
              { dark: true },
            ),
          ],
        }),
      });
      if (plainText) plainText.hidden = true;
    })();

    return () => {
      disposed = true;
      view.current?.destroy();
      view.current = null;
      if (plainText) plainText.hidden = false;
    };
    // `value` is read through `latest` and synced by the effect below.
  }, [readOnly, label]);

  // Sliders and Reset change the code from outside the editor.
  useEffect(() => {
    const current = view.current;
    if (!current || current.state.doc.toString() === value) return;
    current.dispatch({
      changes: { from: 0, to: current.state.doc.length, insert: value },
    });
  }, [value]);

  return (
    <div className="text-foreground">
      <pre
        ref={fallback}
        className="m-0 overflow-x-auto bg-transparent p-3 font-mono text-[13px] leading-[1.6]"
      >
        {value}
      </pre>
      <div ref={host} />
    </div>
  );
}
