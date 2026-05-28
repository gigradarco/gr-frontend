# UI Tech Stack (Mobile-Web-First)

## Goal
Build Buzo as a fast, mobile-first web app that feels app-like on phones and scales cleanly to desktop.

## Recommended Default Stack (UI Only)
- **Framework**: `Vite` + `React` + `TypeScript`
- **Styling**: `Tailwind CSS` (mobile-first utility classes)
- **Component System**: `shadcn/ui` + `Radix UI` (accessible, customizable primitives)
- **State (client)**: `Zustand` (lightweight global UI state)
- **Server State / Fetching**: `TanStack Query`
- **Forms & Validation**: `React Hook Form` + `Zod`
- **Animation**: `Framer Motion` (for feed transitions and interactions)
- **Icons**: `Lucide React`
- **PWA Capability**: `vite-plugin-pwa` (installable mobile-web experience)

## Why This Stack
- Fast MVP velocity with strong DX.
- Mobile responsiveness is easy to enforce with Tailwind.
- Accessible UI building blocks out of the box.
- Easy to evolve from MVP to production without major rewrites.

## Mobile-Responsive Standards
- Design for **360px width first**, then scale up.
- Use a baseline breakpoint strategy:
  - `sm` (>=640)
  - `md` (>=768)
  - `lg` (>=1024)
- Keep touch targets at least **44x44px**.
- Use bottom navigation on mobile and sidebar/top nav on larger screens.
- Prefer fluid typography (`clamp`) for headings and key text.

## Optional Add-Ons (If Needed)
- **Discover Map UI**: `MapLibre GL JS` + `react-map-gl` + `supercluster` with CARTO vector style JSON defaults; Leaflet remains only for secondary preview/admin maps.
- **Carousels / gestures**: `Embla Carousel`
- **Charts / profile analytics**: `Recharts`
- **Error tracking (frontend)**: `Sentry`

## UI MVP Recommendation (Lean)
If you want the smallest practical setup for now:
- `Vite` + `React` + `TypeScript`
- `Tailwind CSS`
- `shadcn/ui`
- `TanStack Query`
- `Zustand`
- `vite-plugin-pwa`

This is enough to build the social feed, profiles, and event detail flows in a mobile-first responsive way.
