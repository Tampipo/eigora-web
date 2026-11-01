"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Play, RotateCcw, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CodeEditor } from "@/components/ui/CodeEditor";
import { Slider } from "@/components/ui/Slider";
import {
  MAX_CODE_CHARS,
  TIME_LIMIT_SECONDS,
  runPython,
  type CellResult,
} from "@/lib/python-runner";

const AUTO_RUN_DELAY_MS = 300;

export type CellParam = {
  /** The variable, assigned on a line of its own in the code: `omega = 1.0`. */
  name: string;
  min: number;
  max: number;
  step: number;
};

function decimals(step: number) {
  return step >= 1 ? 0 : (String(step).split(".")[1]?.length ?? 2);
}

function initialValue(code: string, name: string) {
  const match = new RegExp(`^${name} = (.+)$`, "m").exec(code);
  const value = match ? Number(match[1]) : NaN;
  if (Number.isNaN(value)) {
    throw new Error(`CodeCell: no line "${name} = <number>" in the code`);
  }
  return value;
}

function withValues(code: string, params: CellParam[], values: number[]) {
  return params.reduce(
    (source, param, i) =>
      source.replace(
        new RegExp(`^${param.name} = .+$`, "m"),
        `${param.name} = ${values[i].toFixed(decimals(param.step))}`,
      ),
    code,
  );
}

/**
 * Python the reader can run on the page. It takes one of two forms:
 *
 * - With `params`, the code is read-only and sliders set the named variables, so
 *   values stay within the bounds given. It runs again as a slider moves.
 * - Without `params`, the reader can edit anything. Their code can't be trusted
 *   to stay small, so the limits are enforced around it: see lib/python-runner.ts
 *   and public/runner/eigora_runtime.py.
 *
 * Python downloads on the first press of Run, not when the page opens.
 */
export function CodeCell({
  code,
  params = [],
}: {
  code: string;
  params?: CellParam[];
}) {
  const t = useTranslations("tutorials.cell");
  const defaults = useMemo(
    () => params.map((param) => initialValue(code, param.name)),
    [code, params],
  );
  const [values, setValues] = useState(defaults);
  const [edited, setEdited] = useState(code);
  const [phase, setPhase] = useState<"idle" | "loading" | "running">("idle");
  const [result, setResult] = useState<CellResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasParams = params.length > 0;
  const source = hasParams ? withValues(code, params, values) : edited;

  const latestSource = useRef(source);
  latestSource.current = source;
  const active = useRef<{ cancel: () => void } | null>(null);
  const rerun = useRef(false);
  const hasRun = useRef(false);

  const run = useCallback(async () => {
    if (active.current) {
      rerun.current = true;
      return;
    }
    const text = latestSource.current;
    if (text.length > MAX_CODE_CHARS) {
      setNotice(t("tooLong", { limit: MAX_CODE_CHARS }));
      return;
    }
    hasRun.current = true;
    setNotice(null);
    setPhase("loading");
    const job = runPython(text, () => setPhase("running"));
    active.current = job;
    const outcome = await job.promise;
    active.current = null;
    setPhase("idle");
    if (outcome.status !== "cancelled") {
      setResult(outcome);
    }
    if (rerun.current) {
      rerun.current = false;
      void run();
    }
  }, [t]);

  // Sliders run again on their own, but only once the reader has chosen to run
  // the cell: moving one should not start a large download.
  useEffect(() => {
    if (!hasParams || !hasRun.current) return;
    const timer = setTimeout(() => void run(), AUTO_RUN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [source, hasParams, run]);

  useEffect(() => () => active.current?.cancel(), []);

  function stop() {
    rerun.current = false;
    active.current?.cancel();
  }

  function reset() {
    stop();
    setEdited(code);
    setValues(defaults);
    setResult(null);
    setNotice(null);
    hasRun.current = false;
  }

  const busy = phase !== "idle";
  const failure =
    result?.status === "timeout"
      ? t("timeout", { seconds: TIME_LIMIT_SECONDS })
      : result?.status === "crashed"
        ? t("crashed")
        : result?.status === "failed"
          ? t("failed")
          : null;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-surface/60">
      <CodeEditor
        value={source}
        readOnly={hasParams}
        label={t("editorLabel")}
        onChange={setEdited}
        onRun={() => void run()}
      />

      {hasParams && (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
          {params.map((param, i) => (
            <Slider
              key={param.name}
              label={<span className="font-mono text-xs">{param.name}</span>}
              value={values[i]}
              min={param.min}
              max={param.max}
              step={param.step}
              format={(v) => v.toFixed(decimals(param.step))}
              onChange={(v) =>
                setValues((old) => old.map((o, j) => (j === i ? v : o)))
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border p-2">
        <button
          type="button"
          onClick={busy ? stop : () => void run()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-accent/90"
        >
          {busy ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {busy ? t("stop") : t("run")}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("reset")}
        </button>
        <span role="status" className="min-w-0 flex-1 text-xs text-faint sm:text-right">
          {phase === "loading"
            ? t("loading")
            : phase === "running"
              ? t("running")
              : !result
                ? t("hint")
                : hasParams
                  ? t("sliders")
                  : t("edit")}
        </span>
      </div>

      {(notice || failure || result) && (
        <div className="space-y-3 border-t border-border p-3">
          {(notice || failure) && (
            <p className="m-0 text-sm text-accent">{notice ?? failure}</p>
          )}
          {result?.stdout && (
            <pre className="m-0 max-h-72 overflow-auto whitespace-pre font-mono text-xs leading-relaxed text-foreground">
              {result.stdout}
            </pre>
          )}
          {result?.truncated && (
            <p className="m-0 text-xs text-faint">{t("truncated")}</p>
          )}
          {result?.error && (
            <pre className="m-0 max-h-72 overflow-auto whitespace-pre font-mono text-xs leading-relaxed text-accent">
              {result.error}
            </pre>
          )}
          {result?.figures.map((figure, i) => (
            // A generated data URI, which next/image has nothing to optimise in.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={`data:image/png;base64,${figure}`}
              alt={t("figureAlt", { number: i + 1 })}
              className="mx-auto block h-auto max-w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
