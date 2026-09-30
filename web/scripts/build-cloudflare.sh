#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci --prefer-offline --no-audit --no-fund
npm run source:check

expected_wasm_fingerprint="$(node scripts/wasm-fingerprint.mjs)"
actual_wasm_fingerprint="$(cat wasm/prebuilt.sha256 2>/dev/null || true)"
if [ "$expected_wasm_fingerprint" != "$actual_wasm_fingerprint" ]; then
  echo "Prebuilt WASM is stale or missing for the current Rust/WASM sources." >&2
  echo "Wait for the Build WASM packages workflow to refresh the prebuilt output." >&2
  exit 1
fi

for dir in wasm/pkg wasm/pkg-threads wasm/pkg-nosimd wasm/pkg-threads-nosimd; do
  if [ ! -d "$dir" ] || ! find "$dir" -maxdepth 1 -name '*.wasm' -print -quit | grep -q .; then
    echo "Missing prebuilt WASM package: $dir" >&2
    exit 1
  fi
done

echo "Using verified prebuilt WASM packages; Rust/WASM compilation skipped."
npm run typecheck
npx vite build
