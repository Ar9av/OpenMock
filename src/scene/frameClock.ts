/**
 * The local time of the frame being drawn right now.
 *
 * Overlays animate inside `onBeforeRender` rather than through React state,
 * because export renders frames faster than React commits. Playback and the
 * exporter both write here, so a single code path drives both.
 */
let localTime = 0

export const setFrameTime = (t: number) => {
  localTime = t
}
export const getFrameTime = () => localTime
