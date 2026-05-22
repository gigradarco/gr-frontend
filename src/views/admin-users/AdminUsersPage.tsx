import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { ensureAccessTokenFresh } from '../../lib/auth-api'
import { apiBase } from '../../lib/api-base'
import { getAccessToken } from '../../lib/session'
import './admin-users.css'

type AdminUser = {
  user_id: string
  email: string | null
  display_name?: string | null
  username?: string | null
  avatar_url?: string | null
  is_enabled: boolean
  created_at: string | null
  updated_at: string | null
}

type SearchResult = {
  user_id: string
  email: string | null
  is_admin: boolean
  is_enabled: boolean
  created_at: string | null
  updated_at: string | null
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const fresh = await ensureAccessTokenFresh()
  const token = fresh ? getAccessToken() : null
  if (!token) throw new Error('Not signed in')

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function adminDisplayName(admin: AdminUser): string {
  return admin.display_name || admin.username || admin.email || admin.user_id
}

export function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const enabledCount = useMemo(
    () => admins.filter((admin) => admin.is_enabled).length,
    [admins],
  )

  const loadAdmins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAdmins(await adminFetch<AdminUser[]>('/api/admin/admin-users'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAdmins()
  }, [loadAdmins])

  const searchUser = useCallback(async () => {
    const email = searchEmail.trim()
    if (!email) {
      setError('Enter an email to search.')
      return
    }
    setSearching(true)
    setError(null)
    setNotice(null)
    setSearchResult(null)
    try {
      const result = await adminFetch<{ user: SearchResult | null }>(
        `/api/admin/admin-users/search?email=${encodeURIComponent(email)}`,
      )
      if (!result.user) {
        setNotice('No user found for that email.')
        return
      }
      setSearchResult(result.user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search user')
    } finally {
      setSearching(false)
    }
  }, [searchEmail])

  const promoteUser = useCallback(
    async (user: SearchResult) => {
      setMutatingUserId(user.user_id)
      setError(null)
      setNotice(null)
      try {
        await adminFetch<AdminUser>('/api/admin/admin-users', {
          method: 'POST',
          body: JSON.stringify({ userId: user.user_id }),
        })
        setNotice(`${user.email ?? user.user_id} is now an admin.`)
        setSearchResult((current) =>
          current?.user_id === user.user_id
            ? { ...current, is_admin: true, is_enabled: true }
            : current,
        )
        await loadAdmins()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add admin')
      } finally {
        setMutatingUserId(null)
      }
    },
    [loadAdmins],
  )

  const setAdminEnabled = useCallback(
    async (admin: AdminUser, isEnabled: boolean) => {
      setMutatingUserId(admin.user_id)
      setError(null)
      setNotice(null)
      try {
        await adminFetch<AdminUser>(`/api/admin/admin-users/${admin.user_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isEnabled }),
        })
        setNotice(`${admin.email ?? admin.user_id} ${isEnabled ? 'enabled' : 'disabled'}.`)
        await loadAdmins()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update admin')
      } finally {
        setMutatingUserId(null)
      }
    },
    [loadAdmins],
  )

  const deleteAdmin = useCallback(
    async (admin: AdminUser) => {
      const label = admin.email ?? admin.user_id
      if (!window.confirm(`Remove admin access for ${label}?`)) return
      setMutatingUserId(admin.user_id)
      setError(null)
      setNotice(null)
      try {
        await adminFetch<{ ok: true }>(`/api/admin/admin-users/${admin.user_id}`, {
          method: 'DELETE',
        })
        setNotice(`${label} removed from admins.`)
        await loadAdmins()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete admin')
      } finally {
        setMutatingUserId(null)
      }
    },
    [loadAdmins],
  )

  return (
    <main className="admin-users-page">
      <section className="admin-users-shell" aria-labelledby="admin-users-title">
        <header className="admin-users-header">
          <Link to="/admin" className="admin-users-back" aria-label="Back to admin">
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <div>
            <p className="admin-users-kicker">
              <ShieldCheck size={15} aria-hidden />
              Admin access
            </p>
            <h1 id="admin-users-title">Admin Users</h1>
            <p className="admin-users-copy">
              Promote existing users, disable access, or remove admin entries.
            </p>
          </div>
          <button
            type="button"
            className="admin-users-icon-btn"
            onClick={() => void loadAdmins()}
            disabled={loading}
            aria-label="Refresh admin users"
          >
            <RefreshCw size={17} aria-hidden />
          </button>
        </header>

        <section className="admin-users-card" aria-labelledby="admin-user-search-title">
          <h2 id="admin-user-search-title">Find user by email</h2>
          <div className="admin-users-search-row">
            <input
              className="admin-users-input"
              type="email"
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchUser()
              }}
              placeholder="name@example.com"
            />
            <button
              type="button"
              className="admin-users-btn"
              onClick={() => void searchUser()}
              disabled={searching}
            >
              <Search size={16} aria-hidden />
              Search
            </button>
          </div>

          {searchResult ? (
            <div className="admin-users-result">
              <div>
                <strong>{searchResult.email ?? searchResult.user_id}</strong>
                <code>{searchResult.user_id}</code>
              </div>
              <span className={`admin-users-pill${searchResult.is_enabled ? ' is-enabled' : ''}`}>
                {searchResult.is_admin
                  ? searchResult.is_enabled
                    ? 'Admin enabled'
                    : 'Admin disabled'
                  : 'Not admin'}
              </span>
              <button
                type="button"
                className="admin-users-btn"
                onClick={() => void promoteUser(searchResult)}
                disabled={mutatingUserId === searchResult.user_id || searchResult.is_enabled}
              >
                Make admin
              </button>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="admin-users-alert" role="alert">
            <AlertCircle size={16} aria-hidden />
            {error}
          </div>
        ) : null}
        {notice ? <div className="admin-users-notice">{notice}</div> : null}

        <section className="admin-users-card" aria-labelledby="current-admins-title">
          <div className="admin-users-card-head">
            <div>
              <h2 id="current-admins-title">Current admins</h2>
              <p>
                {enabledCount} enabled / {admins.length} total
              </p>
            </div>
          </div>

          {loading ? (
            <p className="admin-users-muted">Loading admins...</p>
          ) : admins.length === 0 ? (
            <p className="admin-users-muted">No admin users found.</p>
          ) : (
            <div className="admin-users-list">
              {admins.map((admin) => (
                <article key={admin.user_id} className="admin-users-row">
                  <div className="admin-users-row-main">
                    <strong>{adminDisplayName(admin)}</strong>
                    <span>{admin.email ?? 'No email'}</span>
                    <code>{admin.user_id}</code>
                  </div>
                  <div className="admin-users-row-meta">
                    <span className={`admin-users-pill${admin.is_enabled ? ' is-enabled' : ''}`}>
                      {admin.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span>Added {formatDate(admin.created_at)}</span>
                  </div>
                  <div className="admin-users-actions">
                    <button
                      type="button"
                      className="admin-users-btn ghost"
                      onClick={() => void setAdminEnabled(admin, !admin.is_enabled)}
                      disabled={mutatingUserId === admin.user_id}
                    >
                      {admin.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className="admin-users-icon-btn danger"
                      onClick={() => void deleteAdmin(admin)}
                      disabled={mutatingUserId === admin.user_id}
                      aria-label={`Delete admin ${admin.email ?? admin.user_id}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
