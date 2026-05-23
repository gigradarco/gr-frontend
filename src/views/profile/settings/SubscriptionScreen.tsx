import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronRight, Download, Minus, Sparkles, Ticket } from 'lucide-react'
import { BUZO_PRO_MONTHLY_PRICE_DISPLAY } from '../../../config/pricing'
import { useAppState } from '../../../store/appStore'
import { api } from '../../../lib/trpc'

const PLAN_COMPARE_ROWS: { label: string; basic: boolean; pro: boolean }[] = [
  { label: 'Discover & join public gigs near you', basic: true, pro: true },
  { label: 'Filter range window (6 months on Basic, 1 year on Pro)', basic: true, pro: true },
  { label: 'Smarter recommendations based on your taste', basic: false, pro: true },
  { label: 'Early access to hot gigs & drops near you', basic: false, pro: true },
  { label: 'Ad-free home and discover', basic: false, pro: true },
]

const PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_PRO as string

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

export function SubscriptionScreen() {
  const { closeSubscription, subscriptionTier, stripeSuccessOverlay } = useAppState()
  const isFreeTier = subscriptionTier === 'free'
  const isProTier = subscriptionTier === 'pro'

  const [actionError, setActionError] = useState<string | null>(null)
  const [showAllInvoices, setShowAllInvoices] = useState(false)
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')

  // Success screen after subscribing (driven by stripeSuccessOverlay in store)
  if (stripeSuccessOverlay) {
    return (
      <motion.div
        className="subscription-screen"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <header className="subscription-screen-header">
          <span className="subscription-screen-spacer" aria-hidden />
          <span className="subscription-screen-title">Subscription</span>
          <span className="subscription-screen-spacer" aria-hidden />
        </header>

        <div className="subscription-success-body">
          <motion.div
            className="subscription-success-icon-wrap"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
          >
            <Sparkles size={40} strokeWidth={1.5} />
          </motion.div>

          <motion.h2
            className="subscription-success-title"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Welcome to Buzo Pro
          </motion.h2>

          <motion.p
            className="subscription-success-subtitle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
          >
            You now have early access, smarter recommendations, and an ad-free experience. Enjoy the gigs.
          </motion.p>

          <motion.ul
            className="subscription-success-perks"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            {[
              'Smarter recommendations based on your taste',
              'Early access to hot gigs & drops near you',
              'Ad-free home and discover',
            ].map((perk) => (
              <li key={perk} className="subscription-success-perk">
                <Check size={15} strokeWidth={2.5} className="subscription-success-check" aria-hidden />
                {perk}
              </li>
            ))}
          </motion.ul>

          <motion.button
            type="button"
            className="subscription-success-cta"
            onClick={closeSubscription}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68 }}
          >
            Start exploring
          </motion.button>
        </div>
      </motion.div>
    )
  }

  // Always fetch billing info fresh — no cache, returns subscription_tier straight from DB.
  const { data: billing, isLoading: billingLoading, refetch: refetchBilling } = api.stripe.getBillingInfo.useQuery(
    undefined,
    { retry: false, staleTime: 0, refetchOnMount: 'always' },
  )

  // Sync store tier from DB result (bypasses stale session cache)
  useEffect(() => {
    console.log('[SubscriptionScreen] billing data:', billing)
    if (!billing) return
    const freshTier = billing.subscription_tier === 'pro' ? 'pro' : 'free'
    console.log('[SubscriptionScreen] freshTier from DB:', freshTier, 'store has:', useAppState.getState().subscriptionTier)
    useAppState.setState({ subscriptionTier: freshTier })
  }, [billing])

  // Mutations
  const createCheckout = api.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
    onError: (err) => setActionError(err.message),
  })

  const cancelSub = api.stripe.cancelSubscription.useMutation({
    onSuccess: () => {
      setActionError(null)
      void refetchBilling()
    },
    onError: (err) => setActionError(err.message),
  })

  const reactivateSub = api.stripe.reactivateSubscription.useMutation({
    onSuccess: () => {
      setActionError(null)
      void refetchBilling()
    },
    onError: (err) => setActionError(err.message),
  })

  const handleUpgrade = () => {
    setActionError(null)
    const origin = window.location.origin
    createCheckout.mutate({
      priceId: PRICE_ID,
      successUrl: `${origin}/profile?subscription=success`,
      cancelUrl: `${origin}/profile?subscription=cancelled`,
    })
  }

  const handleCancel = () => {
    if (!window.confirm('Cancel your Buzo Pro subscription? You keep Pro features until the end of the current period.')) return
    setActionError(null)
    cancelSub.mutate()
  }

  const handleReactivate = () => {
    setActionError(null)
    reactivateSub.mutate()
  }

  const isCancelledButActive =
    billing?.cancel_at_period_end === true && billing?.subscription_status === 'active'

  const renewalLabel = () => {
    if (billingLoading) return 'Loading…'
    if (!billing?.current_period_end) return ''
    if (isCancelledButActive) return `Cancels ${formatDate(billing.current_period_end)}`
    return `Renews ${formatDate(billing.current_period_end)}`
  }

  return (
    <motion.div
      className="subscription-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="subscription-screen-header">
        <button
          type="button"
          className="subscription-screen-back"
          onClick={closeSubscription}
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="subscription-screen-title">Subscription</span>
        <span className="subscription-screen-spacer" aria-hidden />
      </header>

      <div className="subscription-body">
        {/* Plan cards */}
        <div className="subscription-plan-cards">
          {/* Free / Basic card */}
          <div
            className={[
              'subscription-plan-card',
              isFreeTier ? 'subscription-plan-card--current-basic' : 'subscription-plan-card--inactive',
            ].join(' ')}
          >
            <span
              className={[
                'subscription-plan-icon',
                isFreeTier ? 'subscription-plan-icon--current-basic' : 'subscription-plan-icon--muted',
              ].join(' ')}
              aria-hidden
            >
              <Ticket size={22} strokeWidth={2} />
            </span>
            <div className="subscription-plan-row">
              <h2 className={['subscription-plan-name', !isFreeTier ? 'subscription-plan-name--basic' : ''].filter(Boolean).join(' ')}>
                Buzo Basic
              </h2>
              {isFreeTier ? (
                <span className="subscription-plan-status subscription-plan-status--basic">Active</span>
              ) : null}
            </div>
            <p className={['subscription-plan-price', !isFreeTier ? 'subscription-plan-price--basic' : ''].filter(Boolean).join(' ')}>
              Free
            </p>
            <p className="subscription-plan-renew">Core discovery &amp; public gigs</p>
          </div>

          {/* Pro card */}
          <div
            className={[
              'subscription-plan-card',
              isProTier ? 'subscription-plan-card--current' : 'subscription-plan-card--inactive',
            ].join(' ')}
          >
            <span
              className={['subscription-plan-icon', !isProTier ? 'subscription-plan-icon--muted' : ''].filter(Boolean).join(' ')}
              aria-hidden
            >
              <Sparkles size={22} strokeWidth={2} />
            </span>
            <div className="subscription-plan-row">
              <h2 className={['subscription-plan-name', !isProTier ? 'subscription-plan-name--basic' : ''].filter(Boolean).join(' ')}>
                Buzo Pro
              </h2>
              {isProTier ? <span className="subscription-plan-status">Active</span> : null}
            </div>
            <p className={['subscription-plan-price', !isProTier ? 'subscription-plan-price--basic' : ''].filter(Boolean).join(' ')}>
              {BUZO_PRO_MONTHLY_PRICE_DISPLAY}
            </p>
            <p className="subscription-plan-renew">
              {isProTier ? renewalLabel() : 'Upgrade anytime'}
            </p>
          </div>
        </div>

        {/* Error banner */}
        {actionError ? (
          <p className="subscription-error" role="alert">{actionError}</p>
        ) : null}

        {/* Upgrade CTA (free users) */}
        {isFreeTier ? (
          <div className="subscription-card--cta subscription-card--solo">
            <button
              type="button"
              className="subscription-row subscription-row--cta"
              onClick={handleUpgrade}
              disabled={createCheckout.isPending}
            >
              <Sparkles size={15} style={{ marginRight: 8, flexShrink: 0 }} aria-hidden />
              <span>{createCheckout.isPending ? 'Redirecting to Stripe…' : 'Upgrade to Buzo Pro — SGD 6.99 / mo'}</span>
              <ChevronRight size={16} className="subscription-row-chevron" aria-hidden />
            </button>
          </div>
        ) : null}

        {/* Plan comparison */}
        <section className="subscription-section">
          <h3 className="subscription-section-title">Basic vs Pro</h3>
          <div className="subscription-compare" role="table" aria-label="Plan comparison">
            <div className="subscription-compare-head" role="row">
              <span className="subscription-compare-feature-heading" role="columnheader">Benefit</span>
              <span
                className={['subscription-compare-plan-head', 'subscription-compare-plan-head--basic', isFreeTier ? 'subscription-compare-plan-head--accent-basic' : ''].filter(Boolean).join(' ')}
                role="columnheader"
              >
                Basic
              </span>
              <span
                className={['subscription-compare-plan-head', 'subscription-compare-plan-head--pro', isProTier ? 'subscription-compare-plan-head--accent-pro' : ''].filter(Boolean).join(' ')}
                role="columnheader"
              >
                Pro
              </span>
            </div>
            {PLAN_COMPARE_ROWS.map((row) => (
              <div key={row.label} className="subscription-compare-row" role="row">
                <span className="subscription-compare-feature" role="cell">{row.label}</span>
                <span
                  className={['subscription-compare-cell', isFreeTier ? 'subscription-compare-cell--accent-basic' : ''].filter(Boolean).join(' ')}
                  role="cell"
                  aria-label={row.basic ? 'Included on Basic' : 'Not included on Basic'}
                >
                  {row.basic
                    ? <Check size={16} strokeWidth={2.5} className="subscription-compare-yes" aria-hidden />
                    : <Minus size={16} strokeWidth={2} className="subscription-compare-no" aria-hidden />}
                </span>
                <span
                  className={['subscription-compare-cell', isProTier ? 'subscription-compare-cell--accent-pro' : ''].filter(Boolean).join(' ')}
                  role="cell"
                  aria-label={row.pro ? 'Included on Pro' : 'Not included on Pro'}
                >
                  {row.pro
                    ? <Check size={16} strokeWidth={2.5} className="subscription-compare-yes" aria-hidden />
                    : <Minus size={16} strokeWidth={2} className="subscription-compare-no" aria-hidden />}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Manage section (Pro only) */}
        {isProTier ? (
          <section className="subscription-section">
            <h3 className="subscription-section-title">Manage</h3>
            <div className="subscription-card">
              {billingLoading ? (
                <div className="subscription-row">
                  <span className="subscription-row-muted">Loading billing history…</span>
                </div>
              ) : billing && billing.invoices.length > 0 ? (() => {
                // Derive unique years from invoices
                const years = Array.from(
                  new Set(billing.invoices.map((inv) => new Date(inv.created * 1000).getFullYear().toString()))
                ).sort((a, b) => Number(b) - Number(a))

                // Derive months for the selected year
                const monthsForYear = filterYear === 'all'
                  ? []
                  : Array.from(
                      new Set(
                        billing.invoices
                          .filter((inv) => new Date(inv.created * 1000).getFullYear().toString() === filterYear)
                          .map((inv) => (new Date(inv.created * 1000).getMonth() + 1).toString().padStart(2, '0'))
                      )
                    ).sort()

                // Apply filters
                const filtered = billing.invoices.filter((inv) => {
                  const d = new Date(inv.created * 1000)
                  if (filterYear !== 'all' && d.getFullYear().toString() !== filterYear) return false
                  if (filterMonth !== 'all' && (d.getMonth() + 1).toString().padStart(2, '0') !== filterMonth) return false
                  return true
                })

                const PREVIEW = 3
                const visible = showAllInvoices ? filtered : filtered.slice(0, PREVIEW)
                const hasMore = filtered.length > PREVIEW

                const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

                return (
                  <>
                    {/* Filter row — only show if there are multiple years or months */}
                    {years.length > 1 || monthsForYear.length > 1 ? (
                      <div className="subscription-invoice-filters">
                        <select
                          className="subscription-invoice-select"
                          value={filterYear}
                          onChange={(e) => { setFilterYear(e.target.value); setFilterMonth('all'); setShowAllInvoices(false) }}
                          aria-label="Filter by year"
                        >
                          <option value="all">All years</option>
                          {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {filterYear !== 'all' && monthsForYear.length > 1 ? (
                          <select
                            className="subscription-invoice-select"
                            value={filterMonth}
                            onChange={(e) => { setFilterMonth(e.target.value); setShowAllInvoices(false) }}
                            aria-label="Filter by month"
                          >
                            <option value="all">All months</option>
                            {monthsForYear.map((m) => (
                              <option key={m} value={m}>{MONTH_NAMES[parseInt(m, 10) - 1]}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    ) : null}

                    {filtered.length === 0 ? (
                      <div className="subscription-row">
                        <span className="subscription-row-muted">No invoices for this period</span>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`subscription-invoice-list${showAllInvoices ? ' subscription-invoice-list--expanded' : ''}`}
                        >
                          {visible.map((inv) => (
                            <div key={inv.id} className="subscription-row subscription-row--invoice">
                              <div className="subscription-invoice-meta">
                                <span className="subscription-invoice-amount">
                                  {formatCurrency(inv.amount_paid, inv.currency)}
                                </span>
                                <span className="subscription-invoice-date">
                                  {formatDate(inv.created)}
                                </span>
                              </div>
                              {inv.invoice_pdf ? (
                                <a
                                  href={inv.invoice_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="subscription-invoice-download"
                                  aria-label="Download invoice PDF"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download size={15} />
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {hasMore ? (
                          <button
                            type="button"
                            className="subscription-invoice-toggle"
                            onClick={() => setShowAllInvoices((v) => !v)}
                          >
                            {showAllInvoices
                              ? 'Show less'
                              : `Show all ${filtered.length} invoices`}
                          </button>
                        ) : null}
                      </>
                    )}
                  </>
                )
              })() : (
                <div className="subscription-row">
                  <span className="subscription-row-muted">No invoices yet</span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* Footnote */}
        <p className="subscription-footnote">
          {isProTier ? (
            isCancelledButActive ? (
              <>Your Pro subscription is cancelled. You keep Pro features until {billing?.current_period_end ? formatDate(billing.current_period_end) : 'end of period'}.</>
            ) : (
              <>Cancel anytime. You keep Pro features until the end of the current period.</>
            )
          ) : (
            <>You are on Buzo Basic. Upgrade to Pro anytime for ad-free browsing, early access, and smarter recommendations.</>
          )}
        </p>

        {/* Cancel / Reactivate (Pro only) */}
        {isProTier ? (
          <div className="subscription-card subscription-card--solo">
            {isCancelledButActive ? (
              <button
                type="button"
                className="subscription-row subscription-row--cta"
                onClick={handleReactivate}
                disabled={reactivateSub.isPending}
              >
                <span>{reactivateSub.isPending ? 'Reactivating…' : 'Reactivate subscription'}</span>
                <ChevronRight size={16} className="subscription-row-chevron" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className="subscription-row subscription-row--danger"
                onClick={handleCancel}
                disabled={cancelSub.isPending}
              >
                <span>{cancelSub.isPending ? 'Cancelling…' : 'Cancel subscription'}</span>
                <ChevronRight size={16} className="subscription-row-chevron" aria-hidden />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
