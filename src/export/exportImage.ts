import { beginExportViewport } from './renderContext'

/** Copies the WebGL canvas into a 2D canvas, preserving alpha. */
export function canvasToBlob(source: HTMLCanvasElement, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const c2d = canvas.getContext('2d')!
  c2d.drawImage(source, 0, 0, width, height)
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
}

/** Renders the live scene off-screen at an arbitrary size and returns a PNG blob. */
export async function exportPNG({ width, height, transparent }: { width: number; height: number; transparent: boolean }) {
  const view = beginExportViewport(width, height, transparent)
  try {
    view.render()
    return await canvasToBlob(view.gl.domElement, width, height)
  } finally {
    view.restore()
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
