import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { ensureAccessTokenFresh } from '../../lib/auth-api'
import { apiBase } from '../../lib/api-base'
import { getAccessToken } from '../../lib/session'
import { useAppState } from '../../store/appStore'
import './admin-home.css'

type AdminAccessStatus = 'checking' | 'authorized' | 'denied' | 'signed-out' | 'error'

function AdminAccessLoader({ error }: { error?: string | null }) {
  return (
    <main className="admin-home admin-home--loading">
      <section className="admin-access-loader" aria-live="polite" aria-busy={!error}>
        <div className="admin-access-loader-panel">
          <span className="admin-access-loader-shield" aria-hidden>
            <ShieldCheck size={28} strokeWidth={2.2} />
          </span>
          <p className="admin-access-loader-kicker">
            {error ? 'Access check failed' : 'Admin workspace'}
          </p>
          <h1>{error ? 'Could not open admin' : 'Checking admin access'}</h1>
          {error ? (
            <p className="admin-access-loader-sub">{error}</p>
          ) : (
            <>
              <p className="admin-access-loader-sub">Verifying your session and admin permissions.</p>
              <div className="admin-access-loader-spinner" aria-hidden />
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export function AdminRouteGuard() {
  const navigate = useNavigate()
  const authSessionHydrated = useAppState((state) => state.authSessionHydrated)
  const isAuthenticated = useAppState((state) => state.isAuthenticated)
  const [status, setStatus] = useState<AdminAccessStatus>('checking')
  const [error, setError] = useState<string | null>(null)

  const verifyAdminAccess = useCallback(async () => {
    setError(null)

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
    const fresh = await ensureAccessTokenFresh()
    const token = fresh ? getAccessToken() : null
    if (!token) {
      setStatus('signed-out')
      navigate('/not-found-404', { replace: true })
      return
    }

    try {
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
    if (status === 'authorized' && authSessionHydrated && isAuthenticated) return
    void verifyAdminAccess()
  }, [authSessionHydrated, isAuthenticated, status, verifyAdminAccess])

  if (status === 'authorized') {
    return <Outlet />
  }

  if (status === 'denied' || status === 'signed-out') {
    return <Navigate to="/not-found-404" replace />
  }

  return <AdminAccessLoader error={status === 'error' ? error : null} />
}
