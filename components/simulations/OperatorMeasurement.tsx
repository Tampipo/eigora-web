"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState, type ReactNode } from "react";

import { Tex } from "@/components/ui/Tex";
import { useDebouncedValue } from "@/lib/use-debounced";
import { useMeasurement } from "@/lib/use-measurement";
import type {
  ComplexVectorSchema,
  MeasurementRequest,
  OutcomeSchema,
} from "@/lib/api/schemas";

const DIMS = [2, 3, 4] as const;

// How far off A = A† is tolerated before a cell is flagged. Loose next to the
// API's own 1e-10 (see Observable.is_hermitian in eigora.qm.discrete): this
// check exists to warn instantly, as the user types, not to be the final
// word — the API is still asked to confirm and would 422 on anything this
// misses.
const HERM_TOL = 1e-9;

export interface OperatorMeasurementProps {
  caption?: ReactNode;
}

export function OperatorMeasurement({ caption }: OperatorMeasurementProps) {
  const [dim, setDim] = useState<number>(2);
  const [opText, setOpText] = useState(() => defaultOperatorText(2));
  const [stText, setStText] = useState(() => defaultStateText(2));

  // dim and the two text grids must never disagree on size, even for a
  // single render: the parse below indexes opText up to `dim`, and a
  // dimension change whose grids only catch up a render later (as a
  // useEffect keyed on dim would do) reads out of bounds on the way there.
  // Setting both together in one handler keeps them batched into the same
  // render.
  function resetTo(newDim: number) {
    setDim(newDim);
    setOpText(defaultOperatorText(newDim));
    setStText(defaultStateText(newDim));
  }

  const pristine =
    JSON.stringify(opText) === JSON.stringify(defaultOperatorText(dim)) &&
    JSON.stringify(stText) === JSON.stringify(defaultStateText(dim));

  // Each cell is free text — "1", "-0.5", "2i", "1-3i" — parsed on every
  // change rather than held as a live number. A controlled numeric input
  // that snaps back to 0 the instant a keystroke leaves it unparseable (an
  // empty field, a bare "-") fights typing a fresh value; text has no such
  // notion of "invalid", so nothing is ever overwritten out from under you.
  // An unparsed cell — including one you're still in the middle of typing —
  // simply counts as 0 until it parses.
  const { opRe, opIm } = useMemo(() => parseMatrix(opText), [opText]);
  const { re: stRe, im: stIm } = useMemo(() => parseVector(stText), [stText]);

  const issues = useMemo(() => hermiticityIssues(opRe, opIm, dim), [opRe, opIm, dim]);
  const hasState = stRe.some((v) => v !== 0) || stIm.some((v) => v !== 0);

  const request = useMemo<MeasurementRequest | null>(() => {
    if (issues.length > 0 || !hasState) return null;
    return { operator: { re: opRe, im: opIm }, state: { re: stRe, im: stIm } };
  }, [issues, hasState, opRe, opIm, stRe, stIm]);

  // Typing fires onChange per keystroke; nothing is asked of the API until
  // the text stops moving for a moment.
  const debouncedRequest = useDebouncedValue(request, 300);
  const { data, error, loading } = useMeasurement(debouncedRequest);

  const expectation = data
    ? data.outcomes.reduce((s, o) => s + o.value * o.probability, 0)
    : null;

  const isFlagged = (i: number, j: number) =>
    issues.some((iss) => (iss.i === i && iss.j === j) || (iss.i === j && iss.j === i));

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-border bg-surface/40 shadow-card">
      <div className="space-y-4 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <DimSelector value={dim} onChange={resetTo} />
          <button
            type="button"
            onClick={() => resetTo(dim)}
            disabled={pristine}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground disabled:opacity-30"
          >
            reset
          </button>
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
              Operator Â
            </p>
            <MatrixEditor
              text={opText}
              flagged={isFlagged}
              onChange={(i, j, v) => setOpText(setCell(opText, i, j, v))}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
              State |ψ⟩
            </p>
            <VectorEditor
              dim={dim}
              text={stText}
              onChange={(i, v) => setStText(setEntry(stText, i, v))}
            />
          </div>
        </div>

        {issues.length > 0 && (
          <div className="flex items-start gap-2 rounded border border-red-400/40 bg-red-400/5 px-3 py-2 text-xs text-red-400">
            <span aria-hidden>⚠</span>
            <span>
              Not Hermitian — Â ≠ Â† at the cell(s) marked in red. The
              measurement postulate needs real eigenvalues and an orthonormal
              eigenbasis, which only a Hermitian operator guarantees, so
              nothing is sent while this holds.
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        {!data && !error && (
          <div className="flex items-center justify-center py-6 text-sm text-muted">
            {issues.length > 0 ? (
              <span>Fix the operator above to measure it.</span>
            ) : !hasState ? (
              <span>Give the state at least one non-zero coefficient.</span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Solving…
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="px-2 py-4 text-center text-sm text-red-400">
            {error.message}
          </div>
        )}

        {data && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between font-mono text-xs text-muted">
              <span className="inline-flex items-center gap-2">
                ⟨Â⟩
                {loading && <Spinner />}
              </span>
              <span className="tabular-nums text-foreground">
                {expectation!.toFixed(3)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.outcomes.map((outcome, idx) => (
                <OutcomeRow key={idx} outcome={outcome} />
              ))}
            </div>
          </div>
        )}
      </div>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

/**
 * Parse `a+bi` / `a-bi` / `bi` / `a` — whatever's typed so far.
 *
 * Returns null for anything not yet a complete number: empty, a bare sign, a
 * trailing decimal point. The caller treats that as 0 rather than as an
 * error, since it's usually just a value mid-keystroke.
 */
function parseComplex(input: string): { re: number; im: number } | null {
  const s = input.replace(/\s+/g, "");
  if (s === "") return null;

  if (!/i$/i.test(s)) {
    const re = Number(s);
    return Number.isFinite(re) ? { re, im: 0 } : null;
  }

  const body = s.slice(0, -1);
  // The split between the real and imaginary terms is the last +/- that
  // isn't the leading sign and isn't part of an exponent like the "-" in
  // "1e-5" — scanning from the end and skipping anything just after an "e"
  // finds it without a full grammar.
  let splitIdx = -1;
  for (let k = body.length - 1; k > 0; k--) {
    const c = body[k];
    if ((c === "+" || c === "-") && body[k - 1].toLowerCase() !== "e") {
      splitIdx = k;
      break;
    }
  }

  const reStr = splitIdx === -1 ? "0" : body.slice(0, splitIdx);
  let imStr = splitIdx === -1 ? body : body.slice(splitIdx);
  if (imStr === "" || imStr === "+") imStr = "1";
  else if (imStr === "-") imStr = "-1";

  const re = reStr === "" ? 0 : Number(reStr);
  const im = Number(imStr);
  return Number.isFinite(re) && Number.isFinite(im) ? { re, im } : null;
}

/** `a+bi`, the inverse of parseComplex — used only to seed the default text,
 *  never to overwrite what's being typed. */
function formatComplex(re: number, im: number): string {
  if (im === 0) return trimNumber(re);
  const imPart = Math.abs(im) === 1 ? "i" : `${trimNumber(Math.abs(im))}i`;
  if (re === 0) return im < 0 ? `-${imPart}` : imPart;
  return `${trimNumber(re)}${im < 0 ? "-" : "+"}${imPart}`;
}

function trimNumber(n: number): string {
  return Number(n.toFixed(6)).toString();
}

function parseMatrix(text: string[][]): { opRe: number[][]; opIm: number[][] } {
  const opRe = text.map((row) => row.map((c) => parseComplex(c)?.re ?? 0));
  const opIm = text.map((row) => row.map((c) => parseComplex(c)?.im ?? 0));
  return { opRe, opIm };
}

function parseVector(text: string[]): { re: number[]; im: number[] } {
  const re = text.map((c) => parseComplex(c)?.re ?? 0);
  const im = text.map((c) => parseComplex(c)?.im ?? 0);
  return { re, im };
}

/**
 * A 1D hopping chain, 1 on the first off-diagonals and 0 elsewhere — real,
 * symmetric (hence Hermitian) at every dimension, and non-diagonal so its
 * eigenvectors are worth looking at. At dim = 2 this is exactly sigma_x.
 */
function defaultOperatorText(dim: number): string[][] {
  const text = Array.from({ length: dim }, () => Array<string>(dim).fill("0"));
  for (let i = 0; i < dim - 1; i++) {
    text[i][i + 1] = "1";
    text[i + 1][i] = "1";
  }
  return text;
}

function defaultStateText(dim: number): string[] {
  const text = Array<string>(dim).fill("0");
  text[0] = "1";
  return text;
}

interface Issue {
  i: number;
  j: number;
}

/**
 * Cells that break A = A†: a diagonal with a non-zero imaginary part, or an
 * (i, j)/(j, i) pair that isn't a conjugate match. Purely a client-side
 * heads-up — the API is the actual authority and is never asked while this
 * is non-empty.
 */
function hermiticityIssues(
  re: number[][],
  im: number[][],
  dim: number,
  tol = HERM_TOL,
): Issue[] {
  const issues: Issue[] = [];
  for (let i = 0; i < dim; i++) {
    for (let j = i; j < dim; j++) {
      if (i === j) {
        if (Math.abs(im[i][j]) > tol) issues.push({ i, j });
      } else if (
        Math.abs(re[i][j] - re[j][i]) > tol ||
        Math.abs(im[i][j] + im[j][i]) > tol
      ) {
        issues.push({ i, j });
      }
    }
  }
  return issues;
}

function setCell<T>(matrix: T[][], i: number, j: number, value: T): T[][] {
  return matrix.map((row, ri) => (ri === i ? row.map((v, ci) => (ci === j ? value : v)) : row));
}

function setEntry<T>(vector: T[], i: number, value: T): T[] {
  const next = [...vector];
  next[i] = value;
  return next;
}

/** A real KaTeX column vector, not text pretending to be one. */
function texColumnVector(v: ComplexVectorSchema): string {
  const rows = v.re.map((re, k) => formatComplex(re, v.im?.[k] ?? 0));
  return `\\begin{pmatrix} ${rows.join(" \\\\ ")} \\end{pmatrix}`;
}

// ── Chrome ──────────────────────────────────────────────────────────────────

// Every column the same fixed width, regardless of what's typed into it —
// an actual <table> so the grid lines and alignment come from the browser's
// table layout, not from hand-tuned spacing.
const CELL_WIDTH = "4.5rem";

function MatrixEditor({
  text,
  flagged,
  onChange,
}: {
  text: string[][];
  flagged: (i: number, j: number) => boolean;
  onChange: (i: number, j: number, v: string) => void;
}) {
  return (
    <table className="border-collapse">
      <colgroup>
        {text[0].map((_, j) => (
          <col key={j} style={{ width: CELL_WIDTH }} />
        ))}
      </colgroup>
      <tbody>
        {text.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="border border-border p-0">
                <ComplexCellInput
                  value={cell}
                  onChange={(v) => onChange(i, j, v)}
                  flagged={flagged(i, j)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VectorEditor({
  dim,
  text,
  onChange,
}: {
  dim: number;
  text: string[];
  onChange: (i: number, v: string) => void;
}) {
  return (
    <table className="border-collapse">
      <colgroup>
        <col style={{ width: CELL_WIDTH }} />
      </colgroup>
      <tbody>
        {Array.from({ length: dim }, (_, i) => (
          <tr key={i}>
            <td className="border border-border p-0">
              <ComplexCellInput value={text[i]} onChange={(v) => onChange(i, v)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DimSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {DIMS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={d === value}
          className={
            "rounded px-2 py-1 font-mono text-[11px] tabular-nums transition-colors " +
            (d === value ? "bg-surface text-foreground" : "text-muted hover:text-foreground")
          }
        >
          {d}×{d}
        </button>
      ))}
    </div>
  );
}

/**
 * One cell, one free-text field: type `a+bi`, `-2i`, `0.5`, whatever's
 * needed. Plain text rather than a numeric input on purpose — a numeric
 * input's value is a number, and a controlled number forces itself back to
 * 0 the instant what's typed doesn't parse (an empty field, a bare "-"),
 * which makes it impossible to clear a cell or start a negative number.
 * Text has no such round-trip: whatever you typed is exactly what's shown.
 */
function ComplexCellInput({
  value,
  onChange,
  flagged,
}: {
  value: string;
  onChange: (v: string) => void;
  flagged?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="text"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        "w-full border-0 bg-transparent px-1 py-2 text-center font-mono text-[13px] tabular-nums focus:bg-surface focus:outline-none " +
        (flagged ? "text-red-400" : "text-foreground")
      }
    />
  );
}

function OutcomeRow({ outcome }: { outcome: OutcomeSchema }) {
  const pct = Math.max(0, Math.min(100, outcome.probability * 100));
  return (
    <div className="rounded border border-border p-3">
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground">a = {outcome.value.toFixed(3)}</span>
        {outcome.degeneracy > 1 && (
          <span className="text-muted">×{outcome.degeneracy}</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
          {pct.toFixed(1)}%
        </span>
      </div>
      {outcome.state ? (
        <div className="mt-1 [&_.katex-display]:my-1">
          <p className="text-center text-[9px] uppercase tracking-[0.1em] text-faint">
            {outcome.degeneracy === 1 ? "eigenvector" : "projected state"}
          </p>
          <Tex block>{texColumnVector(outcome.state)}</Tex>
        </div>
      ) : (
        <p className="mt-2 text-center text-[11px] text-faint">
          never observed for this state
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-foreground"
    />
  );
}
