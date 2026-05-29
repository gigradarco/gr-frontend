# gr-frontend

Buzo frontend for GigRadar.

This repo is the Vercel-hosted React/Vite client. It should stay thin: render the mobile-web experience, call `gr-backend`, and avoid owning business secrets or database authority.

For product strategy, pitch narrative, data model, and architecture docs, use `../gr-north-star`. This README is mainly for operating and changing the frontend safely.

Last scanned against the local workspace on 2026-05-29.

## Table of Contents

- [System Context](#system-context)
- [What Matters Here](#what-matters-here)
- [Frontend Features](#frontend-features)
- [Frontend Technology](#frontend-technology)
- [Local Development](#local-development)
- [Frontend Environment](#frontend-environment)
- [Backend Contract](#backend-contract)
- [OpenClaw Contract](#openclaw-contract)
- [Scripts](#scripts)
- [Assets](#assets)
- [Deploy](#deploy)
- [Change Checklist](#change-checklist)

## System Context

```text
gr-frontend  ->  gr-backend  ->  Supabase
              ->              ->  Turso
              ->              ->  Stripe / OpenAI / data.gov.sg

gr-openclaw  ->  Turso events
gr-openclaw  ->  gr-backend internal reference-data API
```

| Workspace | Responsibility |
| --- | --- |
| `gr-frontend` | Browser UI, routing, client state, maps, admin screens, public frontend config. |
| `gr-backend` | API boundary, auth/session, tRPC, REST routes, secrets, Supabase, Turso, Stripe, OpenAI, weather cache. |
| `gr-openclaw` | Event crawling, normalization, validation, and Turso upserts. |
| `gr-north-star` | Product/market/architecture/business source of context. |

## What Matters Here

- The frontend calls the backend; it should not talk directly to Turso, Stripe secrets, OpenAI secrets, or Supabase service-role APIs.
- Event listings are Turso-backed through `gr-backend`. Supabase `public.events` is not the runtime source of truth.
- Supabase is for auth and lightweight app data: profiles, admin access, reference data, taste selections, badges, avatar storage, billing tier, and event plans.
- OpenClaw writes crawled event rows into Turso and validates categories/taste labels against backend reference-data endpoints.
- Demo data is only a local/debug fallback, not a production dependency.

## Frontend Features

This frontend covers the main Buzo mobile-web app, grouped by the five product surfaces below.

### discover

1. Mobile-first Discover tab entry point with shared app shell navigation, light/dark theme support, overlays, sheets, transitions, loading states, empty states, and error states.
2. Live event discovery feed backed by Turso event data through `gr-backend`.
3. Demo/auto fallback controls for local development, with production fallback disabled by default.
4. Event card feed with carousel/card navigation, load-more pagination, and frontend render caps.
5. Event filters for date, category, city/location, and supported feed dimensions.
6. Event image resolution, image probing, fallback imagery, and image proxy handling.
7. Event detail views, source preview hooks, share sheet, save/favorite actions, and planned/going intent actions.
8. Favorites tab and favorite detail cache for saved-event browsing.
9. Buzo agent advisor/picker surfaces used from Discover for recommendation personality and prompt routing.
10. Map-based discovery for events with valid venue coordinates.
11. MapLibre GL + `react-map-gl` Discover map with theme-aware vector basemaps.
12. `supercluster`-backed marker grouping with compact count bubbles at low/default zoom.
13. Dense-area marker decluttering so CBD-style clusters remain readable without merging everything into one blob.
14. Zoom behavior parity: zoomed-out markers collapse into grouped counts; zoomed-in markers spill into full event pills.
15. City-aware default center/zoom from `discover-map-defaults`.
16. Custom map controls for zoom in, zoom out, and reset.
17. Pin/card selection sync: selecting a card or pin focuses the map and event carousel.
18. Secondary Leaflet map usage remains for non-Discover map previews and weather/admin map surfaces.

### ask-buzo

1. Authenticated Ask Buzo chat entry point.
2. Backend tRPC-first recommendation/chat path with legacy serverless proxy fallback support.
3. Agent preference helpers for selecting and persisting the Buzo recommendation personality.
4. Event recommendation responses that can point users back into Discover events.
5. Typed tRPC client setup, timeout handling, and session-aware frontend API helpers.

### plan

1. Plan tab hub for upcoming and past event planning.
2. Scheduled events screen, plan event detail, plan review, and cancellation confirmation flows.
3. Plan explore surfaces for finding and reviewing events from planning context.
4. Weather-aware planning screens, weather alerts, event weather summaries, and date horizon logic.
5. Weather formatting, weather icon/glyph utilities, advisory logic, and map-layer helpers.
6. Event plan cache and frontend helpers around plan detail state.
7. Going/planned feedback patterns, including celebration UI.

### profile

1. Welcome and welcome-back screens for signed-out and returning users.
2. Supabase-backed auth/session hydration through frontend-safe API helpers.
3. Sign-in sheet and account handoff flows.
4. Signup onboarding flow for city, taste, and preference collection.
5. Location city picker and onboarding geo-preview map.
6. Last-used account, onboarding completion, and auth sync helpers.
7. Profile home screen and profile subsections.
8. Taste identity and preference management.
9. Avatar upload, resize/crop, cache, and storage config.
10. Reputation, badges, buzz points, and account-level progress surfaces.
11. Subscription/pricing surface, feedback entry points, profile settings, and account controls.

### admin

1. Admin route guard and admin home workspace.
2. Event list/admin event inspection surfaces.
3. Admin user access management.
4. User analytics dashboard.
5. Admin weather map diagnostics.
6. Design theme review pages for visual system checks.
7. Shared config for routes, tab navigation, pricing, profile settings, plan surfaces, favorites, discover filters, and event lists.
8. Unit tests for event normalization, Discover filters, weather logic, image resolution/proxy behavior, plan/favorite caches, agent matching, and map clustering.

## Frontend Technology

| Technology | Used for |
| --- | --- |
| React 19 | Component model for the app shell, screens, overlays, admin pages, and interactive UI. |
| TypeScript | Typed frontend domain models, config, API mappers, hooks, and tests. |
| Vite | Local dev server, build pipeline, env loading, and local proxy to `gr-backend`. |
| React Router 7 | Browser routing, tab/deep-link routing, admin route protection, and redirects. |
| TanStack Query | Server-state caching and invalidation around tRPC calls. |
| tRPC client | Typed calls into `gr-backend` for Ask Buzo, plans, profile, billing, and related app operations. |
| Zustand | Client-side shell/app state such as tabs, auth hydration, overlays, theme, favorites, onboarding, and UI flags. |
| Framer Motion | Sheet transitions, screen overlays, and app-shell motion. |
| MapLibre, react-map-gl, supercluster | Discover map rendering, map controls, and clustered event pins. |
| Leaflet / React Leaflet | Secondary map surfaces and map previews. |
| Lucide React | App and admin iconography. |
| Zod | Shared validation/mirroring around API-facing types and tRPC shape definitions. |
| Vitest | Unit tests for event mapping, filters, weather logic, image resolution, and agent matching helpers. |

## Local Development

Start the backend first:

```bash
cd ../gr-backend
npm install
cp .dev.vars.example .dev.vars
npm run check:env
npm run db:migrate # when setting up/updating Supabase schema
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

In local mode, keep `VITE_API_LOCAL_URL` empty unless you intentionally need direct Worker calls. `vite.config.ts` proxies `/trpc`, `/health`, and configured `/api/...` prefixes to `http://127.0.0.1:8787`.

## Frontend Environment

Copy `.env.example` to `.env`.

Important variables:

| Variable | Notes |
| --- | --- |
| `VITE_API_MODE` | `local` for Vite proxy, `cloud` for hosted Worker. |
| `VITE_API_LOCAL_URL` | Empty means same-origin Vite proxy. |
| `VITE_API_CLOUD_URL` | Hosted `gr-backend` Worker URL for Vercel/prod. |
| `VITE_DISCOVER_EVENTS_SOURCE` | `live`, `demo`, or `auto`. Use `live` for real app flows. |
| `VITE_DISCOVER_EVENTS_ALLOW_DEMO_FALLBACK` | Keep `false` in production. |
| `VITE_MAP_STYLE_URL_DARK`, `VITE_MAP_STYLE_URL_LIGHT`, `VITE_MAPTILER_KEY` | Optional map style overrides. |
| `GOOGLE_MAPS_EMBED_KEY` | Public browser key for Maps Embed only; restrict by HTTP referrer. |
| `VITE_OPENAI_PROXY_URL` | Optional legacy/fallback serverless proxy. Primary Ask Buzo flow uses backend tRPC. |

Do not put Supabase service-role, Turso, Stripe secret, or OpenAI secret keys in frontend env.

## Backend Contract

`gr-backend` is the main contract for this app.

Frontend-relevant API areas:

| Area | Routes |
| --- | --- |
| tRPC | `/trpc/*` |
| Discover events | `/api/discover/events`, `/api/discover/events/:id` |
| Admin tools | `/api/admin/events`, `/api/admin/admin-users`, `/api/admin/user-analytics`, `/api/admin/weather-map` |
| Auth/session | `/api/auth/*` |
| Profile | `/api/profile/*` |
| Weather/image/source helpers | `/api/weather/event-summary`, `/api/image-proxy`, `/api/source-preview` |
| Health | `/health` |

Backend secrets belong in `../gr-backend/.dev.vars` locally and Cloudflare Worker secrets in hosted environments.

## OpenClaw Contract

`gr-openclaw` owns ingestion. The frontend should assume event rows arrive through this path:

```text
source pages/APIs -> gr-openclaw -> validation -> Turso -> gr-backend -> gr-frontend
```

Useful checks:

```bash
cd ../gr-openclaw
python3 scripts/check_openclaw_reference_data.py
docker compose run --rm openclaw-test
docker compose run --rm openclaw-upsert-dry-run
```

For production ingestion, `check_openclaw_reference_data.py` should report a `reference_data_source` beginning with `backend:`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Vite on port 5173. |
| `npm run build` | Type-check and build static assets into `dist`. |
| `npm run preview` | Preview the built app. |
| `npm test` | Run Vitest once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:location-centroids` | Validate location centroid data. |

## Assets

Static assets live under `public/assets/`.

Examples:

- `public/assets/logo/`
- `public/assets/mascot/`
- Referenced as `/assets/<path>`, for example `/assets/logo/b-logo.svg`.

## Deploy

Frontend deploys as a static Vite app on Vercel:

1. Build command: `npm run build`
2. Output directory: `dist`
3. Set public frontend env only:
   - `VITE_API_MODE=cloud`
   - `VITE_API_CLOUD_URL=https://<your-worker>.workers.dev`
4. Add the Vercel production/preview origins to `ALLOWED_ORIGINS` in `gr-backend`.
5. Add the matching frontend and backend callback URLs in Supabase Auth settings.

Backend deploys from `../gr-backend` via Cloudflare Workers. OpenClaw should run on the ingestion host/VPS and write reviewed upsert reports.

## Change Checklist

Before changing event, auth, or admin flows:

- Check matching backend route/service/schema changes in `../gr-backend`.
- Check whether Turso event shape or OpenClaw upsert validation must change.
- Keep `src/trpc/app-router.ts` aligned with backend tRPC procedures.
- Keep secrets server-side.
- Keep demo fallback intentional and disabled in production.
