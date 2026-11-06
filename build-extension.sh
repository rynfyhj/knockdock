#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="knockdock@casper.local"
OUT="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$OUT"
rm -f "$OUT/$UUID.shell-extension.zip" "$OUT/$UUID.zip" "$OUT/SHA256SUMS"

glib-compile-schemas --strict "$ROOT/schemas"

ROOT_FILES=(
  metadata.json
  extension.js
  prefs.js
  prefs-standalone.mjs
  stylesheet.css
  LICENSE
  README.md
  CHANGELOG.md
  animator.js
  autohide.js
  diagnostics.js
  dockItemMenu.js
  dockItems.js
  dock.js
  drawing.js
  integrations.js
  magic_lamp.js
  monitors.js
  services.js
  style.js
  timer.js
  utils.js
  vector.js
)

for file in "${ROOT_FILES[@]}"; do
  install -Dm644 "$ROOT/$file" "$STAGE/$file"
done

for dir in apps effects preferences schemas ui; do
  rsync -a \
    --exclude='legacy/' \
    --exclude='images/' \
    --exclude='gschemas.compiled' \
    "$ROOT/$dir/" "$STAGE/$dir/"
done

if [ -d "$ROOT/themes" ]; then
  rsync -a "$ROOT/themes/" "$STAGE/themes/"
fi

if [ -d "$ROOT/locale" ]; then
  rsync -a "$ROOT/locale/" "$STAGE/locale/"
fi

find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +

(
  cd "$STAGE"
  zip -9 -q -r "$OUT/$UUID.shell-extension.zip" .
)

cp "$OUT/$UUID.shell-extension.zip" "$OUT/$UUID.zip"

(
  cd "$OUT"
  sha256sum "$UUID.shell-extension.zip" "$UUID.zip" > SHA256SUMS
)

echo "Built:"
echo "  $OUT/$UUID.shell-extension.zip"
echo "  $OUT/$UUID.zip"
echo "  $OUT/SHA256SUMS"
