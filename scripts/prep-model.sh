#!/usr/bin/env bash
# Optimize a downloaded GLB for the web and print its mesh names so you can fill
# in the screenMesh regex in src/devices.ts.
#
#   ./scripts/prep-model.sh ~/Downloads/iphone.glb iphone-17-pro
set -euo pipefail

src="${1:?usage: prep-model.sh <input.glb> <device-id>}"
id="${2:?usage: prep-model.sh <input.glb> <device-id>}"
out="$(dirname "$0")/../public/models/$id.glb"

npx --yes @gltf-transform/cli optimize "$src" "$out" \
  --texture-compress webp --compress draco --simplify false

echo
echo "=== meshes in $id.glb (pick the display surface for screenMesh) ==="
npx --yes @gltf-transform/cli inspect "$out" | sed -n '/Meshes/,/^$/p'
echo
ls -lh "$out"
