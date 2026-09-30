#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="${HOME}/.cargo/bin:${PATH}"
toolchain=nightly-2026-08-30

npm ci --prefer-offline --no-audit --no-fund

# Reuse the generated WASM packages when the Rust inputs have not changed.
# The fingerprint is kept inside wasm/pkg, so Cloudflare's build cache can
# restore both the packages and the fingerprint on the next deployment.
wasm_hash_file="wasm/pkg/.serula-build-hash"
wasm_hash="$(
  {
    printf '%s\n' "$toolchain" "wasm-pack@0.15.0" "simd+threads+nosimd";
    find wasm -type f \( -name '*.rs' -o -name 'Cargo.toml' -o -name 'Cargo.lock' \) -print0 |
      sort -z |
      xargs -0 sha256sum
    sha256sum scripts/build-wasm.mjs scripts/rayon-helpers.js
  } | sha256sum | awk '{print $1}'
)"

wasm_ready=true
for dir in wasm/pkg wasm/pkg-threads wasm/pkg-nosimd wasm/pkg-threads-nosimd; do
  if [ ! -d "$dir" ] || ! find "$dir" -maxdepth 1 -name '*.wasm' -print -quit | grep -q .; then
    wasm_ready=false
    break
  fi
done

if [ "$wasm_ready" = true ] && [ -f "$wasm_hash_file" ] && [ "$(cat "$wasm_hash_file")" = "$wasm_hash" ]; then
  echo "WASM inputs unchanged: cached Rust build reused."
else
  if ! command -v rustup >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs |
      sh -s -- -y --profile minimal --default-toolchain "$toolchain" --no-modify-path
  fi
  if ! rustup toolchain list | grep -q "^$toolchain"; then
    rustup toolchain install "$toolchain" --profile minimal
  fi
  rustup target add wasm32-unknown-unknown --toolchain "$toolchain"
  rustup component add rust-src --toolchain "$toolchain"
  if ! command -v wasm-pack >/dev/null 2>&1 || ! wasm-pack --version | grep -q '0.15.0'; then
    npm install --global wasm-pack@0.15.0
  fi
  npm run wasm:build
  printf '%s\n' "$wasm_hash" > "$wasm_hash_file"
fi

npm run source:check
npm run typecheck
npx vite build
npm test
