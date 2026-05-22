import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './not-found-404.css'

export function NotFound404Page() {
  const navigate = useNavigate()

  return (
    <main className="not-found-page">
      <section className="not-found-panel" aria-labelledby="not-found-title">
        <p className="not-found-kicker">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p className="not-found-copy">
          The page you are looking for does not exist or is not available.
        </p>
        <button
          type="button"
          className="not-found-action"
          onClick={() => navigate('/discover', { replace: true })}
        >
          <ArrowLeft size={17} aria-hidden />
          Back to Discover
        </button>
      </section>
    </main>
  )
}
