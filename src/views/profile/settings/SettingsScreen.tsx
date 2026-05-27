import type { ComponentType, ReactNode } from 'react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Globe,
  Megaphone,
  MessageSquare,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  User,
} from 'lucide-react'
import { APP_RELEASE_LABEL } from '../../../config/profileSettings'
import { getLocationCityById } from '../../../data/locationRegions'
import { postDeleteAccount } from '../../../lib/auth-api'
import { clearLastUsedAccount } from '../../../lib/last-used-account'
import { useAppState } from '../../../store/appStore'

type RowIcon = ComponentType<{ size?: number; className?: string }>

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <h3 className="settings-group-title">{title}</h3>
      <div className="settings-group-card">{children}</div>
    </div>
  )
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  destructive,
}: {
  icon: RowIcon
  label: string
  value?: string
  onClick?: () => void
  destructive?: boolean
}) {
  const showChevron = onClick != null
  const content = (
    <>
      <span className="settings-row-icon" aria-hidden>
        <Icon size={18} />
      </span>
      <span className="settings-row-label">{label}</span>
      {value != null && <span className="settings-row-value">{value}</span>}
      {showChevron && <ChevronRight size={16} className="settings-row-chevron" aria-hidden />}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`settings-row${destructive ? ' settings-row--destructive' : ''}`}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return <div className="settings-row settings-row--static">{content}</div>
}

type DeleteModalState = 'idle' | 'confirm' | 'deleting' | 'success' | 'error'

function DeleteAccountModal({
  state,
  errorMsg,
  onConfirm,
  onCancel,
}: {
  state: DeleteModalState
  errorMsg: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (state === 'idle') return null
  return (
    <motion.div
      className="delete-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={state === 'deleting' ? undefined : onCancel}
    >
      <motion.div
        className="delete-modal"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        {state === 'success' ? (
          <>
            <span className="delete-modal-icon delete-modal-icon--success" aria-hidden>
              <CheckCircle2 size={36} />
            </span>
            <h2 className="delete-modal-title">Account deleted</h2>
            <p className="delete-modal-body">
              Your account and personal data have been permanently removed. We're sorry to see you go.
            </p>
            <button type="button" className="delete-modal-btn delete-modal-btn--primary" onClick={onCancel}>
              Done
            </button>
          </>
        ) : (
          <>
            <span className="delete-modal-icon delete-modal-icon--warn" aria-hidden>
              <AlertTriangle size={36} />
            </span>
            <h2 className="delete-modal-title">Delete account?</h2>
            <p className="delete-modal-body">
              Your profile, activity, and saved plans will be <strong>permanently deleted</strong>. This cannot be undone.
            </p>
            {errorMsg ? (
              <p className="delete-modal-error" role="alert">{errorMsg}</p>
            ) : null}
            <div className="delete-modal-actions">
              <button
                type="button"
                className="delete-modal-btn delete-modal-btn--ghost"
                onClick={onCancel}
                disabled={state === 'deleting'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-modal-btn delete-modal-btn--danger"
                onClick={onConfirm}
                disabled={state === 'deleting'}
              >
                {state === 'deleting' ? (
                  <span className="delete-modal-spinner" aria-hidden />
                ) : null}
                {state === 'deleting' ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export function SettingsScreen() {
  const [deleteState, setDeleteState] = useState<DeleteModalState>('idle')
  const [deleteError, setDeleteError] = useState('')

  const {
    closeSettings,
    openLanguage,
    openPrivacySafety,
    openReleaseNotes,
    openFeedback,
    openEditProfile,
    openSubscription,
    openOnboarding,
    returnToLanding,
    feedLocationCityId,
    isAuthenticated,
    profileDefaultCityId,
    theme,
    setTheme,
  } = useAppState()
  const hasDefaultCity = !isAuthenticated || profileDefaultCityId != null
  const cityName = hasDefaultCity ? (getLocationCityById(feedLocationCityId)?.name ?? 'Singapore') : 'Not set'

  const handleDeleteAccount = () => {
    setDeleteError('')
    setDeleteState('confirm')
  }

  const confirmDelete = () => {
    setDeleteState('deleting')
    void (async () => {
      try {
        await postDeleteAccount()
        setDeleteState('success')
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Could not delete account. Try again.')
        setDeleteState('error')
      }
    })()
  }

  const dismissDeleteModal = () => {
    if (deleteState === 'success') {
      setDeleteState('idle')
      clearLastUsedAccount()
      closeSettings()
      returnToLanding()
      window.location.reload()
    } else {
      setDeleteState('idle')
      setDeleteError('')
    }
  }

  return (
    <motion.div
      className="settings-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="settings-screen-header">
        <button
          type="button"
          className="settings-screen-back"
          onClick={closeSettings}
          aria-label="Back to profile"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="settings-screen-title">Settings</span>
        <span className="settings-screen-spacer" aria-hidden />
      </header>

      <div className="settings-scroll">
        <SettingsGroup title="Buzo Pro">
          <SettingsRow icon={CreditCard} label="Manage subscription" onClick={openSubscription} />
        </SettingsGroup>

        <SettingsGroup title="Preferences">
          <SettingsRow
            icon={Sparkles}
            label="Update City & Category"
            value={cityName}
            onClick={() => openOnboarding('settings')}
          />
          <SettingsRow
            icon={theme === 'dark' ? Moon : Sun}
            label="Appearance"
            value={theme === 'dark' ? 'Dark' : 'Light'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
          <SettingsRow icon={Globe} label="Language" value="English" onClick={openLanguage} />
        </SettingsGroup>

        <SettingsGroup title="Support">
          <SettingsRow icon={Shield} label="Privacy & safety" onClick={openPrivacySafety} />
          <SettingsRow icon={MessageSquare} label="Send feedback" onClick={openFeedback} />
        </SettingsGroup>

        <SettingsGroup title="About">
          <SettingsRow
            icon={Megaphone}
            label="What's new"
            value={APP_RELEASE_LABEL}
            onClick={openReleaseNotes}
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingsRow icon={User} label="Edit profile" onClick={openEditProfile} />
          <SettingsRow
            icon={Trash2}
            label="Delete account"
            destructive
            onClick={handleDeleteAccount}
          />
        </SettingsGroup>
      </div>

      <AnimatePresence>
        {deleteState !== 'idle' ? (
          <DeleteAccountModal
            state={deleteState}
            errorMsg={deleteError}
            onConfirm={confirmDelete}
            onCancel={dismissDeleteModal}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
