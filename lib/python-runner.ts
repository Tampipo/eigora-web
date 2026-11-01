// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// One Python worker shared by every cell on the page, running one job at a time.
// A worker that runs too long is terminated rather than interrupted: that is the
// only way to stop code stuck in a loop, and the next job simply starts another.

export const TIME_LIMIT_SECONDS = 10;
export const MAX_CODE_CHARS = 5000;
/** Downloading and starting Python is not the reader's code, so it gets longer. */
const BOOT_LIMIT_MS = 180_000;

/** A figure as a base64-encoded PNG. */
export type CellFigure = string;

export type CellResult = {
  status: "finished" | "timeout" | "crashed" | "failed" | "cancelled";
  stdout: string;
  truncated: boolean;
  figures: CellFigure[];
  error: string | null;
};

type Job = {
  id: number;
  code: string;
  stdout: string[];
  truncated: boolean;
  onStarted: () => void;
  resolve: (result: CellResult) => void;
};

let worker: Worker | null = null;
let current: Job | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 0;
const queue: Job[] = [];

function clearTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function setLimit(ms: number, status: CellResult["status"]) {
  clearTimer();
  timer = setTimeout(() => settle(status, { killWorker: true }), ms);
}

/** Finish the current job, then start whichever is next. */
function settle(
  status: CellResult["status"],
  options: {
    killWorker?: boolean;
    figures?: CellFigure[];
    error?: string | null;
  } = {},
) {
  clearTimer();
  if (options.killWorker) {
    worker?.terminate();
    worker = null;
  }
  const job = current;
  current = null;
  job?.resolve({
    status,
    stdout: job.stdout.join("\n"),
    truncated: job.truncated,
    figures: options.figures ?? [],
    error: options.error ?? null,
  });
  startNext();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const created = new Worker("/runner/worker.js", { type: "module" });
  created.onerror = () => settle("failed", { killWorker: true });
  created.onmessage = ({ data }) => {
    if (created !== worker) return;
    switch (data.type) {
      case "failed":
        settle("failed", { killWorker: true });
        break;
      case "started":
        current?.onStarted();
        setLimit(TIME_LIMIT_SECONDS * 1000, "timeout");
        break;
      case "stdout":
        current?.stdout.push(data.text);
        break;
      case "truncated":
        if (current) current.truncated = true;
        break;
      case "finished":
        settle("finished", { figures: data.figures, error: data.error });
        break;
      case "crashed":
        settle("crashed", { killWorker: true });
        break;
    }
  };
  worker = created;
  return created;
}

function startNext() {
  if (current) return;
  const job = queue.shift();
  if (!job) return;
  current = job;
  setLimit(BOOT_LIMIT_MS, "failed");
  ensureWorker().postMessage({ id: job.id, code: job.code });
}

export function runPython(code: string, onStarted: () => void) {
  const id = ++nextId;
  const promise = new Promise<CellResult>((resolve) => {
    queue.push({
      id,
      code,
      stdout: [],
      truncated: false,
      onStarted,
      resolve,
    });
    startNext();
  });

  const cancel = () => {
    if (current?.id === id) {
      settle("cancelled", { killWorker: true });
      return;
    }
    const index = queue.findIndex((job) => job.id === id);
    if (index === -1) return;
    const [job] = queue.splice(index, 1);
    job.resolve({
      status: "cancelled",
      stdout: "",
      truncated: false,
      figures: [],
      error: null,
    });
  };

  return { promise, cancel };
}
