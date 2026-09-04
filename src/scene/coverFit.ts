/**
 * `object-fit: cover` as texture repeat factors.
 *
 * Aspects are width/height. The result is meant for a texture anchored at its
 * centre (`texture.center = 0.5, 0.5`), where scaling alone keeps the image
 * centred and no offset is needed. Anchoring at the corner instead would need a
 * matching offset, which is what makes flips and crops disagree.
 */
export function coverFit(srcAspect: number, dstAspect: number): [number, number] {
  if (srcAspect >= dstAspect) return [dstAspect / srcAspect, 1]
  return [1, srcAspect / dstAspect]
}
