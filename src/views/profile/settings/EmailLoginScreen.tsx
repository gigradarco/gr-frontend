import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { DEMO_EMAIL_LOGIN } from '../../../config/profileSettings'
import { useAppState } from '../../../store/appStore'

type EmailLoginTab = 'google' | 'email'

function GoogleMark() {
  return (
    <span className="email-login-google-mark" aria-hidden>
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

export function EmailLoginScreen() {
  const { closeEmailLogin } = useAppState()
  const [activeTab, setActiveTab] = useState<EmailLoginTab>('google')
  const [googleLinked, setGoogleLinked] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const connectGoogle = () => {
    window.alert(
      'Demo: start Google OAuth here (e.g. redirect or popup), then set googleLinked from your backend.',
    )
    setGoogleLinked(true)
  }

  const disconnectGoogle = () => {
    if (
      !window.confirm(
        'Disconnect Google? You can still sign in with your email and password if you have one set.',
      )
    ) {
      return
    }
    window.alert('Demo: revoke Google link in your auth provider, then set googleLinked to false.')
    setGoogleLinked(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!currentPassword.trim()) {
      window.alert('Enter your current password to save changes.')
      return
    }
  const emailChanging = newEmail.trim() !== '' && newEmail.trim().toLowerCase() !== DEMO_EMAIL_LOGIN.currentEmail
    const passwordChanging = newPassword.trim() !== '' || confirmPassword.trim() !== ''
    if (passwordChanging && newPassword !== confirmPassword) {
      window.alert('New password and confirmation do not match.')
      return
    }
    if (!emailChanging && !passwordChanging) {
      window.alert('Update your email or password, or go back.')
      return
    }
    closeEmailLogin()
    window.alert('Changes saved. (Demo — connect to your auth API.)')
    setNewEmail('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <motion.div
      className="email-login-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="email-login-screen-header">
        <button
          type="button"
          className="email-login-screen-back"
          onClick={closeEmailLogin}
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="email-login-screen-title">Change Email & Login</span>
        <span className="email-login-screen-spacer" aria-hidden />
      </header>

      <div className="email-login-body">
        <div
          className="email-login-tablist"
          role="tablist"
          aria-label="Login settings sections"
        >
          <button
            type="button"
            id="email-login-tab-google"
            role="tab"
            aria-selected={activeTab === 'google'}
            aria-controls="email-login-panel-google"
            tabIndex={activeTab === 'google' ? 0 : -1}
            className={`email-login-tab${activeTab === 'google' ? ' email-login-tab--active' : ''}`}
            onClick={() => setActiveTab('google')}
          >
            <GoogleMark />
            <span>Google</span>
          </button>
          <button
            type="button"
            id="email-login-tab-email"
            role="tab"
            aria-selected={activeTab === 'email'}
            aria-controls="email-login-panel-email"
            tabIndex={activeTab === 'email' ? 0 : -1}
            className={`email-login-tab${activeTab === 'email' ? ' email-login-tab--active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            <Mail size={18} strokeWidth={2} aria-hidden />
            <span>Email & password</span>
          </button>
        </div>

        <div
          id="email-login-panel-google"
          role="tabpanel"
          aria-labelledby="email-login-tab-google"
          className="email-login-tab-panel"
          hidden={activeTab !== 'google'}
        >
          <p className="email-login-tab-hint">
            Link Google for one-tap sign in. You can disconnect anytime.
          </p>

          <section className="email-login-google-panel email-login-google-panel--tabbed" aria-label="Google account">
            <div className="email-login-google-panel-top">
              {googleLinked ? (
                <span className="email-login-google-pill">
                  <CheckCircle2 size={13} strokeWidth={2.5} aria-hidden />
                  Linked
                </span>
              ) : (
                <span className="email-login-google-panel-badge">Not linked</span>
              )}
            </div>

            {googleLinked ? (
              <>
                <p className="email-login-google-email-display">{DEMO_EMAIL_LOGIN.googleEmail}</p>
                <p className="email-login-google-note">
                  You can still sign in with your Buzo email and password when needed.
                </p>
                <button type="button" className="email-login-google-disconnect" onClick={disconnectGoogle}>
                  Disconnect Google
                </button>
              </>
            ) : (
              <>
                <p className="email-login-google-note">
                  Use your Google account — optional, and easy to remove later.
                </p>
                <button type="button" className="email-login-google-connect" onClick={connectGoogle}>
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>
              </>
            )}
          </section>
        </div>

        <div
          id="email-login-panel-email"
          role="tabpanel"
          aria-labelledby="email-login-tab-email"
          className="email-login-tab-panel"
          hidden={activeTab !== 'email'}
        >
          <p className="email-login-tab-hint">
            Update your Buzo email or password. We’ll verify with your current password.
          </p>

          <section className="email-login-credentials email-login-credentials--tabbed">
            <form className="email-login-form" onSubmit={handleSubmit}>
              <div className="email-login-identity">
                <span className="email-login-identity-icon" aria-hidden>
                  <Mail size={18} strokeWidth={2} />
                </span>
                <div className="email-login-identity-body">
                  <span className="email-login-identity-label">Signed in as</span>
                  <span className="email-login-identity-email">{DEMO_EMAIL_LOGIN.currentEmail}</span>
                  {googleLinked && (
                    <span className="email-login-identity-meta">
                      May differ from your Google address
                    </span>
                  )}
                </div>
              </div>

              <label className="email-login-label" htmlFor="email-login-new-email">
                New email
              </label>
              <input
                id="email-login-new-email"
                className="email-login-input"
                type="email"
                inputMode="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Leave blank to keep current"
                autoComplete="email"
              />

              <label className="email-login-label" htmlFor="email-login-current-password">
                Current password
              </label>
              <input
                id="email-login-current-password"
                className="email-login-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required to save changes"
                autoComplete="current-password"
              />

              <div className="email-login-divider" aria-hidden />

              <div className="email-login-password-section">
                <p className="email-login-subblock-title">Update password</p>
                <p className="email-login-subblock-hint">
                  Optional — leave both fields empty to keep your current password.
                </p>
              </div>

              <label className="email-login-label" htmlFor="email-login-new-password">
                New password
              </label>
              <input
                id="email-login-new-password"
                className="email-login-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />

              <label className="email-login-label" htmlFor="email-login-confirm-password">
                Confirm new password
              </label>
              <input
                id="email-login-confirm-password"
                className="email-login-input email-login-input--last"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Match new password"
                autoComplete="new-password"
              />

              <button type="submit" className="email-login-submit">
                Save changes
              </button>
            </form>
          </section>
        </div>
      </div>
    </motion.div>
  )
}
