export type MediaKind = 'image' | 'video'

const VIDEO_EXT = /\.(mp4|m4v|webm|mov|qt|ogv|ogg|mkv|avi|mpe?g|3gp)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|heic|heif)$/i

/**
 * Works out what a dropped file is.
 *
 * The browser's MIME type is checked first, then the extension, because files
 * dragged from some apps and archives arrive with an empty `type`. Trusting the
 * MIME type alone silently discards perfectly good screen recordings.
 */
export function classifyMedia(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  if (VIDEO_EXT.test(file.name)) return 'video'
  if (IMAGE_EXT.test(file.name)) return 'image'
  return null
}

/** File picker filter. Extensions are listed too, since MIME filters miss some files. */
export const MEDIA_ACCEPT = 'image/*,video/*,.mp4,.m4v,.webm,.mov,.mkv,.avi,.ogv,.png,.jpg,.jpeg,.gif,.webp,.avif,.heic'
