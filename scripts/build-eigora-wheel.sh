#!/usr/bin/env bash
# Copyright (C) 2026 Tanguy Marsault - Eigora
# SPDX-License-Identifier: AGPL-3.0-or-later

# Rebuild the eigora wheel the tutorial cells run against, from a ref of the
# package repo, and update the path the browser worker loads. Run this by hand
# when the tutorials should move to a newer eigora, then commit the result.
#
# Usage: scripts/build-eigora-wheel.sh [ref]   (default: main)
# Needs: git, and a Python with `build` and `hatchling` installed.
set -euo pipefail

ref="${1:-main}"
repo="https://github.com/Tampipo/eigora"
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 --branch "$ref" "$repo" "$tmp/eigora"
(cd "$tmp/eigora" && python -m build --wheel --no-isolation --outdir "$tmp/dist" >/dev/null)

rm -f "$root"/public/runner/eigora-*.whl
cp "$tmp"/dist/eigora-*.whl "$root/public/runner/"
wheel="$(basename "$tmp"/dist/eigora-*.whl)"
sha="$(git -C "$tmp/eigora" rev-parse HEAD)"
printf '{\n  "wheel": "%s",\n  "commit": "%s"\n}\n' "$wheel" "$sha" > "$root/public/runner/eigora-wheel.json"
echo "Built $wheel from $repo@$sha"
