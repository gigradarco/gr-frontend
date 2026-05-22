import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, ExternalLink, ListChecks, Shield } from 'lucide-react'
import { telegramBotLink } from '../../data/demoData'
import './admin-home.css'

const adminTools = [
  {
    title: 'Event List',
    description: 'Review raw event rows, filters, image sources, and diagnostics.',
    path: '/event-list',
    status: 'Live',
  },
]

const themePages = [
  { label: 'Orange', path: '/design-theme/orange' },
  { label: 'Purple', path: '/design-theme/purple' },
]

const chatPages = [
  { label: 'Telegram', path: telegramBotLink, external: true as const },
]

const adminApiRoutes = [
  {
    method: 'GET',
    path: '/api/admin/events',
    description: 'Paginated admin event feed used by Event List.',
  },
  {
    method: 'GET',
    path: '/api/admin/events/count',
    description: 'Count endpoint for the same admin filters.',
  },
  {
    method: 'GET',
    path: '/api/admin/events/:id',
    description: 'Raw admin event detail by event id.',
  },
]

type AdminTab = 'pages' | 'api'

export function AdminHomePage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('pages')

  return (
    <main className="admin-home">
      <section className="admin-home-hero" aria-labelledby="admin-home-title">
        <div className="admin-home-kicker">
          <Shield size={16} aria-hidden />
          Admin workspace
        </div>
        <div className="admin-home-heading-row">
          <div>
            <h1 id="admin-home-title">GigRadar Admin</h1>
            <p className="admin-home-copy">
              Internal tools and admin-only event routes.
            </p>
          </div>
          <Link className="admin-home-discover-link" to="/discover">
            Back to Discover
          </Link>
        </div>
      </section>

      <section className="admin-home-section" aria-label="Admin workspace tabs">
        <div className="admin-home-tabs" role="tablist" aria-label="Admin sections">
          <button
            type="button"
            className={`admin-home-tab${activeTab === 'pages' ? ' is-active' : ''}`}
            id="admin-tab-pages"
            role="tab"
            aria-selected={activeTab === 'pages'}
            aria-controls="admin-panel-pages"
            onClick={() => setActiveTab('pages')}
          >
            <ListChecks size={16} aria-hidden />
            Admin pages
          </button>
          <button
            type="button"
            className={`admin-home-tab${activeTab === 'api' ? ' is-active' : ''}`}
            id="admin-tab-api"
            role="tab"
            aria-selected={activeTab === 'api'}
            aria-controls="admin-panel-api"
            onClick={() => setActiveTab('api')}
          >
            <Database size={16} aria-hidden />
            Admin API routes
          </button>
        </div>

        {activeTab === 'pages' ? (
          <div
            className="admin-home-panel"
            id="admin-panel-pages"
            role="tabpanel"
            aria-labelledby="admin-tab-pages"
          >
            <div className="admin-home-tool-grid">
              {adminTools.map((tool) => (
                <Link key={tool.path} className="admin-home-tool" to={tool.path}>
                  <div className="admin-home-tool-top">
                    <span className="admin-home-tool-status">{tool.status}</span>
                    <ExternalLink size={16} aria-hidden />
                  </div>
                  <h2>{tool.title}</h2>
                  <p>{tool.description}</p>
                  <code>{tool.path}</code>
                </Link>
              ))}
              <section className="admin-home-tool admin-home-tool--group" aria-labelledby="theme-pages-title">
                <div className="admin-home-tool-top">
                  <span className="admin-home-tool-status">Theme</span>
                </div>
                <h2 id="theme-pages-title">Design Themes</h2>
                <p>Review the shared visual system and accent theme directions.</p>
                <div className="admin-home-subtool-list">
                  {themePages.map((theme) => (
                    <Link key={theme.path} className="admin-home-subtool" to={theme.path}>
                      <span>{theme.label}</span>
                      <code>{theme.path}</code>
                      <ExternalLink size={14} aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
              <section className="admin-home-tool admin-home-tool--group" aria-labelledby="chat-pages-title">
                <div className="admin-home-tool-top">
                  <span className="admin-home-tool-status">Chat</span>
                </div>
                <h2 id="chat-pages-title">Chat</h2>
                <p>Entry points for chat channels and assistant surfaces.</p>
                <div className="admin-home-subtool-list">
                  {chatPages.map((chat) => (
                    <a
                      key={chat.path}
                      className="admin-home-subtool"
                      href={chat.path}
                      target={chat.external ? '_blank' : undefined}
                      rel={chat.external ? 'noreferrer' : undefined}
                    >
                      <span>{chat.label}</span>
                      <code>{chat.path}</code>
                      <ExternalLink size={14} aria-hidden />
                    </a>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div
            className="admin-home-panel"
            id="admin-panel-api"
            role="tabpanel"
            aria-labelledby="admin-tab-api"
          >
            <div className="admin-home-api-list">
              {adminApiRoutes.map((route) => (
                <div key={route.path} className="admin-home-api-row">
                  <span className="admin-home-method">{route.method}</span>
                  <code>{route.path}</code>
                  <p>{route.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
