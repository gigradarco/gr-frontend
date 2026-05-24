import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { PRIVACY_SAFETY_LAST_UPDATED } from '../../../config/profileSettings'
import { useAppState } from '../../../store/appStore'

export function PrivacySafetyScreen() {
  const { closePrivacySafety } = useAppState()

  return (
    <motion.div
      className="privacy-safety-screen"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="privacy-safety-screen-header">
        <button
          type="button"
          className="privacy-safety-screen-back"
          onClick={closePrivacySafety}
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="privacy-safety-screen-title">Privacy & safety</span>
        <span className="privacy-safety-screen-spacer" aria-hidden />
      </header>

      <div className="privacy-policy-body">
        <article className="privacy-policy-article">
          <p className="privacy-policy-meta">Last updated: {PRIVACY_SAFETY_LAST_UPDATED}</p>

          <p className="privacy-policy-lead">
            Buzo (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) helps you discover gigs, scenes, and live
            experiences. This Privacy Policy explains how we collect, use, and share information when you use
            our services (the &quot;Service&quot;), including our websites and mobile experiences.
          </p>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">1. Information we collect</h2>
            <p className="privacy-policy-p">
              We collect information you provide directly, information generated when you use the Service, and
              limited information from third parties when you choose to connect an account or sign in.
            </p>
            <ul className="privacy-policy-list">
              <li>
                <strong>Account and profile.</strong> Such as your name, username, email address, profile photo,
                bio, and preferences you set in the app.
              </li>
              <li>
                <strong>Activity and taste signals.</strong> Such as events you view, save, or plan to attend;
                genres, artists, or scenes you engage with; and in-app feedback — used to personalize
                recommendations.
              </li>
              <li>
                <strong>Location.</strong> If you allow it, we may collect approximate or precise location to
                show gigs and scenes near you. You can change or withdraw location access in your device or app
                settings.
              </li>
              <li>
                <strong>Communications.</strong> When you contact us (for example via Send feedback), we keep
                the content of your message and related metadata so we can respond.
              </li>
              <li>
                <strong>Device and technical data.</strong> Such as device type, operating system, app version,
                and diagnostic logs to keep the Service secure and reliable.
              </li>
            </ul>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">2. How we use information</h2>
            <p className="privacy-policy-p">We use information to:</p>
            <ul className="privacy-policy-list">
              <li>Provide, maintain, and improve Buzo and your personalized gig recommendations;</li>
              <li>Operate features you request (for example location-based discovery when enabled);</li>
              <li>Communicate with you about the Service, security, or policy updates;</li>
              <li>Detect abuse, fraud, and technical issues; and</li>
              <li>Comply with law and enforce our terms.</li>
            </ul>
            <p className="privacy-policy-p">
              We do <strong>not</strong> sell your personal information to third parties.
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">3. How we share information</h2>
            <p className="privacy-policy-p">We may share information only as described below:</p>
            <ul className="privacy-policy-list">
              <li>
                <strong>Service providers.</strong> Vendors that help us host, analyze, email, or support the
                Service, bound by confidentiality and processing agreements.
              </li>
              <li>
                <strong>Legal and safety.</strong> When required by law, legal process, or to protect the
                rights, safety, and security of users, Buzo, or others.
              </li>
              <li>
                <strong>Business changes.</strong> In connection with a merger, acquisition, or sale of assets,
                subject to appropriate notices and choices where required.
              </li>
              <li>
                <strong>With your direction.</strong> When you ask us to share or connect to a third-party
                service.
              </li>
            </ul>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">4. Retention</h2>
            <p className="privacy-policy-p">
              We keep information only as long as needed for the purposes above, unless a longer period is
              required by law. When you delete your account, we delete or de-identify personal information
              associated with it, subject to limited exceptions (for example security backups or legal holds).
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">5. Your choices</h2>
            <p className="privacy-policy-p">Depending on where you live, you may have the right to:</p>
            <ul className="privacy-policy-list">
              <li>Access, correct, or delete certain personal information;</li>
              <li>Object to or restrict certain processing;</li>
              <li>Export a copy of data you provided (upon request);</li>
              <li>Withdraw consent where processing is based on consent; and</li>
              <li>Lodge a complaint with a data protection authority.</li>
            </ul>
            <p className="privacy-policy-p">
              You can manage many choices in Settings (including this screen and Preferences). For other
              requests, contact us using the details below.
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">6. Children</h2>
            <p className="privacy-policy-p">
              Buzo is not directed to children under 13 (or the age required in your region), and we do not
              knowingly collect personal information from them. If you believe we have collected information
              from a child, please contact us so we can delete it.
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">7. International transfers</h2>
            <p className="privacy-policy-p">
              We may process information in countries other than where you live. Where required, we use
              appropriate safeguards (such as standard contractual clauses) for cross-border transfers.
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">8. Changes to this policy</h2>
            <p className="privacy-policy-p">
              We may update this Privacy Policy from time to time. We will post the updated version and adjust
              the &quot;Last updated&quot; date. If changes are material, we will provide additional notice as
              appropriate.
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2 className="privacy-policy-h2">9. Contact</h2>
            <p className="privacy-policy-p">
              Questions about this policy or your data? Reach us through <strong>Send feedback</strong> in
              Settings or at the contact address your team publishes for Buzo support.
            </p>
          </section>
        </article>
      </div>
    </motion.div>
  )
}
