// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Assemble public/pyodide/, the self-hosted Python runtime for tutorial cells.
//
// Self-hosted because the privacy policy promises that a reader's browser
// contacts no third party. The core comes from the `pyodide` npm package, pinned
// by package-lock.json. NumPy, SciPy and matplotlib are not in that package, so they are
// downloaded at build time and checked against the hashes in its lock file.
//
// Generated output, not committed. Runs before `npm run dev` and `npm run build`.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "node_modules", "pyodide");
const TARGET = path.join(ROOT, "public", "pyodide");
const CORE = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];
const PACKAGES = ["numpy", "scipy", "matplotlib"];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function isIntact(file, expected) {
  try {
    return sha256(await readFile(file)) === expected;
  } catch {
    return false;
  }
}

const { version } = JSON.parse(
  await readFile(path.join(SOURCE, "package.json"), "utf8"),
);
const lock = JSON.parse(
  await readFile(path.join(SOURCE, "pyodide-lock.json"), "utf8"),
);

await mkdir(TARGET, { recursive: true });
await Promise.all(
  CORE.map((file) => copyFile(path.join(SOURCE, file), path.join(TARGET, file))),
);

const needed = new Set();
(function collect(names) {
  for (const name of names) {
    if (needed.has(name)) continue;
    needed.add(name);
    collect(lock.packages[name].depends);
  }
})(PACKAGES);

for (const name of needed) {
  const { file_name: fileName, sha256: expected } = lock.packages[name];
  const file = path.join(TARGET, fileName);
  if (await isIntact(file, expected)) continue;

  const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${fileName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== expected) throw new Error(`${fileName}: hash mismatch`);
  await writeFile(file, bytes);
  console.log(`fetched ${fileName}`);
}
console.log(`Python runtime ready: pyodide ${version}, ${[...needed].join(", ")}`);
