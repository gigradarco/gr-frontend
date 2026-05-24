import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, ImageUp, Paperclip } from 'lucide-react'
import { ATTACH_IMAGE_ACCEPT } from '../config/avatar'

function isAllowedImageFile(file: File): boolean {
  const mime = file.type.toLowerCase()
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png') return true
  const name = file.name.toLowerCase()
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')
}

type LaylaAttachDropdownProps = {
  variant: 'toolbar' | 'icon'
}

export function LaylaAttachDropdown({ variant }: LaylaAttachDropdownProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuId = useId()
  const triggerId = `${menuId}-trigger`

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (wrapRef.current?.contains(t)) return
      setOpen(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const openFilePicker = () => {
    inputRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!isAllowedImageFile(file)) {
      window.alert('Please choose a JPG or PNG image.')
      return
    }
    window.alert(`Demo: attached “${file.name}” (${Math.round(file.size / 1024)} KB).`)
    setOpen(false)
  }

  return (
    <div className="welcome-layla-attach-wrap" ref={wrapRef}>
      <input
        ref={inputRef}
        type="file"
        className="welcome-layla-attach-file-input"
        accept={ATTACH_IMAGE_ACCEPT}
        onChange={onFileChange}
        tabIndex={-1}
        aria-hidden
      />
      {variant === 'toolbar' ? (
        <button
          type="button"
          id={triggerId}
          className="welcome-layla-attach"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <Paperclip size={17} strokeWidth={2} aria-hidden />
          <span>Attach</span>
          <ChevronDown
            size={14}
            strokeWidth={2.25}
            className="welcome-layla-attach-chevron"
            aria-hidden
          />
        </button>
      ) : (
        <button
          type="button"
          id={triggerId}
          className="welcome-layla-attach-icon"
          aria-label="Attach"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <Paperclip size={20} strokeWidth={2} aria-hidden />
        </button>
      )}
      {open ? (
        <div
          id={menuId}
          className="welcome-layla-attach-menu"
          role="menu"
          aria-labelledby={triggerId}
        >
          <button
            type="button"
            role="menuitem"
            className="discover-new-chat-menu-item welcome-layla-attach-menu-item"
            onClick={() => {
              openFilePicker()
              setOpen(false)
            }}
          >
            <span className="welcome-layla-attach-menu-leading">
              <ImageUp size={18} strokeWidth={2} aria-hidden />
              <span className="welcome-layla-attach-menu-label">Upload image</span>
            </span>
            <span className="welcome-layla-attach-menu-meta">JPG, JPEG, PNG</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
