import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { googleOAuthRedirectUrl, googleOAuthRedirectUrlNoPrompt } from '../../lib/auth-api'
import { getLastUsedAccount } from '../../lib/last-used-account'
import { useAppState } from '../../store/appStore'

function GoogleMark() {
  return (
    <span className="welcome-signin-google-mark" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    </span>
  )
}

function AvatarInitial({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [imgFailed, setImgFailed] = useState(false)
  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="welcome-signin-last-avatar"
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <span className="welcome-signin-last-avatar welcome-signin-last-avatar--initial">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function SignInSheet() {
  const { closeSignIn, signInPromptMessage, signInRedirectError } = useAppState()
  const [busy, setBusy] = useState<'idle' | 'last' | 'google'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const lastAccount = getLastUsedAccount()
  const emailRedirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`

  const signInWithLastAccount = () => {
    setBusy('last')
    setErrorMessage('')
    try {
      // Skip the account chooser — pass login_hint so Google auto-selects the right account
      window.location.href = googleOAuthRedirectUrlNoPrompt(emailRedirectTo, lastAccount?.email)
    } catch (e) {
      setBusy('idle')
      setErrorMessage(e instanceof Error ? e.message : 'Could not start Google sign-in')
    }
  }

  const signInWithGoogle = () => {
    setBusy('google')
    setErrorMessage('')
    try {
      window.location.href = googleOAuthRedirectUrl(emailRedirectTo)
    } catch (e) {
      setBusy('idle')
      setErrorMessage(e instanceof Error ? e.message : 'Could not start Google sign-in')
    }
  }

  return (
    <motion.div
      className="welcome-signin-sheet"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="welcome-signin-header">
        <button
          type="button"
          className="welcome-signin-back"
          onClick={() => closeSignIn()}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="welcome-signin-title">Sign in to Buzo</span>
        <span className="welcome-signin-spacer" aria-hidden />
      </header>

      <div className="welcome-signin-body">
        <p className="welcome-signin-lead">
          Save plans, sync taste, and see what your crew is doing — one account across the app.
        </p>

        {signInPromptMessage ? (
          <p className="welcome-signin-note" role="status">
            {signInPromptMessage}
          </p>
        ) : null}

        {signInRedirectError ? (
          <p className="welcome-signin-error" role="alert">
            {signInRedirectError}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="welcome-signin-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {/* Quick sign-in with last used account */}
        {lastAccount ? (
          <>
            <button
              type="button"
              className="welcome-signin-last"
              disabled={busy !== 'idle'}
              onClick={signInWithLastAccount}
            >
              <AvatarInitial name={lastAccount.displayName} avatarUrl={lastAccount.avatarUrl} />
              <span className="welcome-signin-last-info">
                <span className="welcome-signin-last-label">Continue as</span>
                <span className="welcome-signin-last-name">{lastAccount.displayName}</span>
                <span className="welcome-signin-last-email">{lastAccount.email}</span>
              </span>
              {busy === 'last' ? (
                <span className="welcome-signin-last-spinner" aria-hidden />
              ) : null}
            </button>

            <div className="welcome-signin-divider">
              <span className="welcome-signin-divider__line" aria-hidden />
              <span className="welcome-signin-divider__text">or</span>
              <span className="welcome-signin-divider__line" aria-hidden />
            </div>
          </>
        ) : null}

        <button
          type="button"
          className="welcome-signin-google"
          disabled={busy !== 'idle'}
          onClick={signInWithGoogle}
        >
          <GoogleMark />
          <span>
            {busy === 'google'
              ? 'Redirecting…'
              : lastAccount
                ? 'Use a different account'
                : 'Continue with Google'}
          </span>
          {lastAccount ? <ChevronDown size={15} aria-hidden /> : null}
        </button>
      </div>
    </motion.div>
  )
}
