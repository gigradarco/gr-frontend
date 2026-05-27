import type { EventItem, GigEntry, PlanPageEvent, PlanPastEvent } from '../types'

export const events: EventItem[] = [
  {
    id: 'marquee',
    title: 'Marquee Singapore',
    venue: 'Marquee',
    district: 'Marina Bay',
    time: '22:30',
    genre: 'Techno',
    exploreCategoryId: 'club-nights',
    locationCityId: 'singapore',
    verified: 89,
    image:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    host: 'Marcus',
    hostPrompt: 'any techno in Marina Bay tonight?',
    friendsGoing: 2,
    vibeTags: ['Warehouse', 'Peak Energy'],
    ticketPrice: '42.00 SGD',
    bpReward: 15,
    buzzPct: 98,
    lat: 1.2834,
    lng: 103.8607,
  },
  {
    id: 'neon-noir',
    title: 'Neon Noir',
    venue: 'Neon Noir',
    district: 'Raffles Place',
    time: '19:00',
    genre: 'Cocktail Bar',
    exploreCategoryId: 'food',
    locationCityId: 'singapore',
    verified: 91,
    image:
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80',
    host: 'Elena',
    hostPrompt: 'Best cocktails, worst acoustics.',
    friendsGoing: 4,
    vibeTags: ['Speakeasy', 'Smoked Negroni'],
    ticketPrice: '28.00 SGD',
    bpReward: 12,
    lat: 1.2840,
    lng: 103.8513,
  },
  {
    id: 'bluenote',
    title: 'The Blue Note Session',
    venue: 'BeBop Lounge',
    district: 'Tiong Bahru',
    time: '22:00',
    genre: 'Jazz',
    exploreCategoryId: 'jazz-blues',
    locationCityId: 'singapore',
    verified: 94,
    image:
      'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80',
    host: 'Sarah Chen',
    hostPrompt: "who's down for some deep house tonight?",
    friendsGoing: 3,
    vibeTags: ['Intimate', 'Vinyl Audio'],
    ticketPrice: '35.00 SGD',
    lat: 1.2847,
    lng: 103.8270,
  },
  {
    id: 'neonpulse',
    title: 'Neon Pulse: Architects',
    venue: 'The Obsidian Vault',
    district: 'Downtown Core',
    time: '23:00',
    genre: 'Electronic',
    exploreCategoryId: 'underground',
    locationCityId: 'singapore',
    verified: 92,
    image:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    host: 'Alex Chen',
    hostPrompt: 'closing set is supposed to be unreal tonight.',
    friendsGoing: 4,
    vibeTags: ['Live Visuals', 'Hard Groove'],
    ticketPrice: '45.00 SGD',
    lat: 1.2789,
    lng: 103.8536,
  },
]

/** Single featured event for the Plan tab (event detail wireframe). */
export const planPageEvent: PlanPageEvent = {
  eventId: 'neonpulse',
  heroImage:
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
  displayTitle: 'NEON REBELLION: PHASE IV',
  artistLine: 'BY KØRE GRAVITY',
  genreTags: ['INDUSTRIAL TECHNO', 'UNDERGROUND'],
  venueLine: 'THE VAULT, BERLIN',
  timeRange: '23:00 – 06:00',
  ticketPrice: '52.00 SGD',
  aiVibeScore: null,
  eliteVerifiedCount: 42,
  eliteStackExtra: 39,
  experienceParts: {
    before:
      'A relentless, high-BPM exploration of sound design where concrete walls vibrate with sub frequencies. This is not just music; it is a ',
    emphasis: 'visceral journey',
    after:
      ' into the mechanical heartbeat of the underground. Expect hypnotic loops and raw analogue textures until sunrise.',
  },
  audioPreviewLabel: null,
  audioCurrent: '0:00',
  audioTotal: '0:00',
  friendsAttendingCount: 125,
  friends: [
    {
      id: 'f1',
      name: 'Sarah',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      ring: true,
    },
    {
      id: 'f2',
      name: 'Marcus',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      ring: true,
    },
    {
      id: 'f3',
      name: 'Lena',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'f4',
      name: 'David',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'f5',
      name: 'Mia',
      avatar:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    },
  ],
}

export const discoverTargetPrompt = 'any good jazz tonight near tiong bahru ?'

export const discoverSuggestedPrompts = [
  'any good jazz tonight near Tiong Bahru ?',
  'best techno tonight in Marina Bay?',
  'who is going to neon pulse tonight?',
]

/** Layla-style welcome shortcuts → prefilled into Discover when the user enters the app. */
export type WelcomeIntroShortcut = { label: string; prompt: string }

export const welcomeIntroShortcuts: WelcomeIntroShortcut[] = [
  {
    label: 'Create a new night',
    prompt: 'Surprise me with a credible night out — jazz or house, near central Singapore',
  },
  {
    label: 'Inspire me where to go',
    prompt: 'What are the strongest picks tonight with real verification and social proof?',
  },
  {
    label: 'Plan a crawl',
    prompt: 'Where should a group go in Marina Bay tonight with mixed tastes?',
  },
  {
    label: 'Last-minute escape',
    prompt: 'I have two hours — one unforgettable stop near Marina Bay',
  },
]

export type WelcomeSpotlightNight = {
  title: string
  subtitle: string
  image: string
  prompt: string
}

/** Layla-style persona + trip framing: “Friends — …”, deep-link prompts into Discover. */
export const welcomeSpotlightNights: WelcomeSpotlightNight[] = [
  {
    title: 'Friends — Marina Bay crawl',
    subtitle: 'Techno & clubs · group-ready',
    image: events[0].image,
    prompt: `Where should a big group go for techno in ${events[0].district} tonight?`,
  },
  {
    title: 'Couples — Jazz & drinks',
    subtitle: `${events[2].district} · low-key magic`,
    image: events[2].image,
    prompt: 'Any good jazz tonight near Tiong Bahru ?',
  },
  {
    title: 'Solo — Late-night neon',
    subtitle: `${events[1].district} · cocktails first`,
    image: events[1].image,
    prompt: 'Best solo-friendly cocktail bars open late tonight near the CBD?',
  },
]

export type WelcomeLandingPillar = {
  title: string
  body: string
  icon: 'sparkles' | 'wallet' | 'compass' | 'calendar'
}

export const welcomeAllInOneCopy = {
  title: 'All-in-one AI nightlife planner',
  subtitle: 'From "where tonight?" to a plan you trust — in under a minute.',
  ctaLabel: 'Create a new night',
}

export const welcomeEveryStepCopy = {
  title: 'I’ll be there for you every step',
  lead: 'Curate picks, save nights you care about, and catch signals from your crew when it matters — so going out feels lighter, not louder.',
}

/** Same four beats as Layla (tailor-made, cheaper, hidden gems, no surprises), written for going out. */
export const welcomeLandingPillars: WelcomeLandingPillar[] = [
  {
    icon: 'sparkles',
    title: 'Tailor-made',
    body: 'Your vibe, budget, and neighbourhood — your plan.',
  },
  {
    icon: 'wallet',
    title: 'Cheaper',
    body: 'Credible options, fair entry, no door surprises.',
  },
  {
    icon: 'compass',
    title: 'Hidden gems',
    body: 'Off-path rooms and residencies worth the detour.',
  },
  {
    icon: 'calendar',
    title: 'No surprises',
    body: 'Lineups, timing, and context — verified.',
  },
]

export type WelcomeLandingTestimonial = {
  quote: string
  initials: string
  name: string
  age: number
}

export const welcomeLandingTestimonials: WelcomeLandingTestimonial[] = [
  {
    quote:
      'We used Buzo like a pocket concierge — it turned “where tonight?” into a short list we actually trusted. Saved us an hour of group chat chaos.',
    initials: 'M',
    name: 'Maya',
    age: 28,
  },
  {
    quote:
      'I’m picky about techno. Buzo’s picks felt closer to word-of-mouth than random listings — and we still made it door on time.',
    initials: 'J',
    name: 'James',
    age: 34,
  },
  {
    quote:
      'Date night in a city we don’t know: cocktails, jazz, no cringe. That’s the bar — Buzo cleared it.',
    initials: 'R',
    name: 'Rina',
    age: 31,
  },
]

export type WelcomeLandingFaqItem = { question: string; answer: string }

export const welcomeLandingFaq: WelcomeLandingFaqItem[] = [
  {
    question: 'What is Buzo?',
    answer:
      'Buzo is your AI-assisted planner for going out — from “what’s credible tonight?” to “where should we meet first?” It blends taste, verification context, and what’s happening around you so you decide faster.',
  },
  {
    question: 'How does Buzo work?',
    answer:
      'Share your area, vibe, budget, and timing. Buzo returns grounded suggestions you can refine — with context on venues, crowds, and signals so you’re not flying blind.',
  },
  {
    question: 'Can Buzo help with group nights?',
    answer:
      'Yes — say who’s coming and the mix of tastes. Buzo can bias toward meetup-friendly flow, cover-friendly options, and spots with room to breathe.',
  },
  {
    question: 'Is it free to get started?',
    answer:
      'Yes — getting started is completely free. You can plan, discover, and explore without paying anything. Some premium features require an upgrade, but the core Buzo experience is yours from day one.',
  },
  {
    question: 'Is Buzo good for couples or solo?',
    answer:
      'Both. Couples get low-stress pacing and atmosphere-led picks; solo travelers get safer, flexible routing with neighborhoods that are easier to navigate late.',
  },
  {
    question: 'Is Buzo free to use?',
    answer:
      'Planning and discovery are free to explore. Core features stay accessible — with optional upgrades for power users.',
  },
]

export const welcomeFinalCtaCopy = {
  title: 'Ready to give it a try?',
  body: 'See how Buzo can turn a vague idea into a night out in under a minute.',
  ctaLabel: 'Try Buzo now',
}

/** Placeholder hero video on the welcome page — swap `videoId` for your real upload (the id after `v=` in YouTube). */
export const welcomePlaceholderYoutube = {
  title: 'See the night before you go',
  /** https://www.youtube.com/watch?v=MJ3Is0Uwxho */
  videoId: 'MJ3Is0Uwxho',
  embedTitle:
    'What Singapore Nightlife Looks Like at Marina Bay on a Saturday | 2025 Walking Tour [4K]',
}

export const telegramBotLink = 'http://t.me/gigradar123_bot?start=hello'

export const gigHistory: GigEntry[] = [
  {
    id: 'g1',
    venue: 'Berghain / Panorama Bar',
    when: 'YESTERDAY',
    description: 'Klockworks Night w/ Ben Klock & Marcel Dettmann',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g2',
    venue: 'Tresor Berlin',
    when: '3 DAYS AGO',
    description: 'Vault Series: Surgeon (Live)',
    attended: false,
    images: [],
  },
  {
    id: 'g3',
    venue: 'Fabric London',
    when: '1 WEEK AGO',
    description: 'Room 1: Objekt b2b Dj Stingray',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g4',
    venue: 'De School Amsterdam',
    when: '2 WEEKS AGO',
    description: 'Closing Party: Dj Stingray 313',
    attended: true,
    images: [],
  },
  {
    id: 'g5',
    venue: 'Robert Johnson Frankfurt',
    when: '3 WEEKS AGO',
    description: 'Zip b2b Move D — all night long',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g6',
    venue: 'Corsica Studios London',
    when: '1 MONTH AGO',
    description: 'Perc Trax Showcase',
    attended: false,
    images: [],
  },
  {
    id: 'g7',
    venue: 'Shelter Amsterdam',
    when: '1 MONTH AGO',
    description: 'Dekmantel Selectors: Palms Trax',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g8',
    venue: 'OHM Berlin',
    when: '6 WEEKS AGO',
    description: 'Oscillate: Blawan Live',
    attended: true,
    images: [],
  },
  {
    id: 'g9',
    venue: 'Printworks London',
    when: '2 MONTHS AGO',
    description: 'Junction 2 presents: Amelie Lens',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g10',
    venue: 'Watergate Berlin',
    when: '2 MONTHS AGO',
    description: 'Innervisions: Dixon & Âme',
    attended: false,
    images: [],
  },
  {
    id: 'g11',
    venue: 'Nitsa Barcelona',
    when: '3 MONTHS AGO',
    description: 'Sonar Off: Paula Temple Live',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g12',
    venue: 'Concrete Paris',
    when: '3 MONTHS AGO',
    description: 'Possession: Rebekah b2b Alignment',
    attended: true,
    images: [],
  },
  {
    id: 'g13',
    venue: 'Fabric London',
    when: '4 MONTHS AGO',
    description: 'Room 2: Floating Points Live AV',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g14',
    venue: 'Tresor Berlin',
    when: '4 MONTHS AGO',
    description: 'Globus: Ancient Methods',
    attended: false,
    images: [],
  },
  {
    id: 'g15',
    venue: 'De Marktkantine Amsterdam',
    when: '5 MONTHS AGO',
    description: 'ADE Special: Peggy Gou',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g16',
    venue: 'Berghain / Panorama Bar',
    when: '5 MONTHS AGO',
    description: 'Len Faki b2b Answer Code Request',
    attended: true,
    images: [],
  },
  {
    id: 'g17',
    venue: 'Corsica Studios London',
    when: '6 MONTHS AGO',
    description: 'Hessle Audio: Pangaea Live',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g18',
    venue: 'Razzmatazz Barcelona',
    when: '6 MONTHS AGO',
    description: 'The Loft: Maceo Plex',
    attended: false,
    images: [],
  },
  {
    id: 'g19',
    venue: 'Fabric London',
    when: '7 MONTHS AGO',
    description: 'fabric x Hessle: Ben UFO',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g20',
    venue: 'Watergate Berlin',
    when: '8 MONTHS AGO',
    description: 'Kompakt: Michael Mayer b2b Tobias Thomas',
    attended: true,
    images: [],
  },
  {
    id: 'g21',
    venue: 'OHM Berlin',
    when: '9 MONTHS AGO',
    description: 'Stroboscopic Artefacts: Lucy Live',
    attended: true,
    images: [
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
    ],
  },
  {
    id: 'g22',
    venue: 'Shelter Amsterdam',
    when: '10 MONTHS AGO',
    description: 'Berceuse Heroique: Surgeon Live',
    attended: false,
    images: [],
  },
]

/** Past gigs for Plan tab — same source as profile gig history (`gigHistory`). */
export const planPastEvents: PlanPastEvent[] = gigHistory.map((g) => ({
  id: `past-${g.id}`,
  title: g.description,
  venue: g.venue,
  whenLabel: g.when,
  image:
    g.images[0] ??
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=80',
}))

const planDetailFallbackFriends = planPageEvent.friends

export function planDetailFromEventItem(ev: EventItem): PlanPageEvent {
  const t0 = (ev.vibeTags[0] ?? ev.genre).toUpperCase()
  const t1 = (ev.vibeTags[1] ?? 'LIVE').toUpperCase()
  return {
    eventId: ev.id,
    heroImage: ev.image,
    displayTitle: ev.title.toUpperCase(),
    artistLine: `HOST · ${ev.host.toUpperCase()}`,
    genreTags: [t0, t1],
    venueLine: `${ev.venue.toUpperCase()}, ${ev.district.toUpperCase()}`,
    lat: typeof ev.lat === 'number' ? ev.lat : undefined,
    lng: typeof ev.lng === 'number' ? ev.lng : undefined,
    locationCityId: ev.locationCityId || 'singapore',
    timeRange: ev.time,
    eventDateTime: ev.eventDateTime ?? null,
    ticketPrice: ev.ticketPrice || undefined,
    aiVibeScore: null,
    eliteVerifiedCount: ev.verified,
    eliteStackExtra: Math.max(8, ev.friendsGoing * 9),
    experienceParts: {
      before: `Tonight at ${ev.venue}: ${ev.genre} energy built for the floor. `,
      emphasis: ev.vibeTags[0] ?? 'All night',
      after: ` ${ev.hostPrompt}`,
    },
    audioPreviewLabel: null,
    audioCurrent: '0:00',
    audioTotal: '0:00',
    friendsAttendingCount: ev.friendsGoing * 14 + 32,
    friends: planDetailFallbackFriends.slice(0, Math.max(3, Math.min(5, ev.friendsGoing + 2))),
  }
}

export function planDetailFromPast(p: PlanPastEvent): PlanPageEvent {
  return {
    eventId: p.id,
    heroImage: p.image,
    displayTitle: p.title.toUpperCase(),
    artistLine: 'PAST NIGHT',
    genreTags: ['ARCHIVE', 'WAS THERE'],
    venueLine: p.venue.toUpperCase(),
    timeRange: p.whenLabel,
    aiVibeScore: null,
    eliteVerifiedCount: 56,
    eliteStackExtra: 24,
    experienceParts: {
      before: 'A night logged in your plan. ',
      emphasis: 'Memory',
      after: ' — open any night here for recap-style details.',
    },
    audioPreviewLabel: null,
    audioCurrent: '0:00',
    audioTotal: '0:00',
    friendsAttendingCount: 0,
    friends: planDetailFallbackFriends.slice(0, 3),
  }
}

export function getPlanDetailUpcoming(eventId: string): PlanPageEvent | null {
  if (eventId === planPageEvent.eventId) return planPageEvent
  const ev = events.find((e) => e.id === eventId)
  return ev ? planDetailFromEventItem(ev) : null
}

export function getPlanDetailPast(pastId: string): PlanPageEvent | null {
  const p = planPastEvents.find((x) => x.id === pastId)
  return p ? planDetailFromPast(p) : null
}

/**
 * Visual palette for tier cards / hero (gradients). Not shown as user-facing labels.
 * Event-goer tier names live in `label` + `id`.
 */
export type BuzzTierMetal = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'black'

export type BuzzTierDef = {
  id: string
  /** Display level, e.g. Lv.3 */
  level: number
  metal: BuzzTierMetal
  label: string
  minPoints: number
}

export const buzzTiers: BuzzTierDef[] = [
  { id: 'first_in', level: 1, metal: 'bronze', label: 'First In', minPoints: 0 },
  { id: 'on_the_floor', level: 2, metal: 'silver', label: 'On the Floor', minPoints: 4_000 },
  { id: 'scene_regular', level: 3, metal: 'gold', label: 'Scene Regular', minPoints: 8_000 },
  { id: 'front_row', level: 4, metal: 'platinum', label: 'Front Row', minPoints: 12_000 },
  { id: 'afters', level: 5, metal: 'diamond', label: 'Midnight Sun', minPoints: 20_000 },
  { id: 'sunrise', level: 6, metal: 'black', label: 'Sunrise', minPoints: 50_000 },
]

/** Demo buzz balance — replace with API / user stats. */
export const buzzSummary = {
  total: 9420,
} as const

export function getBuzzTierState(total: number) {
  let currentIndex = 0
  for (let i = buzzTiers.length - 1; i >= 0; i--) {
    if (total >= buzzTiers[i].minPoints) {
      currentIndex = i
      break
    }
  }
  const current = buzzTiers[currentIndex]
  const next = buzzTiers[currentIndex + 1]
  const nextGoal = next?.minPoints ?? current.minPoints
  const span = next != null ? next.minPoints - current.minPoints : 1
  const progressToNext =
    next != null ? Math.min(1, Math.max(0, (total - current.minPoints) / span)) : 1
  const remaining = next != null ? Math.max(0, next.minPoints - total) : 0
  return {
    currentIndex,
    current,
    next,
    nextGoal,
    progressToNext,
    remaining,
    pctToNext: Math.round(progressToNext * 100),
  }
}

export type BuzzActivityRow = {
  id: string
  title: string
  subtitle?: string
  points: number
  when: string
}

export const buzzActivities: BuzzActivityRow[] = [
  {
    id: 'b1',
    title: 'Venue check-in',
    subtitle: 'Berghain · Klubnacht',
    points: 120,
    when: '2 days ago',
  },
  {
    id: 'b2',
    title: 'Post-gig review',
    subtitle: '4★ + photos',
    points: 85,
    when: '3 days ago',
  },
  {
    id: 'b3',
    title: 'Friend joined on your invite',
    subtitle: '@MARCO_T',
    points: 200,
    when: '1 week ago',
  },
  {
    id: 'b4',
    title: 'Weekly streak bonus',
    subtitle: '3 weekends in a row',
    points: 150,
    when: '1 week ago',
  },
  {
    id: 'b5',
    title: 'Check-in',
    subtitle: 'Shelter Amsterdam',
    points: 95,
    when: '2 weeks ago',
  },
  {
    id: 'b6',
    title: 'Profile milestone',
    subtitle: '10 cities explored',
    points: 300,
    when: '3 weeks ago',
  },
]
