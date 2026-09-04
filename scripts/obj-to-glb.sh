#!/usr/bin/env bash
# Convert a downloaded OBJ into a web-ready GLB and report which part is the screen.
#
#   ./scripts/obj-to-glb.sh ~/Downloads/macbookpro.obj macbook-pro-16
#
# Uses meshopt compression, not Draco: the meshopt decoder ships inside the app
# bundle, while Draco would pull a decoder off a CDN and break offline use.
set -euo pipefail

src="${1:?usage: obj-to-glb.sh <input.obj> <device-id>}"
id="${2:?usage: obj-to-glb.sh <input.obj> <device-id>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/public/models/$id.glb"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

gt() { npx --yes @gltf-transform/cli@4 "$@"; }

cp "$src" "$tmp/model.obj"
mtl="${src%.obj}.mtl"
if [ -f "$mtl" ]; then
  cp "$mtl" "$tmp/model.mtl"
  sed -i '' "s|^mtllib .*|mtllib model.mtl|" "$tmp/model.obj" 2>/dev/null || true
else
  echo "No .mtl beside the OBJ. Writing a stub so material groups survive the conversion."
  # Without an .mtl, obj2gltf collapses every usemtl group into one material and
  # the screen becomes impossible to address.
  grep -h '^usemtl' "$tmp/model.obj" | awk '{print $2}' | sort -u |
    while read -r m; do printf '\nnewmtl %s\nKd 0.6 0.6 0.62\nKs 0.2 0.2 0.2\nNs 120\nd 1\nillum 2\n' "$m"; done > "$tmp/model.mtl"
  sed -i '' "s|^mtllib .*|mtllib model.mtl|" "$tmp/model.obj" 2>/dev/null || true
fi

echo "Converting…"
npx --yes obj2gltf@3 -i "$tmp/model.obj" -o "$tmp/raw.glb" --binary >/dev/null

echo "Optimizing…"
gt dedup "$tmp/raw.glb" "$tmp/a.glb" >/dev/null
gt weld "$tmp/a.glb" "$tmp/b.glb" >/dev/null
gt meshopt "$tmp/b.glb" "$out" --level high >/dev/null

echo
echo "=== parts in $id.glb — set screenMesh in src/devices.ts to match the display ==="
gt inspect "$out" | sed -e 's/\x1b\[[0-9;]*m//g' | sed -n '/MATERIALS/,/^$/p'
echo
echo "Tip: the display is usually the material whose UVs span the full 0..1 range."
ls -lh "$out"
