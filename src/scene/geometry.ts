/**
 * RoundedBoxGeometry rounds every edge, so the corner radius cannot exceed half
 * of the box's smallest dimension. Past that the geometry self-intersects and
 * shades black, which is what a too-round thin lid or phone body looks like.
 */
export const safeRadius = (r: number, ...dims: number[]) => Math.max(0, Math.min(r, Math.min(...dims) / 2 - 0.001))
