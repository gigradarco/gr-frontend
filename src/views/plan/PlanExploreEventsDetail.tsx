import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, MapPin } from 'lucide-react'
import { events } from '../../data/demoData'
import { getExploreCategoryDef } from '../../data/exploreCategories'
import { getLocationCityById } from '../../data/locationRegions'
import { formatEventPriceLabel } from '../../lib/event-price-label'
import { useAppState } from '../../store/appStore'

export type PlanExploreDetailFocus =
  | { type: 'category'; id: string }
  | { type: 'city'; id: string }

type PlanExploreEventsDetailProps = {
  focus: PlanExploreDetailFocus
  onBack: () => void
  onOpenEvent: (eventId: string) => void
}

export function PlanExploreEventsDetail({
  focus,
  onBack,
  onOpenEvent,
}: PlanExploreEventsDetailProps) {
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterCityId, setFilterCityId] = useState('')

  useEffect(() => {
    if (focus.type === 'category') {
      setFilterCategoryId(focus.id)
      setFilterCityId(useAppState.getState().feedLocationCityId)
    } else {
      setFilterCityId(focus.id)
      setFilterCategoryId('')
    }
  }, [focus.type, focus.id])

  const title = useMemo(() => {
    const cat = filterCategoryId ? getExploreCategoryDef(filterCategoryId)?.label : null
    const city = filterCityId ? getLocationCityById(filterCityId)?.name : null
    if (cat && city) return `${cat} · ${city}`
    if (cat) return cat
    if (city) return city
    return 'Explore'
  }, [filterCategoryId, filterCityId])

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const catOk = !filterCategoryId || e.exploreCategoryId === filterCategoryId
      const cityOk = !filterCityId || e.locationCityId === filterCityId
      return catOk && cityOk
    })
  }, [filterCategoryId, filterCityId])

  return (
    <motion.div
      className="screen-content plan-page plan-explore-events plan-explore-events-detail"
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="plan-toolbar">
        <button
          type="button"
          className="plan-toolbar-btn"
          onClick={onBack}
          aria-label="Back to explore"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1 className="plan-toolbar-heading">{title}</h1>
        <span className="plan-toolbar-trail" aria-hidden />
      </header>

      <div className="plan-explore-events-body">
        {filteredEvents.length === 0 ? (
          <p className="plan-explore-category-events-empty">No events found.</p>
        ) : (
          <div className="plan-list" role="list">
            {filteredEvents.map((ev) => (
              <button
                type="button"
                key={ev.id}
                className="plan-list-card"
                onClick={() => onOpenEvent(ev.id)}
              >
                <img src={ev.image} alt="" className="plan-list-card-img" decoding="async" />
                <div className="plan-list-card-body">
                  <span className="plan-list-card-label">{ev.genre}</span>
                  <h2 className="plan-list-card-title">{ev.title}</h2>
                  <p className="plan-list-card-meta">
                    <MapPin size={13} aria-hidden />
                    {ev.venue}, {ev.district}
                  </p>
                  <p className="plan-list-card-meta">
                    <Clock size={13} aria-hidden />
                    {ev.time}
                    {ev.ticketPrice ? ` · ${formatEventPriceLabel(ev.ticketPrice)}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
