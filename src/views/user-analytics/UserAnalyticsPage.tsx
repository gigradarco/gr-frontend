import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Search, TrendingUp, Users } from 'lucide-react'
import { ensureAccessTokenFresh } from '../../lib/auth-api'
import { apiBase } from '../../lib/api-base'
import { getAccessToken } from '../../lib/session'
import './user-analytics.css'

type TierFilter = 'all' | 'free' | 'paid'

type Analytics = {
  total: number
  free: number
  paid: number
  conversion_rate: number
  stripe_customers: number
  anonymous: number
  missing_email: number
  recent_signups_30d: number
  active_7d: number
  active_30d: number
  dormant_30d: number
  default_city_set: number
  taste_set: number
  activated: number
  activation_rate: number
  mrr_estimate_sgd: number
}

type AnalyticsUser = {
  user_id: string
  email: string | null
  display_name: string
  username: string
  avatar_url: string
  subscription_tier: string
  is_paid: boolean
  stripe_customer_id: string | null
  default_city_id: string | null
  has_taste_selections: boolean
  is_activated: boolean
  is_anonymous: boolean
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
}

type UserAnalyticsResponse = {
  analytics: Analytics
  pagination: {
    page: number
    limit: number
    total: number
    filtered_total: number
    total_pages: number
  }
  users: AnalyticsUser[]
}

const EMPTY_ANALYTICS: Analytics = {
  total: 0,
  free: 0,
  paid: 0,
  conversion_rate: 0,
  stripe_customers: 0,
  anonymous: 0,
  missing_email: 0,
  recent_signups_30d: 0,
  active_7d: 0,
  active_30d: 0,
  dormant_30d: 0,
  default_city_set: 0,
  taste_set: 0,
  activated: 0,
  activation_rate: 0,
  mrr_estimate_sgd: 0,
}

const DEFAULT_PAGINATION: UserAnalyticsResponse['pagination'] = {
  page: 1,
  limit: 50,
  total: 0,
  filtered_total: 0,
  total_pages: 1,
}

async function adminFetch<T>(path: string): Promise<T> {
  const fresh = await ensureAccessTokenFresh()
  const token = fresh ? getAccessToken() : null
  if (!token) throw new Error('Not signed in')
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function userLabel(user: AnalyticsUser): string {
  return user.display_name || user.username || user.email || user.user_id
}

export function UserAnalyticsPage() {
  const [tier, setTier] = useState<TierFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [analytics, setAnalytics] = useState<Analytics>(EMPTY_ANALYTICS)
  const [pagination, setPagination] = useState<UserAnalyticsResponse['pagination']>(DEFAULT_PAGINATION)
  const [users, setUsers] = useState<AnalyticsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const requestPath = useMemo(() => {
    const params = new URLSearchParams({ tier, page: String(page), limit: String(limit) })
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim())
    return `/api/admin/user-analytics?${params.toString()}`
  }, [appliedSearch, limit, page, tier])

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetch<UserAnalyticsResponse>(requestPath)
      setAnalytics(data.analytics)
      setPagination(data.pagination)
      setUsers(data.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user analytics')
    } finally {
      setLoading(false)
    }
  }, [requestPath])

  useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  const metricCards = [
    { label: 'Total users', value: analytics.total.toLocaleString(), detail: 'Profiles created' },
    { label: 'Paid users', value: analytics.paid.toLocaleString(), detail: `${formatPercent(analytics.conversion_rate)} conversion` },
    { label: 'Free users', value: analytics.free.toLocaleString(), detail: 'Not on a paid tier' },
    { label: 'MRR estimate', value: formatMoney(analytics.mrr_estimate_sgd), detail: 'From active paid tiers' },
    { label: 'Activated', value: analytics.activated.toLocaleString(), detail: `${formatPercent(analytics.activation_rate)} activation` },
    { label: 'Active 7d', value: analytics.active_7d.toLocaleString(), detail: 'Recent retention pulse' },
    { label: 'Active 30d', value: analytics.active_30d.toLocaleString(), detail: 'Signed in recently' },
    { label: 'Dormant 30d', value: analytics.dormant_30d.toLocaleString(), detail: 'No recent sign-in' },
    { label: 'New 30d', value: analytics.recent_signups_30d.toLocaleString(), detail: 'Recent signups' },
    { label: 'Stripe customers', value: analytics.stripe_customers.toLocaleString(), detail: 'Checkout-linked users' },
    { label: 'Taste selected', value: analytics.taste_set.toLocaleString(), detail: 'Taste onboarding done' },
    { label: 'Default city', value: analytics.default_city_set.toLocaleString(), detail: 'Location set' },
    { label: 'Missing email', value: analytics.missing_email.toLocaleString(), detail: 'Anonymous or incomplete' },
  ]

  return (
    <main className="user-analytics-page">
      <section className="user-analytics-shell" aria-labelledby="user-analytics-title">
        <header className="user-analytics-header">
          <Link to="/admin" className="user-analytics-back" aria-label="Back to admin">
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <div>
            <p className="user-analytics-kicker">
              <TrendingUp size={15} aria-hidden />
              User analytics
            </p>
            <h1 id="user-analytics-title">User Analytics</h1>
            <p className="user-analytics-copy">
              Track free vs paid users, conversion, recent activity, and account quality.
            </p>
          </div>
          <button
            type="button"
            className="user-analytics-icon-btn"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            aria-label="Refresh user analytics"
          >
            <RefreshCw size={17} aria-hidden />
          </button>
        </header>

        <section className="user-analytics-controls" aria-label="User analytics filters">
          <div className="user-analytics-segmented" role="group" aria-label="Tier filter">
            {(['all', 'free', 'paid'] as TierFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                className={tier === option ? 'is-active' : ''}
                onClick={() => {
                  setTier(option)
                  setPage(1)
                }}
              >
                {option === 'all' ? 'All' : option === 'free' ? 'Free' : 'Paid'}
              </button>
            ))}
          </div>
          <div className="user-analytics-search">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPage(1)
                  setAppliedSearch(searchInput)
                }
              }}
              placeholder="Search email, username, user id"
            />
            <button
              type="button"
              onClick={() => {
                setPage(1)
                setAppliedSearch(searchInput)
              }}
            >
              <Search size={16} aria-hidden />
              Search
            </button>
          </div>
        </section>

        {error ? <div className="user-analytics-alert" role="alert">{error}</div> : null}

        <section className="user-analytics-metrics" aria-label="User metrics">
          {metricCards.map((card) => (
            <article key={card.label} className="user-analytics-metric">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="user-analytics-card" aria-labelledby="user-list-title">
          <div className="user-analytics-card-head">
            <div>
              <h2 id="user-list-title">Users</h2>
              <p>
                {loading
                  ? 'Loading...'
                  : `${users.length} shown · ${pagination.filtered_total} filtered · ${pagination.total} total`}
              </p>
            </div>
            <Users size={18} aria-hidden />
          </div>
          <div className="user-analytics-pagination">
            <label>
              Rows
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value))
                  setPage(1)
                }}
              >
                {[25, 50, 100, 250].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <div className="user-analytics-page-controls">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || pagination.page <= 1}
              >
                Prev
              </button>
              <span>
                Page {pagination.page} / {pagination.total_pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
                disabled={loading || pagination.page >= pagination.total_pages}
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <p className="user-analytics-muted">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="user-analytics-muted">No users match this filter.</p>
          ) : (
            <div className="user-analytics-table-wrap">
              <table className="user-analytics-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Tier</th>
                    <th>Stripe</th>
                    <th>Joined</th>
                    <th>Last sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      <td>
                        <strong>{userLabel(user)}</strong>
                        <span>{user.email ?? (user.is_anonymous ? 'Anonymous user' : 'No email')}</span>
                        <code>{user.user_id}</code>
                      </td>
                      <td>
                        <span className={`user-analytics-pill${user.is_paid ? ' is-paid' : ''}`}>
                          {user.subscription_tier}
                        </span>
                      </td>
                      <td>{user.stripe_customer_id ? 'Linked' : '-'}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>{formatDate(user.last_sign_in_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
