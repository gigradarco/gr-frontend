# Buzo Frontend

Buzo is an AI nightlife concierge for Singapore-first event discovery. It helps users answer:

> What is worth going to tonight, and why should I trust it?

This repository is the public app entry point: a mobile-web React/Vite client for Discover, Ask Buzo, Plan, Favorites, Profile, and admin/debug surfaces. It is designed to be evaluated together with the backend and architecture repositories listed below.

Repository URL note: the Epic Connector project-wall submission points to [`gigradarco/gr-frontend`](https://github.com/gigradarco/gr-frontend). The project was migrated from [`gigradarapp/gr-frontend`](https://github.com/gigradarapp/gr-frontend), and both public URLs currently resolve for evaluation. Both repositories contain the same Buzo application code, so either URL is valid for reviewing the product implementation.

The product is intentionally not a generic listings directory. Buzo combines crawled event supply, user taste, planning state, location, source verification, and an AI recommendation layer so the user gets a short list of credible options instead of another long search results page.

## Judge TL;DR

| Question | Answer |
| --- | --- |
| What problem does Buzo solve? | Event discovery is fragmented across Instagram, Telegram, Google, ticketing sites, venue pages, maps, and group chats. |
| Why does it matter? | Users waste hours curating a night out and still risk stale listings, weak recommendations, or missed plans. |
| What is the product? | A Singapore-first AI nightlife concierge that turns scattered event supply into a few-click decision flow. |
| What is live now? | Hosted mobile-web app, Cloudflare Worker API, Turso-backed event catalog, Supabase-backed user state, and public waitlist. |
| What should judges inspect? | Discover feed, Ask Buzo, Plan state, Profile/subscription hooks, backend routes, tests, and architecture docs. |
| What stays private? | `gr-openclaw` crawler internals and `gr-north-star` strategy/fundraising notes. Their public contracts are documented in `gr-architecture`. |

## Why Buzo

Finding a good event tonight is expensive in time and attention. A user normally has to check Instagram, Telegram, Google, ticketing sites, venue pages, group chats, maps, prices, dates, and whether the listing is still real. That can take hours, and the result is still uncertain.

Buzo compresses that work into a few clicks:

1. It gathers fragmented event information from multiple sources.
2. It normalizes the important details: time, venue, price, category, image, source, and location.
3. It filters and ranks options around user intent, taste, and credibility.
4. It gives a short, actionable recommendation instead of a long list to manually inspect.

The value is not only convenience. Buzo reduces the hidden cost of self-curating a night out: research time, stale information, poor event choices, missed plans, and decision fatigue. For frequent nightlife users and travellers, that time saving compounds quickly.

## What To Review First

If you are evaluating the project, scan in this order:

1. `README.md` in this repo for the product and frontend entry point.
2. `src/App.tsx` for the mobile app shell, routing, lazy-loaded product surfaces, and protected-tab behavior.
3. `src/views/discover/` for Discover feed, Ask Buzo, event cards, map mode, and agent UI.
4. `src/lib/useDiscoverEvents.ts` and `src/lib/useEventPlans.ts` for how the frontend consumes live backend data.
5. `src/trpc/app-router.ts` for the frontend mirror of backend tRPC procedures.
6. Companion repos: `gr-backend` for API implementation and `gr-architecture` for system/data model details.

## Public Evaluation Repositories

These repositories are the planned public evaluation package:

| Repository | Role |
| --- | --- |
| [`gr-frontend`](https://github.com/gigradarco/gr-frontend) / [`original`](https://github.com/gigradarapp/gr-frontend) | React/Vite mobile-web app and main product surface. The `gigradarco` URL is the project-wall URL; the `gigradarapp` URL is the original migrated repo. Both contain the same Buzo application code, so either repo can be used to review the implementation. |
| [`gr-backend`](https://github.com/gigradarapp/gr-backend) | Cloudflare Workers API: Hono, tRPC, Supabase Auth, Turso events, Stripe, OpenAI, weather, image proxy. |
| [`gr-architecture`](https://github.com/gigradarapp/gr-architecture) | System architecture, data model, environments, rollout notes, and technical contracts. |
| [`gr-waitlist`](https://github.com/gigradarapp/gr-waitlist) | Public waitlist and acquisition page showing early go-to-market motion. |

`OpenClaw`, the event ingestion agent, is proprietary and not published in this package. Its behavior and data contract are documented in `gr-architecture`.

## Live Links

| Surface | URL |
| --- | --- |
| Hosted app | `https://gr-frontend-dev.vercel.app/` |
| Hosted API health | `https://gr-backend-dev.gigradar.workers.dev/health` |
| Waitlist | `https://gr-waitlist.vercel.app/` |

## Demo Video

[![Buzo Demo Video](https://drive.google.com/thumbnail?id=1PAZzhOB6IyXcqNs7jMN2BNOo9ivHgO3Z&sz=w1280)](https://drive.google.com/file/d/1PAZzhOB6IyXcqNs7jMN2BNOo9ivHgO3Z/view)

**[Watch the Buzo demo video](https://drive.google.com/file/d/1PAZzhOB6IyXcqNs7jMN2BNOo9ivHgO3Z/view)** — a walkthrough of Discover, Ask Buzo, Plan, and Profile. The step-by-step script below matches what the video shows.

## Demo Journey

A concise demo should show the product loop end to end:

1. Open the app and enter the mobile shell.
2. Use Discover to scan live Singapore events with filters, cards, images, source links, and map view.
3. Ask Buzo for a specific night-out intent, for example: `Techno in Marina Bay tonight under $50, credible lineups only`.
4. Open an event detail view and mark it as planned with `I'm going`.
5. Visit Plan to see upcoming/past event state.
6. Visit Profile to show taste preferences, subscription surface, and account-level retention hooks.
7. Open the waitlist link to show early acquisition/go-to-market motion.

## Product Surfaces

| Surface | What it demonstrates |
| --- | --- |
| Discover | Live event cards, filters, map view, event detail, source links, image fallback, save/favorite, and "I'm going" intent. |
| Ask Buzo | Agent-style recommendation flow with persona selection and tRPC-backed LLM calls. |
| Plan | Upcoming and past planned events hydrated from backend event data. |
| Favorites | Saved-event browsing with local cache and detail recovery. |
| Profile | Auth/session hydration, onboarding, taste preferences, avatar/profile settings, reputation, and subscription UI. |
| Admin | Event inspection, admin users, user analytics, weather map diagnostics, and design review pages. |

## Why This Is More Than A Frontend Mock

The frontend is thin by design, but it is connected to real system boundaries:

| Capability | Where it lives |
| --- | --- |
| Live event feed | `gr-backend` reads Turso `events`, projects public DTOs, and this app renders them in Discover. |
| AI recommendation flow | Ask Buzo calls backend tRPC procedures; LLM keys stay server-side. |
| Auth/session | Browser stores Supabase access/refresh tokens issued through backend `/api/auth/*` routes. |
| User planning | Plan state is user-owned data in Supabase and hydrated with Turso event details by the backend. |
| Images/source trust | Event images go through shared resolver logic and backend image proxy/source preview helpers. |
| Weather-aware planning | Weather helpers are backend-routed and cached with Cloudflare KV where appropriate. |
| Acquisition | `gr-waitlist` is a separate public waitlist page for demand capture before full product rollout. |

## System Context

```text
User
  -> gr-waitlist (public waitlist / acquisition page)
  -> gr-frontend (Vercel React/Vite)
  -> gr-backend (Cloudflare Workers: Hono + tRPC)
      -> Supabase (Auth, profiles, plans, taste, badges, subscriptions)
      -> Turso (events catalog)
      -> Stripe (billing)
      -> OpenAI (recommendations)
      -> Cloudflare KV / data.gov.sg (weather cache)

OpenClaw (private ingestion agent)
  -> validates against gr-backend reference-data API
  -> writes normalized event rows to Turso
```

Important boundary: the browser never receives Supabase service-role keys, Turso credentials, Stripe secrets, OpenAI keys, or OpenClaw internal keys.

## Repository Map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Main app shell, tab routing, overlays, event detail handoffs, and lazy-loaded screens. |
| `src/views/discover/` | Discover feed, Ask Buzo chat, Buzo agent picker/advisor, event cards, and map surfaces. |
| `src/views/plan/` | Plan hub, scheduled events, event detail, review, weather, and cancellation flows. |
| `src/views/profile/` | Profile, taste identity, reputation, subscription, settings, onboarding, and auth UI. |
| `src/views/favorites/` | Saved-event list and detail-cache behavior. |
| `src/views/admin-*`, `src/views/event-list/` | Internal/admin surfaces for event inspection, users, analytics, and diagnostics. |
| `src/lib/` | API helpers, auth/session utilities, event normalization, image resolution, weather logic, map helpers, and tests. |
| `src/config/` | UI config, route config, pricing, filters, navigation, agent definitions, and feature constants. |
| `src/store/appStore.ts` | Zustand state for shell UI, auth hydration, profile state, favorites, onboarding, and preferences. |
| `src/trpc/app-router.ts` | Frontend type mirror of backend tRPC routes. |

## Technology

| Area | Stack |
| --- | --- |
| App | React 19, TypeScript, Vite |
| Routing | React Router 7 |
| Server state | TanStack Query, tRPC client |
| Client state | Zustand |
| Motion | Framer Motion |
| Maps | MapLibre GL, `react-map-gl`, `supercluster`; Leaflet for secondary previews |
| Icons | Lucide React |
| Validation/tests | Zod, Vitest |

## Local Development

Start the backend first:

```bash
cd ../gr-backend
npm install
cp .dev.vars.example .dev.vars
npm run check:env
npm run dev
```

Backend runs on `http://127.0.0.1:8787`.

Then start the frontend:

```bash
cd ../gr-frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.

In local mode, leave `VITE_API_LOCAL_URL` empty unless you intentionally need direct Worker calls. `vite.config.ts` proxies `/trpc`, `/health`, and configured `/api/...` prefixes to `http://127.0.0.1:8787`.

## Frontend Environment

Copy `.env.example` to `.env`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_MODE` | `local` for Vite proxy, `cloud` for hosted Worker. |
| `VITE_API_LOCAL_URL` | Optional direct local API base. Empty means same-origin Vite proxy. |
| `VITE_API_CLOUD_URL` | Hosted Worker URL for cloud builds. |
| `VITE_DISCOVER_EVENTS_SOURCE` | `live`, `demo`, or `auto`. Use `live` for real app flows. |
| `VITE_DISCOVER_EVENTS_ALLOW_DEMO_FALLBACK` | Keep `false` in production. |
| `VITE_MAP_STYLE_URL_DARK`, `VITE_MAP_STYLE_URL_LIGHT`, `VITE_MAPTILER_KEY` | Optional map style configuration. |
| `GOOGLE_MAPS_EMBED_KEY` | Public browser key for embed-only map surfaces; restrict by HTTP referrer. |
| `VITE_OPENAI_PROXY_URL` | Optional legacy fallback. Primary Ask Buzo flow uses backend tRPC. |

Never put service-role keys, Turso tokens, Stripe secret keys, OpenAI keys, or internal ingestion keys in frontend env.

## Backend Contract

Frontend-relevant backend surfaces:

| Area | Routes |
| --- | --- |
| tRPC | `/trpc/*` |
| Discover events | `/api/discover/events`, `/api/discover/events/:id` |
| Auth/session | `/api/auth/*` |
| Profile | `/api/profile/avatar`, `/api/profile/taste`, `/api/profile/default-city` |
| Weather | `/api/weather/event-summary` |
| Media/source helpers | `/api/image-proxy`, `/api/source-preview` |
| Admin tools | `/api/admin/events`, `/api/admin/admin-users`, `/api/admin/user-analytics`, `/api/admin/weather-map` |
| Health | `/health` |

The mirrored frontend tRPC type shape lives in `src/trpc/app-router.ts`; keep it aligned with `gr-backend`.

## OpenClaw Contract

OpenClaw is the private ingestion system. The app assumes events arrive through this path:

```text
source pages/APIs
  -> OpenClaw crawl, normalize, geocode, validate
  -> Turso events table
  -> gr-backend public event projection
  -> gr-frontend Discover / Plan / Map surfaces
```

Production ingestion must validate categories, taste labels, city ids, date fields, price fields, source URLs, images, and coordinates before Turso upsert. The backend is the source of truth for approved reference labels.

OpenClaw is not open-sourced in this evaluation package because it contains the proprietary ingestion approach and operational crawler history. The public repos still expose the relevant contract: event schema, API projection, reference-data validation, and frontend behavior.

## Evaluation Notes

The public package is structured around the three areas judges typically inspect:

| Evaluation area | Where to inspect |
| --- | --- |
| Product clarity and usability | `gr-frontend`, hosted app, Discover/Ask/Plan/Profile flows, waitlist page. |
| Engineering structure and completeness | `gr-backend`, `gr-architecture`, tRPC contracts, Turso/Supabase split, tests, env examples. |
| Commercial potential and scalability | `gr-architecture` system docs, waitlist/acquisition repo, Stripe subscription surface, city-based event pipeline contract. |

For the full review path, see [`gr-architecture/docs/evaluation-readiness.md`](https://github.com/gigradarapp/gr-architecture/blob/main/docs/evaluation-readiness.md).

## Production Readiness Snapshot

| Signal | Evidence |
| --- | --- |
| Live deployment | `https://gr-frontend-dev.vercel.app/` backed by the hosted Worker. |
| Real data boundary | Discover reads backend-projected Turso event rows, not hardcoded frontend fixtures. |
| Server-side secret boundary | LLM, Stripe, Supabase service-role, Turso, and OpenClaw credentials stay out of the browser. |
| Typed API integration | tRPC client and frontend route mirror live in `src/trpc/app-router.ts`. |
| Test coverage | Vitest tests cover event normalization, image resolution, Discover loading, plan/favorite caches, weather logic, Buzo agent matching, and map clustering. |
| Demo path | README `Demo Journey` gives a short end-to-end flow for judges and AI scanners. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Vite on port 5173. |
| `npm run build` | Type-check and build static assets into `dist`. |
| `npm run preview` | Preview the production build. |
| `npm test` | Run Vitest once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:location-centroids` | Validate location centroid data. |

## Deploy

Frontend deploys as a static Vite app on Vercel:

1. Build command: `npm run build`
2. Output directory: `dist`
3. Set public frontend env only:
   - `VITE_API_MODE=cloud`
   - `VITE_API_CLOUD_URL=https://<worker>.workers.dev`
4. Add the Vercel production/preview origins to backend `ALLOWED_ORIGINS`.
5. Add matching frontend and backend callback URLs in Supabase Auth settings.

Backend deploys from `gr-backend` via Cloudflare Workers. Architecture and environment details live in [`gr-architecture`](https://github.com/gigradarapp/gr-architecture).

## Public Repo Hygiene

Before making this repo public:

- Keep only `VITE_*` public config in frontend env examples.
- Do not commit `.env`, local credentials, dashboard keys, generated secret files, or private notes.
- Keep demo fallback explicit and disabled in production.
- Keep backend/OpenClaw details at the contract level unless the corresponding repo is intentionally public.
- Keep product strategy and fundraising notes outside this repository.

## Change Checklist

Before changing event, auth, billing, or admin flows:

- Check matching backend route/service/schema changes in `gr-backend`.
- Check whether Turso event shape or OpenClaw upsert validation must change.
- Keep `src/trpc/app-router.ts` aligned with backend tRPC procedures.
- Keep secrets server-side.
- Run `npm run build` and relevant tests before publishing.
