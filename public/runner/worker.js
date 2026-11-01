// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Runs tutorial code away from the page's main thread, so a slow or endless
// cell cannot freeze the page. Plain JS in public/ because it must be served at
// a stable URL, next to the Pyodide files it imports.
//
// Messages out: ready | failed | started | stdout | truncated | finished | crashed

import { loadPyodide } from "/pyodide/pyodide.mjs";

const MAX_OUTPUT_CHARS = 20000;

let outputChars = 0;
let truncated = false;

function writeOutput(line) {
  if (truncated) return;
  outputChars += line.length + 1;
  if (outputChars > MAX_OUTPUT_CHARS) {
    truncated = true;
    postMessage({ type: "truncated" });
    return;
  }
  postMessage({ type: "stdout", text: line });
}

async function boot() {
  const manifest = await (await fetch("/runner/eigora-wheel.json")).json();
  const pyodide = await loadPyodide({
    indexURL: "/pyodide/",
    stdout: writeOutput,
    stderr: writeOutput,
  });
  await pyodide.loadPackage(["numpy", "scipy", `/runner/${manifest.wheel}`], {
    messageCallback: () => {},
  });
  pyodide.runPython(await (await fetch("/runner/eigora_runtime.py")).text());
  // Import up front so the time limit measures the reader's code, not this.
  pyodide.runPython("import eigora");
  return {
    pyodide,
    prepare: pyodide.globals.get("prepare"),
    runCell: pyodide.globals.get("run_cell"),
  };
}

const booted = boot();
booted.then(
  () => postMessage({ type: "ready" }),
  (error) => postMessage({ type: "failed", message: String(error) }),
);

onmessage = async ({ data }) => {
  const { pyodide, prepare, runCell } = await booted;
  outputChars = 0;
  truncated = false;
  try {
    // Fetches matplotlib the first time a cell imports it. A module that isn't
    // available is left for Python to report, in the reader's own traceback.
    await pyodide
      .loadPackagesFromImports(data.code, {
        messageCallback: () => {},
        errorCallback: () => {},
      })
      .catch(() => {});
    prepare(data.code);
    postMessage({ type: "started", id: data.id });
    const { figures, error } = JSON.parse(runCell(data.code));
    postMessage({ type: "finished", id: data.id, figures, error });
  } catch (error) {
    // Python caught nothing, so the interpreter itself died (out of memory,
    // usually). It cannot be reused: the page starts a new worker next time.
    postMessage({ type: "crashed", id: data.id, message: String(error) });
  }
};
