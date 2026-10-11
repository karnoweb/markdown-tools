#!/usr/bin/env bash
# Builds build/icon.icns from build/icon.png (macOS only; needs sips + iconutil).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PNG="$ROOT/build/icon.png"
ICONSET="$ROOT/build/icon.iconset"
ICNS="$ROOT/build/icon.icns"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "prepare-mac-icons.sh: skipped (not macOS)"
  exit 0
fi

if [[ ! -f "$PNG" ]]; then
  echo "Missing $PNG — run: npm run icons" >&2
  exit 1
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

for s in 16 32 64 128 256 512; do
  sips -z "$s" "$s" "$PNG" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
done
cp "$ICONSET/icon_32x32.png" "$ICONSET/icon_16x16@2x.png"
cp "$ICONSET/icon_64x64.png" "$ICONSET/icon_32x32@2x.png"
cp "$ICONSET/icon_256x256.png" "$ICONSET/icon_128x128@2x.png"
cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_256x256@2x.png"
rm -f "$ICONSET/icon_64x64.png"

iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$ICONSET"
echo "Wrote $ICNS"
