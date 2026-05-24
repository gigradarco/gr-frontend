import { motion } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { LANGUAGE_OPTIONS } from '../../../config/profileSettings'
import { useAppState } from '../../../store/appStore'

export function LanguageScreen() {
  const { closeLanguage } = useAppState()

  return (
    <motion.div
      className="language-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="language-screen-header">
        <button
          type="button"
          className="language-screen-back"
          onClick={closeLanguage}
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="language-screen-title">Language</span>
        <span className="language-screen-spacer" aria-hidden />
      </header>

      <div className="language-screen-body">
        <p className="language-screen-hint">App language</p>
        <div className="language-list-card">
          {LANGUAGE_OPTIONS.map((lang) => (
            <div
              key={lang.id}
              className="language-option language-option--selected"
              role="radio"
              aria-checked="true"
            >
              <span className="language-option-label">{lang.label}</span>
              <Check size={18} className="language-option-check" strokeWidth={2.5} aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
