#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="${HOME}/.cargo/bin:${PATH}"
toolchain=nightly-2026-08-30

if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs |
    sh -s -- -y --profile minimal --default-toolchain "$toolchain" --no-modify-path
fi
rustup toolchain install "$toolchain" --profile minimal --component rust-src --target wasm32-unknown-unknown
# Install the prebuilt binary instead of compiling wasm-pack from source.
npm install --global wasm-pack@0.15.0
npm ci
npm run build
npm test
