import type { BuzoAgentId } from '../../config/buzoAgents'

type Props = {
  agentId: BuzoAgentId
  size?: number
  className?: string
}

type InnerProps = { size: number }

// Echo — Social Navigator · Blue · Big DJ headphones + bilateral sound waves
function EchoBat({ size }: InnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Fixed background frame */}
      <circle cx="32" cy="32" r="30" fill="#1e3a5f" />

      <g className="bat-float bat-echo-float">
        {/* Wings */}
        <path d="M32 36 C26 32 14 28 4 32 C4 40 14 44 26 42 Z" fill="#2563eb" />
        <path d="M32 36 C38 32 50 28 60 32 C60 40 50 44 38 42 Z" fill="#2563eb" />
        {/* Body */}
        <ellipse cx="32" cy="40" rx="8" ry="7" fill="#1d4ed8" />
        {/* Head */}
        <circle cx="32" cy="26" r="10" fill="#2563eb" />
        {/* Ears */}
        <path d="M25 20 L22 11 L30 19 Z" fill="#2563eb" />
        <path d="M39 20 L42 11 L34 19 Z" fill="#2563eb" />
        {/* Head highlight */}
        <circle cx="31" cy="25" r="7" fill="#3b82f6" fillOpacity="0.22" />
        {/* Eyes */}
        <circle cx="27" cy="25" r="3.5" fill="white" />
        <circle cx="37" cy="25" r="3.5" fill="white" />
        <circle cx="28" cy="25" r="2" fill="#1e40af" />
        <circle cx="38" cy="25" r="2" fill="#1e40af" />
        <circle cx="29" cy="24" r="0.8" fill="white" />
        <circle cx="39" cy="24" r="0.8" fill="white" />

        {/* ── HEADPHONES: thick sky-blue band + big chunky cups ── */}
        {/* Band — bright sky blue, thick, arcs well above ears */}
        <path d="M18 24 Q32 9 46 24" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        {/* Left cup — large, sky blue, clearly distinct from body */}
        <rect className="bat-echo-cup" x="11" y="19" width="12" height="14" rx="6" fill="#0ea5e9" />
        {/* Right cup */}
        <rect className="bat-echo-cup bat-echo-cup-r" x="41" y="19" width="12" height="14" rx="6" fill="#0ea5e9" />
        {/* Cup highlights — give them a 3-D speaker feel */}
        <rect x="12.5" y="20.5" width="4.5" height="5" rx="2.2" fill="#bae6fd" fillOpacity="0.55" />
        <rect x="42.5" y="20.5" width="4.5" height="5" rx="2.2" fill="#bae6fd" fillOpacity="0.55" />
        <circle cx="17" cy="29" r="3.5" fill="none" stroke="#bae6fd" strokeWidth="0.9" strokeOpacity="0.4" />
        <circle cx="47" cy="29" r="3.5" fill="none" stroke="#bae6fd" strokeWidth="0.9" strokeOpacity="0.4" />

        {/* ── SOUND WAVES — both sides (echolocation!) ── */}
        <path className="bat-echo-wave-1" d="M8 26 Q6 31 8 36" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" />
        <path className="bat-echo-wave-2" d="M4 23 Q1 31 4 39" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" />
        {/* Mirror on right side */}
        <path className="bat-echo-wave-1" d="M56 26 Q58 31 56 36" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" />
        <path className="bat-echo-wave-2" d="M60 23 Q63 31 60 39" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" />

        {/* Smile */}
        <path d="M29 31 Q32 34 35 31" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// Shade — Hidden Gem Hunter · Purple · Gold-framed shades + diamond gem
function ShadeBat({ size }: InnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Fixed background frame */}
      <circle cx="32" cy="32" r="30" fill="#1e1b4b" />

      <g className="bat-float bat-shade-float">
        {/* Wings */}
        <path d="M32 36 C26 32 14 28 4 32 C4 40 14 44 26 42 Z" fill="#7c3aed" />
        <path d="M32 36 C38 32 50 28 60 32 C60 40 50 44 38 42 Z" fill="#7c3aed" />
        {/* Body */}
        <ellipse cx="32" cy="40" rx="8" ry="7" fill="#6d28d9" />
        {/* Head */}
        <circle cx="32" cy="26" r="10" fill="#7c3aed" />
        {/* Ears */}
        <path d="M25 20 L22 11 L30 19 Z" fill="#7c3aed" />
        <path d="M39 20 L42 11 L34 19 Z" fill="#7c3aed" />
        {/* Head highlight */}
        <circle cx="31" cy="25" r="7" fill="#8b5cf6" fillOpacity="0.2" />

        {/* ── SUNGLASSES: wide dark lenses with bold gold frame ── */}
        {/* Dark lenses — almost-black fill so eyes are invisible */}
        <rect x="17" y="21" width="14" height="10" rx="4.5" fill="#0c0a09" />
        <rect x="32" y="21" width="14" height="10" rx="4.5" fill="#0c0a09" />
        {/* Gold frames — strong contrast against the purple bat */}
        <rect x="17" y="21" width="14" height="10" rx="4.5" fill="none" stroke="#f59e0b" strokeWidth="2" />
        <rect x="32" y="21" width="14" height="10" rx="4.5" fill="none" stroke="#f59e0b" strokeWidth="2" />
        {/* Gold bridge */}
        <path d="M31 26 L32 26" stroke="#f59e0b" strokeWidth="2.8" strokeLinecap="round" />
        {/* Gold temple arms extending outward */}
        <path d="M17 26 L10 25" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M46 26 L53 25" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
        {/* Purple lens tint sheen */}
        <path d="M19 23 L25 23" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <path d="M34 23 L40 23" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />

        {/* ── HIDDEN GEM: diamond in upper-right corner ── */}
        <path className="bat-shade-gem" d="M51 8 L55 12 L51 17 L47 12 Z" fill="#e9d5ff" fillOpacity="0.9" />
        {/* Top facet catches light */}
        <path d="M51 8 L55 12 L51 12 Z" fill="white" fillOpacity="0.35" />

        {/* Smirk */}
        <path d="M29 33 Q32 36 35 33" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />

        {/* Stars */}
        <path
          className="bat-shade-star"
          d="M8 16 L9 13 L10 16 L13 15 L10 17 L11 20 L9 18 L7 20 L8 17 L5 15 Z"
          fill="#c4b5fd"
        />
        <circle className="bat-shade-dot-1" cx="55" cy="13" r="1.8" fill="#c4b5fd" />
        <circle className="bat-shade-dot-2" cx="59" cy="19" r="1.2" fill="#c4b5fd" />
        <circle className="bat-shade-dot-3" cx="52" cy="20" r="1" fill="#c4b5fd" />
      </g>
    </svg>
  )
}

// Blaze — Peak Energy Guide · Orange · Flame ears + lightning bolts
function BlazeBat({ size }: InnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Fixed background frame */}
      <circle cx="32" cy="32" r="30" fill="#431407" />
      {/* Energy glow — pulses independently */}
      <circle className="bat-blaze-glow" cx="32" cy="32" r="24" fill="#f97316" />

      {/* Floating bat body */}
      <g className="bat-float bat-blaze-float">
        {/* Wings */}
        <path d="M32 36 C26 32 14 28 4 32 C4 40 14 44 26 42 Z" fill="#ea580c" />
        <path d="M32 36 C38 32 50 28 60 32 C60 40 50 44 38 42 Z" fill="#ea580c" />
        {/* Body */}
        <ellipse cx="32" cy="40" rx="8" ry="7" fill="#c2410c" />
        {/* Head */}
        <circle cx="32" cy="26" r="10" fill="#ea580c" />
        {/* Flame ear tips — dance */}
        <path
          className="bat-blaze-flame-l"
          d="M22 12 C20 9 24 7 21 3 C25 6 23 10 26 12"
          fill="#fbbf24"
          fillOpacity="0.85"
        />
        <path
          className="bat-blaze-flame-r"
          d="M42 12 C44 9 40 7 43 3 C39 6 41 10 38 12"
          fill="#fbbf24"
          fillOpacity="0.85"
        />
        {/* Ears */}
        <path d="M25 20 L22 11 L30 19 Z" fill="#ea580c" />
        <path d="M39 20 L42 11 L34 19 Z" fill="#ea580c" />
        {/* Head highlight */}
        <circle cx="31" cy="25" r="7" fill="#f97316" fillOpacity="0.22" />
        {/* Wild eyes */}
        <circle cx="27" cy="25" r="3.5" fill="white" />
        <circle cx="37" cy="25" r="3.5" fill="white" />
        <circle cx="28" cy="25.5" r="2" fill="#7c2d12" />
        <circle cx="38" cy="25.5" r="2" fill="#7c2d12" />
        <circle cx="29" cy="24.5" r="0.8" fill="white" />
        <circle cx="39" cy="24.5" r="0.8" fill="white" />
        {/* Big grin */}
        <path d="M27 32 Q32 37 37 32" stroke="#fed7aa" strokeWidth="2" strokeLinecap="round" />
        {/* Lightning bolts — flicker */}
        <path
          className="bat-blaze-bolt-l"
          d="M13 15 L10 22 L14 21 L11 28"
          stroke="#fbbf24"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="bat-blaze-bolt-r"
          d="M51 15 L54 22 L50 21 L53 28"
          stroke="#fbbf24"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Energy sparks */}
        <circle className="bat-blaze-spark-1" cx="9" cy="38" r="1.5" fill="#fbbf24" />
        <circle className="bat-blaze-spark-2" cx="55" cy="38" r="1.5" fill="#fbbf24" />
        <circle className="bat-blaze-spark-3" cx="6" cy="31" r="1" fill="#fbbf24" />
        <circle className="bat-blaze-spark-4" cx="58" cy="31" r="1" fill="#fbbf24" />
      </g>
    </svg>
  )
}

// Noir — Intimate Curator · Teal · Monocle + large bow-tie + crescent moon
function NoirBat({ size }: InnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Fixed background frame */}
      <circle cx="32" cy="32" r="30" fill="#042f2e" />

      <g className="bat-float bat-noir-float">
        {/* Wings */}
        <path d="M32 36 C26 32 14 28 4 32 C4 40 14 44 26 42 Z" fill="#0f766e" />
        <path d="M32 36 C38 32 50 28 60 32 C60 40 50 44 38 42 Z" fill="#0f766e" />
        {/* Body */}
        <ellipse cx="32" cy="40" rx="8" ry="7" fill="#0d9488" />
        {/* Head */}
        <circle cx="32" cy="26" r="10" fill="#0f766e" />
        {/* Ears */}
        <path d="M25 20 L22 11 L30 19 Z" fill="#0f766e" />
        <path d="M39 20 L42 11 L34 19 Z" fill="#0f766e" />
        {/* Head highlight */}
        <circle cx="31" cy="25" r="7" fill="#14b8a6" fillOpacity="0.18" />

        {/* ── LEFT EYE: fully open — monocle replaces the half-lid ── */}
        <circle cx="27" cy="27" r="3.5" fill="white" fillOpacity="0.9" />
        <circle cx="27" cy="28" r="1.8" fill="#115e59" />
        <circle cx="28" cy="26.5" r="0.7" fill="white" />

        {/* ── RIGHT EYE: half-lidded (sophisticated asymmetry) ── */}
        <circle cx="37" cy="27" r="3.5" fill="white" fillOpacity="0.9" />
        <path d="M33.5 27 Q37 23 40.5 27" fill="#0f766e" />
        <circle cx="37" cy="28" r="1.8" fill="#115e59" />
        <circle cx="38" cy="26.5" r="0.7" fill="white" />

        {/* ── MONOCLE on left eye: the most distinctive feature ── */}
        {/* Monocle ring — bright near-white so it reads instantly */}
        <circle cx="27" cy="27" r="5.5" fill="none" stroke="#ccfbf1" strokeWidth="1.8" />
        {/* Monocle chain — curves elegantly down to the body */}
        <path d="M31.5 31.5 C32.5 34 33 36 32 38" stroke="#5eead4" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="38.2" r="1.3" fill="#5eead4" fillOpacity="0.65" />

        {/* Knowing smile */}
        <path d="M29 33 Q32 35 35 33" stroke="#5eead4" strokeWidth="1.5" strokeLinecap="round" />

        {/* ── BOW-TIE: large, clearly visible ── */}
        {/* Left wing */}
        <path d="M26 38 L19 34 L19 43 Z" fill="#0d9488" />
        {/* Right wing */}
        <path d="M38 38 L45 34 L45 43 Z" fill="#0d9488" />
        {/* Center knot */}
        <circle cx="32" cy="38" r="3.2" fill="#14b8a6" />
        <circle cx="32" cy="38" r="1.5" fill="#0d9488" />

        {/* ── CRESCENT MOON: bigger and more visible ── */}
        <path
          className="bat-noir-moon"
          d="M47 8 C55 8 60 14 60 21 C53 21 47 15 47 8 Z"
          fill="#99f6e4"
          fillOpacity="0.78"
        />

        {/* Night dots */}
        <circle className="bat-noir-dot-1" cx="7" cy="13" r="1.3" fill="#5eead4" />
        <circle className="bat-noir-dot-2" cx="11" cy="8" r="0.9" fill="#5eead4" />
        <circle className="bat-noir-dot-3" cx="4" cy="20" r="0.9" fill="#5eead4" />
        <circle className="bat-noir-dot-1" cx="14" cy="16" r="0.7" fill="#5eead4" />
      </g>
    </svg>
  )
}

export function BuzoAgentCharacter({ agentId, size = 64, className }: Props) {
  const el = (() => {
    switch (agentId) {
      case 'echo':  return <EchoBat size={size} />
      case 'shade': return <ShadeBat size={size} />
      case 'blaze': return <BlazeBat size={size} />
      case 'noir':  return <NoirBat size={size} />
    }
  })()
  if (className) {
    return <span className={className}>{el}</span>
  }
  return el
}
