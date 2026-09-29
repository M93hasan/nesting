#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="${HOME}/.cargo/bin:${PATH}"
toolchain=nightly-2026-08-30

npm ci --prefer-offline --no-audit --no-fund

# Cloudflare cache'inde hazır WASM paketleri varsa pahalı Rust derlemesini atla.
wasm_ready=true
for dir in wasm/pkg wasm/pkg-threads wasm/pkg-nosimd wasm/pkg-threads-nosimd; do
  if [ ! -d "$dir" ] || ! find "$dir" -maxdepth 1 -name '*.wasm' -print -quit | grep -q .; then
    wasm_ready=false
    break
  fi
done

if [ "$wasm_ready" = false ]; then
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
else
  echo "WASM unchanged/cached: Rust compilation skipped."
fi

npm run typecheck
npx vite build
npm test
