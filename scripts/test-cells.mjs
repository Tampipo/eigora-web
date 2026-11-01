// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Run every tutorial cell in the same Pyodide, wheel and runtime that readers
// get, so a change that breaks a tutorial fails CI instead of failing on the
// page. Also checks the limits a reader's own code runs up against.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadPyodide } from "pyodide";

const ROOT = path.resolve(import.meta.dirname, "..");
const CELLS = path.join(ROOT, "content", "cells");
const RUNNER = path.join(ROOT, "public", "runner");

const { wheel } = JSON.parse(
  await readFile(path.join(RUNNER, "eigora-wheel.json"), "utf8"),
);
const output = [];
const pyodide = await loadPyodide({
  indexURL: path.join(ROOT, "public", "pyodide") + path.sep,
  stdout: (line) => output.push(line),
  stderr: (line) => output.push(line),
});
await pyodide.loadPackage(["numpy", "scipy", path.join(RUNNER, wheel)], {
  messageCallback: () => {},
});
pyodide.runPython(await readFile(path.join(RUNNER, "eigora_runtime.py"), "utf8"));
const prepare = pyodide.globals.get("prepare");
const runCell = pyodide.globals.get("run_cell");
async function run(code) {
  await pyodide
    .loadPackagesFromImports(code, {
      messageCallback: () => {},
      errorCallback: () => {},
    })
    .catch(() => {});
  prepare(code);
  const started = performance.now();
  const result = JSON.parse(runCell(code));
  return { ...result, ms: Math.round(performance.now() - started) };
}

let failures = 0;
function check(name, passed, detail = "") {
  console.log(`${passed ? "ok  " : "FAIL"} ${name}`);
  if (!passed) {
    failures += 1;
    if (detail) console.log(detail);
  }
}

for (const file of (await readdir(CELLS)).sort()) {
  if (!file.endsWith(".py")) continue;
  const code = await readFile(path.join(CELLS, file), "utf8");
  await run(code); // first run pays for imports and matplotlib's font cache
  const { error, ms } = await run(code);
  check(`cell ${file} (${ms} ms)`, error === null, error ?? "");
}

const noise = output.filter((line) => /Warning|loaded|to load/.test(line));
check("cells print no internal noise", noise.length === 0, noise.join("\n"));

const PLT = "import matplotlib.pyplot as plt\n";
const contains = (text) => (result) => result.error?.includes(text) ?? false;
const figures = (count) => (result) =>
  result.error === null && result.figures.length === count;
const cases = [
  ["reports errors from the reader's code", "1 / 0", contains("ZeroDivisionError")],
  ["survives sys.exit", "import sys; sys.exit(1)", contains("SystemExit")],
  ["reports modules that don't exist", "import nonexistent", contains("ModuleNotFoundError")],
  ["returns one figure per plt.show", `${PLT}plt.plot([1]); plt.show(); plt.plot([2]); plt.show()`, figures(2)],
  ["keeps a figure with no plt.show", `${PLT}plt.plot([1])`, figures(1)],
  ["supports the wider matplotlib API", `${PLT}f, a = plt.subplots(2, 2); a[0, 0].hist([1, 2]); plt.show()`, figures(1)],
  [
    "limits the number of figures",
    `${PLT}for _ in range(5):\n    plt.plot([1]); plt.show()`,
    contains("at most 4 figures"),
  ],
  [
    "limits the size of a figure",
    `${PLT}plt.figure(figsize=(1000, 1000)); plt.plot([1]); plt.show()`,
    (result) => result.error === null && result.figures[0].length < 3_000_000,
  ],
  [
    "turns an impossibly large array into an error",
    "import numpy as np; np.ones(2**29)",
    contains("array is too big"),
  ],
  ["starts each cell with a clean namespace", "print(leftover)", contains("NameError")],
];
await run("leftover = 1");
for (const [name, code, passes] of cases) {
  const result = await run(code);
  check(name, passes(result), JSON.stringify(result).slice(0, 400));
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
