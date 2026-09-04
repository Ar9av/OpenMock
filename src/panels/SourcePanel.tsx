import { useCallback, useEffect } from 'react'
import { useShot, useStore } from '../store'
import { delMedia, putMedia, useMediaUrl } from '../persist'
import { uid } from '../types'
import { classifyMedia, MEDIA_ACCEPT } from '../media'
import { Section } from '../ui/controls'

/** Accepts a media file into the given shot, replacing whatever was there. */
export function useAcceptMedia() {
  const shot = useShot()
  const updateShot = useStore((s) => s.updateShot)
  const setMediaError = useStore((s) => s.setMediaError)
  return useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      const kind = classifyMedia(file)
      if (!kind) {
        // Dropping a file and having nothing happen is the worst possible answer.
        setMediaError(`"${file.name}" is not an image or a video, so it was not loaded.`)
        return
      }
      setMediaError(null)
      const key = uid()
      await putMedia(key, file)
      const old = shot.source?.blobKey
      updateShot(shot.id, (s) => ({ ...s, source: { blobKey: key, kind } }))
      if (old) delMedia(old)
    },
    [shot.id, shot.source?.blobKey, updateShot, setMediaError],
  )
}

export function SourcePanel() {
  const shot = useShot()
  const updateShot = useStore((s) => s.updateShot)
  const preview = useMediaUrl(shot.source?.blobKey)
  const mediaError = useStore((s) => s.mediaError)
  const accept = useAcceptMedia()

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file')
      if (item) accept(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [accept])

  return (
    <Section title="Source" right={shot.name}>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          accept(e.dataTransfer.files[0])
        }}
      >
        <input type="file" accept={MEDIA_ACCEPT} hidden onChange={(e) => accept(e.target.files?.[0])} />
        {preview && shot.source?.kind === 'image' ? (
          <img src={preview} alt="source preview" />
        ) : preview ? (
          <video src={preview} muted loop autoPlay playsInline />
        ) : (
          <div className="dropzone-empty">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
            </svg>
            <strong>Click to upload</strong>
            <span>Drag &amp; drop or paste</span>
          </div>
        )}
      </label>
      {mediaError && <p className="error">{mediaError}</p>}
      {shot.source && (
        <button
          className="link"
          onClick={() => {
            delMedia(shot.source!.blobKey)
            updateShot(shot.id, (s) => ({ ...s, source: null }))
          }}
        >
          Remove media
        </button>
      )}
    </Section>
  )
}
