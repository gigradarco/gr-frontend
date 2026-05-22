import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { ensureAccessTokenFresh } from '../../lib/auth-api'
import { apiBase } from '../../lib/api-base'
import { getAccessToken } from '../../lib/session'
import { useAppState } from '../../store/appStore'

type AdminAccessStatus = 'checking' | 'authorized' | 'denied' | 'signed-out' | 'error'
type AdminAccessStep = 'session' | 'token' | 'allowlist'

export function AdminRouteGuard() {
  const navigate = useNavigate()
  const authSessionHydrated = useAppState((state) => state.authSessionHydrated)
  const isAuthenticated = useAppState((state) => state.isAuthenticated)
  const [status, setStatus] = useState<AdminAccessStatus>('checking')
  const [step, setStep] = useState<AdminAccessStep>('session')
  const [error, setError] = useState<string | null>(null)

  const verifyAdminAccess = useCallback(async () => {
    setError(null)
    setStep('session')

    if (!authSessionHydrated) {
      setStatus('checking')
      return
    }

    if (!isAuthenticated) {
      setStatus('signed-out')
      navigate('/not-found-404', { replace: true })
      return
    }

    setStatus('checking')
    setStep('token')
    const fresh = await ensureAccessTokenFresh()
    const token = fresh ? getAccessToken() : null
    if (!token) {
      setStatus('signed-out')
      navigate('/not-found-404', { replace: true })
      return
    }

    try {
      setStep('allowlist')
      const res = await fetch(`${apiBase()}/api/admin/events?limit=1`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        setStatus('authorized')
        return
      }

      if (res.status === 401 || res.status === 403) {
        setStatus(res.status === 403 ? 'denied' : 'signed-out')
        navigate('/not-found-404', { replace: true })
        return
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      setStatus('error')
      setError(body.error ?? body.message ?? `Admin access check failed with HTTP ${res.status}`)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Admin access check failed')
    }
  }, [authSessionHydrated, isAuthenticated, navigate])

  useEffect(() => {
    void verifyAdminAccess()
  }, [verifyAdminAccess])

  if (status === 'authorized') {
    return <Outlet />
  }

  if (status === 'denied' || status === 'signed-out') {
    return <Navigate to="/not-found-404" replace />
  }

  return (
    <main className="admin-home admin-home--loading">
      <section className="admin-access-loader" aria-live="polite" aria-busy={status !== 'error'}>
        <div className="admin-access-loader-panel">
          <div className="admin-access-loader-copy">
            <span className="admin-access-loader-shield" aria-hidden>
              <ShieldCheck size={28} strokeWidth={2.2} />
            </span>
            <p className="admin-access-loader-kicker">
              {status === 'error' ? 'Access check failed' : 'Admin workspace'}
            </p>
            <h1>{status === 'error' && error ? error : 'Verifying admin access'}</h1>
            {status !== 'error' ? (
              <div className="admin-access-loader-progress" aria-hidden>
                <span className={`admin-access-loader-progress-fill is-${step}`} />
              </div>
            ) : null}
            <div className="admin-access-loader-steps" aria-label="Admin access verification steps">
              <span className={step === 'session' ? 'is-active' : 'is-complete'}>Session</span>
              <span className={step === 'token' || step === 'allowlist' ? (step === 'token' ? 'is-active' : 'is-complete') : ''}>Token</span>
              <span className={step === 'allowlist' ? 'is-active' : ''}>Allowlist</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
