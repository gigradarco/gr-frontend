import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Camera, Clipboard, Sparkles } from 'lucide-react'
import { UploadToast, type UploadToastState } from '../../../components/UploadToast'
import {
  getCachedAvatarDataUrl,
  persistAvatarToLocalCache,
  warmAvatarCacheIfEmpty,
} from '../../../lib/avatar-image-cache.ts'
import { postProfileAvatar } from '../../../lib/auth-api'
import { resizeImageForAvatar } from '../../../lib/resizeImageForAvatar'
import { api } from '../../../lib/trpc'
import { useAppState } from '../../../store/appStore'
import { AvatarCropModal } from './AvatarCropModal'

function normalizeProfileUsername(s: string): string {
  return s.trim().replace(/^@+/, '').toLowerCase()
}

function compactBioText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 280)
}

function buildBioPrompt(input: {
  displayName: string
  username: string
  currentBio: string
  response: string
  notes: string
}): string {
  const displayName = input.displayName.trim() || 'this Buzo user'
  const username = normalizeProfileUsername(input.username)
  const currentBio = input.currentBio.trim()
  const response = input.response.trim()
  const notes = input.notes.trim()

  return [
    'Write a concise Buzo profile bio for an events and nightlife discovery app.',
    'Constraints:',
    '- Max 280 characters.',
    '- 1 sentence, or 2 short fragments.',
    '- Make it specific, social, and taste-led.',
    '- Mention genres, scenes, venues, or event energy if useful.',
    '- No hashtags, emojis, quotation marks, or generic hype.',
    '- Return only the final bio text.',
    '',
    `Display name: ${displayName}`,
    username ? `Username: @${username}` : null,
    currentBio ? `Current bio: ${currentBio}` : null,
    response ? `My response: ${response}` : null,
    notes ? `My notes: ${notes}` : null,
    !response && !notes
      ? 'If my response and notes are empty, ask me what genres, clubs, venues, event vibe, and people I want to meet before writing.'
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function EditProfileScreen() {
  const closeEditProfile = useAppState((s) => s.closeEditProfile)
  const setUserProfile = useAppState((s) => s.setUserProfile)
  const avatarUrl = useAppState((s) => s.userProfile.avatarUrl)
  const [avatarCacheTick, setAvatarCacheTick] = useState(0)
  const avatarDisplayUrl = useMemo(
    () => getCachedAvatarDataUrl(avatarUrl) ?? avatarUrl,
    [avatarUrl, avatarCacheTick],
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const bioPromptCopyTimerRef = useRef<number | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null)
  const [uploadToast, setUploadToast] = useState<UploadToastState>(null)
  const toastIdRef = useRef(0)

  const initialNormalized = useRef(
    normalizeProfileUsername(useAppState.getState().userProfile.username),
  )
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null)

  const checkUsernameMu = api.profile.checkUsername.useMutation()
  const updateProfileMu = api.profile.update.useMutation()

  const dismissUploadToast = useCallback(() => setUploadToast(null), [])

  const pushUploadToast = useCallback((message: string, variant: 'success' | 'error') => {
    toastIdRef.current += 1
    setUploadToast({ id: toastIdRef.current, variant, message })
  }, [])

  const [displayName, setDisplayName] = useState(
    () => useAppState.getState().userProfile.displayName,
  )
  const [username, setUsername] = useState(() =>
    normalizeProfileUsername(useAppState.getState().userProfile.username),
  )
  const [bio, setBio] = useState(() => useAppState.getState().userProfile.bio)
  const [activeBioTab, setActiveBioTab] = useState<'bio' | 'builder'>(() =>
    useAppState.getState().userProfile.bio.trim().length > 0 ? 'bio' : 'builder',
  )
  const [bioBuilderResponse, setBioBuilderResponse] = useState('')
  const [bioBuilderNotes, setBioBuilderNotes] = useState('')
  const [bioAiDraft, setBioAiDraft] = useState('')
  const [bioPromptCopied, setBioPromptCopied] = useState(false)

  const bioPrompt = useMemo(
    () =>
      buildBioPrompt({
        displayName,
        username,
        currentBio: bio,
        response: bioBuilderResponse,
        notes: bioBuilderNotes,
      }),
    [bio, bioBuilderNotes, bioBuilderResponse, displayName, username],
  )

  useEffect(() => {
    const n = normalizeProfileUsername(username)
    setVerifiedFor((prev) => (prev !== null && n !== prev ? null : prev))
  }, [username])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
      if (bioPromptCopyTimerRef.current !== null) {
        window.clearTimeout(bioPromptCopyTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!avatarUrl?.trim()) return
    let cancelled = false
    void warmAvatarCacheIfEmpty(avatarUrl.trim()).then((wrote) => {
      if (!cancelled && wrote) setAvatarCacheTick((t) => t + 1)
    })
    return () => {
      cancelled = true
    }
  }, [avatarUrl])

  const normalizedNow = normalizeProfileUsername(username)
  const usernameChanged = normalizedNow !== initialNormalized.current

  const openPhotoPicker = () => {
    setPhotoError(null)
    fileInputRef.current?.click()
  }

  const onPhotoSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) {
      setPhotoError('Choose an image file.')
      return
    }
    setPhotoError(null)
    setPendingCropFile(file)
  }

  const onCropConfirm = async (cropped: File) => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const prepared = await resizeImageForAvatar(cropped)
      const url = await postProfileAvatar(prepared)
      setUserProfile({ avatarUrl: url })
      setPendingCropFile(null)
      pushUploadToast('Profile photo updated.', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setPhotoError(msg)
      pushUploadToast(msg, 'error')
      throw err
    } finally {
      setPhotoBusy(false)
    }
  }

  const onVerifyUsername = async () => {
    const n = normalizeProfileUsername(username)
    if (n.length < 4) {
      pushUploadToast('Username must be at least 4 characters.', 'error')
      return
    }
    if (!usernameChanged) {
      pushUploadToast('This is already your username.', 'success')
      setVerifiedFor(n)
      return
    }
    try {
      const r = await checkUsernameMu.mutateAsync({ username: n })
      if (r.available) {
        setVerifiedFor(n)
        pushUploadToast('Username is available.', 'success')
      } else {
        pushUploadToast('That username is taken.', 'error')
      }
    } catch (err) {
      pushUploadToast(err instanceof Error ? err.message : 'Could not verify username.', 'error')
    }
  }

  const copyBioPrompt = async () => {
    if (!navigator.clipboard?.writeText) {
      pushUploadToast('Copy is not available in this browser.', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(bioPrompt)
      setBioPromptCopied(true)
      pushUploadToast('Bio prompt copied.', 'success')
      if (bioPromptCopyTimerRef.current !== null) {
        window.clearTimeout(bioPromptCopyTimerRef.current)
      }
      bioPromptCopyTimerRef.current = window.setTimeout(() => {
        setBioPromptCopied(false)
      }, 1800)
    } catch (err) {
      pushUploadToast(err instanceof Error ? err.message : 'Could not copy prompt.', 'error')
    }
  }

  const applyBioAiDraft = () => {
    const nextBio = compactBioText(bioAiDraft)
    if (!nextBio) {
      pushUploadToast('Paste a GPT or Gemini bio first.', 'error')
      return
    }
    setBio(nextBio)
    setBioAiDraft(nextBio)
    setActiveBioTab('bio')
    pushUploadToast('Bio draft applied.', 'success')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const n = normalizeProfileUsername(username)
    if (!n) {
      pushUploadToast('Choose a username.', 'error')
      return
    }
    if (usernameChanged) {
      if (n.length < 4) {
        pushUploadToast('Username must be at least 4 characters.', 'error')
        return
      }
      if (verifiedFor !== n) {
        pushUploadToast('Verify your new username before saving.', 'error')
        return
      }
    }
    const payload: {
      displayName: string
      bio: string
      username?: string
    } = {
      displayName: displayName.trim(),
      bio: bio.trim(),
    }
    if (usernameChanged) {
      payload.username = n
    }
    try {
      const data = await updateProfileMu.mutateAsync(payload)
      setUserProfile({
        displayName: String(data.display_name ?? '').trim() || displayName.trim(),
        username: normalizeProfileUsername(String(data.username ?? n)),
        bio: String(data.bio ?? '').trim(),
        avatarUrl: String(data.avatar_url ?? avatarUrl),
      })
      pushUploadToast('Profile saved.', 'success')
      closeTimerRef.current = window.setTimeout(() => {
        closeEditProfile()
      }, 900)
    } catch (err) {
      pushUploadToast(err instanceof Error ? err.message : 'Could not save profile.', 'error')
    }
  }

  const bioField = (
    <div className="edit-profile-bio-field">
      <label className="edit-profile-label" htmlFor="edit-profile-bio">
        Bio <span className="edit-profile-optional">(optional)</span>
      </label>
      <textarea
        id="edit-profile-bio"
        className="edit-profile-textarea"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Clubs, genres, what you’re into…"
        rows={4}
        maxLength={280}
      />
      <p className="edit-profile-char-count" aria-live="polite">
        {bio.length}/280
      </p>
    </div>
  )

  const bioBuilder = (
    <div className="edit-profile-bio-builder" aria-labelledby="edit-profile-bio-builder-title">
      <div className="edit-profile-bio-builder-head">
        <span className="edit-profile-bio-builder-icon" aria-hidden>
          <Sparkles size={16} />
        </span>
        <div className="edit-profile-bio-builder-copy">
          <h4 id="edit-profile-bio-builder-title">Bio builder</h4>
          <p>Use GPT or Gemini to draft your profile, then review it in Buzo.</p>
        </div>
      </div>

      <ol className="edit-profile-bio-builder-steps" aria-label="Bio builder steps">
        <li>Copy the prompt template into GPT or Gemini.</li>
        <li>Answer the AI questions, then paste that answer into My response.</li>
        <li>Add any extra taste, venue, or vibe notes under My notes.</li>
        <li>Paste the final AI bio into AI response, then tap Use draft.</li>
      </ol>

      <label className="edit-profile-helper-label" htmlFor="edit-profile-bio-prompt">
        Prompt template
      </label>
      <textarea
        id="edit-profile-bio-prompt"
        className="edit-profile-helper-textarea edit-profile-helper-textarea--prompt"
        value={bioPrompt}
        readOnly
        rows={6}
      />
      <button
        type="button"
        className="edit-profile-bio-copy-prompt"
        onClick={() => void copyBioPrompt()}
      >
        <Clipboard size={16} aria-hidden />
        <span>{bioPromptCopied ? 'Prompt copied' : 'Copy prompt'}</span>
      </button>

      <label className="edit-profile-helper-label" htmlFor="edit-profile-bio-response">
        My response
      </label>
      <textarea
        id="edit-profile-bio-response"
        className="edit-profile-helper-textarea"
        value={bioBuilderResponse}
        onChange={(e) => setBioBuilderResponse(e.target.value)}
        placeholder="What you told GPT or Gemini about your taste, scene, and vibe..."
        rows={3}
      />

      <label className="edit-profile-helper-label" htmlFor="edit-profile-bio-notes">
        My notes
      </label>
      <textarea
        id="edit-profile-bio-notes"
        className="edit-profile-helper-textarea"
        value={bioBuilderNotes}
        onChange={(e) => setBioBuilderNotes(e.target.value)}
        placeholder="Genres, clubs, venues, event vibe, who you want to meet..."
        rows={3}
      />

      <div className="edit-profile-field-divider edit-profile-field-divider--bio-builder" aria-hidden />

      <label className="edit-profile-helper-label" htmlFor="edit-profile-bio-ai-draft">
        AI response
      </label>
      <textarea
        id="edit-profile-bio-ai-draft"
        className="edit-profile-helper-textarea"
        value={bioAiDraft}
        onChange={(e) => setBioAiDraft(e.target.value)}
        placeholder="Paste the GPT or Gemini bio response here..."
        rows={3}
      />
      <div className="edit-profile-bio-builder-actions">
        <span className="edit-profile-ai-draft-count">{compactBioText(bioAiDraft).length}/280</span>
        <button
          type="button"
          className="edit-profile-use-ai-draft"
          onClick={applyBioAiDraft}
          disabled={compactBioText(bioAiDraft).length === 0}
        >
          Use draft
        </button>
      </div>
    </div>
  )

  return (
    <motion.div
      className="edit-profile-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="edit-profile-screen-header">
        <button
          type="button"
          className="edit-profile-screen-back"
          onClick={closeEditProfile}
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="edit-profile-screen-title">Edit profile</span>
        <span className="edit-profile-screen-spacer" aria-hidden />
      </header>

      <form className="edit-profile-body" onSubmit={handleSubmit}>
        <div className="edit-profile-group">
          <h3 className="edit-profile-group-title">Photo</h3>
          <div className="edit-profile-group-card edit-profile-photo-card">
            <div className="edit-profile-avatar-wrap">
              <div className="edit-profile-avatar-inner">
                <img
                  src={avatarDisplayUrl}
                  alt=""
                  className="edit-profile-avatar"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    if (avatarUrl) persistAvatarToLocalCache(avatarUrl, e.currentTarget)
                  }}
                />
                <span className="edit-profile-avatar-gloss" aria-hidden />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              className="edit-profile-photo-input"
              aria-hidden
              tabIndex={-1}
              onChange={onPhotoSelected}
            />
            <button
              type="button"
              className="edit-profile-change-photo"
              onClick={openPhotoPicker}
              disabled={photoBusy}
              aria-busy={photoBusy}
              aria-describedby="edit-profile-photo-hint"
            >
              <Camera size={18} aria-hidden />
              <span>{photoBusy ? 'Uploading…' : 'Change photo'}</span>
            </button>
            <p id="edit-profile-photo-hint" className="edit-profile-photo-hint">
              JPEG, PNG, or WebP · max 2&nbsp;MB
            </p>
            {photoError ? (
              <p className="edit-profile-photo-error" role="alert">
                {photoError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="edit-profile-group">
          <h3 className="edit-profile-group-title">Public profile</h3>
          <div className="edit-profile-group-card edit-profile-fields">
            <label className="edit-profile-label" htmlFor="edit-profile-display-name">
              Display name
            </label>
            <input
              id="edit-profile-display-name"
              className="edit-profile-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              placeholder="Your name"
            />

            <div className="edit-profile-field-divider" aria-hidden />

            <label className="edit-profile-label" htmlFor="edit-profile-username">
              Username
            </label>
            <div className="edit-profile-username-stack">
              <div className="edit-profile-username-field">
                <span className="edit-profile-username-prefix" aria-hidden>
                  @
                </span>
                <input
                  id="edit-profile-username"
                  className="edit-profile-input edit-profile-input--username"
                  aria-describedby="edit-profile-username-hint"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={30}
                  placeholder="HANDLE"
                />
              </div>
              <button
                type="button"
                className="edit-profile-verify-username"
                onClick={onVerifyUsername}
                disabled={checkUsernameMu.isPending || !usernameChanged}
              >
                {checkUsernameMu.isPending ? 'Checking…' : 'Verify username'}
              </button>
            </div>
            <p className="edit-profile-username-hint" id="edit-profile-username-hint">
              {usernameChanged
                ? verifiedFor === normalizedNow
                  ? 'Verified — you can save.'
                  : 'New handle: 4–30 characters · verify before save.'
                : '4–30 characters. Change handle to verify before save.'}
            </p>
          </div>
        </div>

        <div className="edit-profile-group">
          <h3 className="edit-profile-group-title">About</h3>
          <div className="edit-profile-group-card edit-profile-fields">
            <div className="edit-profile-bio-tabs" role="tablist" aria-label="Bio editor mode">
              <button
                type="button"
                className={`edit-profile-bio-tab${activeBioTab === 'builder' ? ' is-active' : ''}`}
                data-active={activeBioTab === 'builder'}
                role="tab"
                aria-selected={activeBioTab === 'builder'}
                aria-controls="edit-profile-builder-panel"
                id="edit-profile-builder-tab"
                onClick={() => setActiveBioTab('builder')}
              >
                Builder
              </button>
              <button
                type="button"
                className={`edit-profile-bio-tab${activeBioTab === 'bio' ? ' is-active' : ''}`}
                data-active={activeBioTab === 'bio'}
                role="tab"
                aria-selected={activeBioTab === 'bio'}
                aria-controls="edit-profile-bio-panel"
                id="edit-profile-bio-tab"
                onClick={() => setActiveBioTab('bio')}
              >
                Bio
              </button>
            </div>

            {activeBioTab === 'bio' ? (
              <div
                id="edit-profile-bio-panel"
                className="edit-profile-bio-panel"
                role="tabpanel"
                aria-labelledby="edit-profile-bio-tab"
              >
                {bioField}
              </div>
            ) : (
              <div
                id="edit-profile-builder-panel"
                className="edit-profile-bio-panel"
                role="tabpanel"
                aria-labelledby="edit-profile-builder-tab"
              >
                {bioBuilder}
              </div>
            )}
          </div>
        </div>

        <div className="edit-profile-footer">
          <button
            type="submit"
            className="edit-profile-save"
            disabled={updateProfileMu.isPending}
          >
            {updateProfileMu.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {pendingCropFile ? (
          <AvatarCropModal
            key={`${pendingCropFile.name}-${pendingCropFile.size}-${pendingCropFile.lastModified}`}
            file={pendingCropFile}
            onCancel={() => setPendingCropFile(null)}
            onConfirm={onCropConfirm}
          />
        ) : null}
      </AnimatePresence>

      <UploadToast toast={uploadToast} onDismiss={dismissUploadToast} />
    </motion.div>
  )
}
