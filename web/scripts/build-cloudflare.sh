#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci --prefer-offline --no-audit --no-fund
npm run source:check

# Production deploys use the prebuilt WASM packages committed by
# .github/workflows/build-wasm.yml. That workflow rebuilds them only when
# Rust/WASM sources or their build scripts change.
for dir in wasm/pkg wasm/pkg-threads wasm/pkg-nosimd wasm/pkg-threads-nosimd; do
  if [ ! -d "$dir" ] || ! find "$dir" -maxdepth 1 -name '*.wasm' -print -quit | grep -q .; then
    echo "Missing prebuilt WASM package: $dir" >&2
    echo "Run the Build WASM packages workflow before deploying." >&2
    exit 1
  fi
done

echo "Using committed prebuilt WASM packages; Rust/WASM compilation skipped."
npm run typecheck
npx vite build
