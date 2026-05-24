import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type SyntheticEvent,
} from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { AVATAR_CROP_CONFIG } from '../../../config/avatar'

const VIEWPORT: number = AVATAR_CROP_CONFIG.viewportPx
const OUTPUT: number = AVATAR_CROP_CONFIG.outputPx
const ZOOM_MIN: number = AVATAR_CROP_CONFIG.zoomMin
const ZOOM_MAX: number = AVATAR_CROP_CONFIG.zoomMax
const JPEG_QUALITY: number = AVATAR_CROP_CONFIG.jpegQuality

type Props = {
  file: File
  onCancel: () => void
  /** Called with cropped square JPEG (circle clip applied); may be async (e.g. upload). */
  onConfirm: (croppedFile: File) => void | Promise<void>
}

function clampPan(
  iw: number,
  ih: number,
  s: number,
  V: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  const minX = V / 2 - (iw * s) / 2
  const maxX = (iw * s) / 2 - V / 2
  const minY = V / 2 - (ih * s) / 2
  const maxY = (ih * s) / 2 - V / 2
  return {
    x: Math.min(maxX, Math.max(minX, panX)),
    y: Math.min(maxY, Math.max(minY, panY)),
  }
}

export function AvatarCropModal({ file, onCancel, onConfirm }: Props) {
  /**
   * Blob URLs must be created/revoked in an effect — not useMemo. In React Strict
   * Mode the revoke cleanup runs while useMemo still returns the same cached URL
   * string, so the <img> points at a revoked blob and never loads.
   */
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [meta, setMeta] = useState<{ iw: number; ih: number } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMeta(null)
    setLoadError(null)
    setZoom(ZOOM_MIN)
    setPan({ x: 0, y: 0 })
    const u = URL.createObjectURL(file)
    setObjectUrl(u)
    return () => {
      URL.revokeObjectURL(u)
    }
  }, [file])

  const drag = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  })

  const baseScale = meta ? Math.max(VIEWPORT / meta.iw, VIEWPORT / meta.ih) : 1
  const s = baseScale * zoom

  const clampPanCb = useCallback(
    (px: number, py: number) => {
      if (!meta) return { x: px, y: py }
      return clampPan(meta.iw, meta.ih, s, VIEWPORT, px, py)
    },
    [meta, s],
  )

  useEffect(() => {
    if (!meta) return
    setPan((p) => clampPanCb(p.x, p.y))
  }, [zoom, meta, s, clampPanCb])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = -e.deltaY * 0.0025
      setZoom((z) => {
        const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta))
        return Math.round(nz * 100) / 100
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const applyImageDimensions = useCallback((el: HTMLImageElement) => {
    const iw = el.naturalWidth
    const ih = el.naturalHeight
    if (iw > 0 && ih > 0) {
      setMeta({ iw, ih })
      setZoom(ZOOM_MIN)
      setPan({ x: 0, y: 0 })
    }
  }, [])

  const onImgLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      setLoadError(null)
      applyImageDimensions(e.currentTarget)
    },
    [applyImageDimensions],
  )

  const onImgError = useCallback(() => {
    setMeta(null)
    setLoadError(
      "Couldn't load this image. Try JPEG or PNG (HEIC often won't preview in the browser).",
    )
  }, [])

  /** From-cache loads may not fire onLoad after the listener is attached. */
  useLayoutEffect(() => {
    const el = imgRef.current
    if (!el || !objectUrl) return
    if (el.complete && el.naturalWidth > 0) {
      applyImageDimensions(el)
    }
  }, [objectUrl, applyImageDimensions])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { active: true, lastX: e.clientX, lastY: e.clientY }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.lastX
    const dy = e.clientY - drag.current.lastY
    drag.current.lastX = e.clientX
    drag.current.lastY = e.clientY
    setPan((p) => clampPanCb(p.x + dx, p.y + dy))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    drag.current.active = false
    const el = viewportRef.current
    if (el?.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
  }

  const exportCrop = async (): Promise<File | null> => {
    if (!meta) return null
    const { iw, ih } = meta
    const k = OUTPUT / VIEWPORT
    const s2 = s * k
    const px = pan.x * k
    const py = pan.y * k

    const drawToFile = (source: CanvasImageSource): Promise<File | null> =>
      new Promise((resolve) => {
        const canvas = document.createElement('canvas')
        canvas.width = OUTPUT
        canvas.height = OUTPUT
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.fillStyle = '#121212'
        ctx.fillRect(0, 0, OUTPUT, OUTPUT)
        ctx.save()
        ctx.beginPath()
        ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(
          source,
          OUTPUT / 2 + px - (iw * s2) / 2,
          OUTPUT / 2 + py - (ih * s2) / 2,
          iw * s2,
          ih * s2,
        )
        ctx.restore()

        canvas.toBlob(
          (blob) => {
            resolve(
              blob
                ? new File([blob], 'avatar-crop.jpg', { type: 'image/jpeg' })
                : null,
            )
          },
          'image/jpeg',
          JPEG_QUALITY,
        )
      })

    const img = imgRef.current
    if (img && img.naturalWidth > 0) {
      try {
        await img.decode()
      } catch {
        /* still try draw — decode() can reject while pixels are usable */
      }
      return drawToFile(img)
    }

    try {
      const bmp = await createImageBitmap(file)
      try {
        return await drawToFile(bmp)
      } finally {
        bmp.close()
      }
    } catch {
      return null
    }
  }

  const handleConfirm = async () => {
    setConfirmError(null)
    const cropped = await exportCrop()
    if (!cropped) {
      setConfirmError('Could not prepare the image. Try again or pick a different file.')
      return
    }
    setSaving(true)
    try {
      await onConfirm(cropped)
    } catch {
      /* Parent shows toast + rethrows; keep modal open for retry. */
    } finally {
      setSaving(false)
    }
  }

  const imgStyle =
    meta === null
      ? { display: 'none' as const }
      : {
          position: 'absolute' as const,
          left: VIEWPORT / 2 + pan.x - (meta.iw * s) / 2,
          top: VIEWPORT / 2 + pan.y - (meta.ih * s) / 2,
          width: meta.iw * s,
          height: meta.ih * s,
          pointerEvents: 'none' as const,
          userSelect: 'none' as const,
        }

  return (
    <motion.div
      className="avatar-crop-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="avatar-crop-backdrop"
        onClick={() => {
          if (!saving) onCancel()
        }}
        aria-hidden
      />
      <motion.div
        className="avatar-crop-sheet"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <header className="avatar-crop-header">
          <button
            type="button"
            className="avatar-crop-icon-btn"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancel crop"
          >
            <X size={20} />
          </button>
          <h2 id="avatar-crop-title" className="avatar-crop-title">
            Move &amp; zoom
          </h2>
          <span className="avatar-crop-header-spacer" aria-hidden />
        </header>

        <p className="avatar-crop-help">
          Drag to position. Pinch isn&apos;t required — use the slider or scroll to zoom.
        </p>

        <div
          ref={viewportRef}
          className="avatar-crop-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {objectUrl ? (
            <img
              key={objectUrl}
              ref={imgRef}
              src={objectUrl}
              alt=""
              className="avatar-crop-img"
              style={imgStyle}
              decoding="sync"
              onLoad={onImgLoad}
              onError={onImgError}
              draggable={false}
            />
          ) : null}
        </div>

        {loadError ? (
          <p className="avatar-crop-load-error" role="alert">
            {loadError}
          </p>
        ) : null}
               {objectUrl && !meta && !loadError ? (
          <p className="avatar-crop-loading" aria-live="polite">
            Loading preview…
          </p>
        ) : null}
        {confirmError ? (
          <p className="avatar-crop-load-error" role="alert">
            {confirmError}
          </p>
        ) : null}

        <div className="avatar-crop-zoom-row">
          <label className="avatar-crop-zoom-label" htmlFor="avatar-crop-zoom">
            Zoom
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={!meta || saving}
            className="avatar-crop-zoom-slider"
          />
        </div>

        <div className="avatar-crop-actions">
          <button
            type="button"
            className="avatar-crop-btn avatar-crop-btn--ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="avatar-crop-btn avatar-crop-btn--primary"
            onClick={() => void handleConfirm()}
            disabled={!meta || saving}
          >
            {saving ? 'Uploading…' : 'Use photo'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
