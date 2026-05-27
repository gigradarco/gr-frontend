import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { APP_RELEASE_LABEL, APP_RELEASE_NOTES } from '../../../config/profileSettings'
import { useAppState } from '../../../store/appStore'

export function ReleaseNotesScreen() {
  const closeReleaseNotes = useAppState((s) => s.closeReleaseNotes)

  return (
    <motion.div
      className="release-notes-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="release-notes-screen-header">
        <button
          type="button"
          className="release-notes-screen-back"
          onClick={closeReleaseNotes}
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="release-notes-screen-title">What's new</span>
        <span className="release-notes-screen-spacer" aria-hidden />
      </header>

      <div className="release-notes-body">
        <section className="release-notes-intro" aria-labelledby="release-notes-title">
          <p className="release-notes-kicker">Current build</p>
          <h1 className="release-notes-heading" id="release-notes-title">
            New in Buzo
          </h1>
          <p className="release-notes-lead">
            A quick log of features and product improvements shipped to Buzo.
          </p>
          <span className="release-notes-version">{APP_RELEASE_LABEL}</span>
        </section>

        <div className="release-notes-list">
          {APP_RELEASE_NOTES.map((release, index) => (
            <article className="release-note-card" key={release.id}>
              <div className="release-note-header">
                <div className="release-note-title-block">
                  <p className="release-note-meta">
                    {release.date} · {release.label}
                  </p>
                  <h2 className="release-note-title">{release.title}</h2>
                </div>
                {index === 0 ? <span className="release-note-badge">Latest</span> : null}
              </div>
              <p className="release-note-summary">{release.summary}</p>
              <ul className="release-note-list" aria-label={`${release.title} highlights`}>
                {release.highlights.map((highlight) => (
                  <li className="release-note-item" key={highlight}>
                    <CheckCircle2 size={15} className="release-note-check" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
