import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

const PARTY_EMOJIS = ['🎉', '🥳', '🎊', '✨', '⭐️', '💫', '🎈', '🙌', '💖', '🔥', '🪩', '💃'] as const
const SPARKS = ['✨', '⭐', '💫', '✦', '⚡', '★'] as const

const GOING_CELEBRATION_EVENT = 'buzo:going-celebration'
const CELEBRATION_DURATION_MS = 2800

type CelebrationBurst = {
  id: number
  originX: number
  originY: number
}

type GoingCelebrationDetail = {
  anchorEl?: HTMLElement | null
}

type CelebrationParticle = {
  id: string
  emoji: string
  originX: number
  originY: number
  dx: number
  dy: number
  rotate: number
  delay: number
  duration: number
  size: number
  isSpark: boolean
  isLarge: boolean
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pickEmoji(index: number, useSpark: boolean) {
  if (useSpark) return SPARKS[index % SPARKS.length]
  return PARTY_EMOJIS[index % PARTY_EMOJIS.length]
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function originFromAnchor(anchorEl?: HTMLElement | null): { originX: number; originY: number } {
  if (typeof window === 'undefined' || !anchorEl) {
    return { originX: 50, originY: 68 }
  }
  const rect = anchorEl.getBoundingClientRect()
  return {
    originX: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
    originY: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
  }
}

function createRadialBurst(
  prefix: string,
  originX: number,
  originY: number,
  count: number,
  minDistance: number,
  maxDistance: number,
): CelebrationParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const useSpark = index % 3 === 0
    const angle = randomBetween(0, Math.PI * 2)
    const distance = randomBetween(minDistance, maxDistance)
    const isLarge = index % 7 === 0
    return {
      id: `${prefix}-${index}`,
      emoji: pickEmoji(index, useSpark),
      originX,
      originY,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rotate: randomBetween(-120, 120),
      delay: randomBetween(0, 0.28),
      duration: randomBetween(1.5, 2.6),
      size: isLarge ? randomBetween(1.35, 1.85) : randomBetween(0.85, 1.35),
      isSpark: useSpark,
      isLarge,
    }
  })
}

function createRainConfetti(count: number): CelebrationParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const useSpark = index % 5 === 0
    const isLarge = index % 9 === 0
    return {
      id: `rain-${index}`,
      emoji: pickEmoji(index, useSpark),
      originX: randomBetween(4, 96),
      originY: randomBetween(-8, -2),
      dx: randomBetween(-80, 80),
      dy: randomBetween(typeof window !== 'undefined' ? window.innerHeight * 0.75 : 520, typeof window !== 'undefined' ? window.innerHeight * 1.05 : 720),
      rotate: randomBetween(-180, 180),
      delay: randomBetween(0, 0.55),
      duration: randomBetween(2, 3.2),
      size: isLarge ? randomBetween(1.2, 1.7) : randomBetween(0.75, 1.25),
      isSpark: useSpark,
      isLarge,
    }
  })
}

function createFullPageCelebration(anchorX: number, anchorY: number): CelebrationParticle[] {
  const screenOrigins = [
    { x: 14, y: 16 },
    { x: 86, y: 16 },
    { x: 14, y: 78 },
    { x: 86, y: 78 },
  ]

  return [
    ...createRadialBurst('btn', anchorX, anchorY, 26, 80, 260),
    ...createRadialBurst('center', 50, 45, 14, 60, 200),
    ...screenOrigins.flatMap((origin, originIndex) =>
      createRadialBurst(`edge-${originIndex}`, origin.x, origin.y, 6, 50, 160),
    ),
    ...createRainConfetti(20),
  ]
}

export function fireGoingCelebration(anchorEl?: HTMLElement | null) {
  if (prefersReducedMotion()) return
  window.dispatchEvent(
    new CustomEvent<GoingCelebrationDetail>(GOING_CELEBRATION_EVENT, {
      detail: { anchorEl },
    }),
  )
}

function BurstLayer({ burst }: { burst: CelebrationBurst }) {
  const particles = useMemo(
    () => createFullPageCelebration(burst.originX, burst.originY),
    [burst.id, burst.originX, burst.originY],
  )

  return createPortal(
    <div className="going-celebration" aria-hidden>
      <motion.div
        className="going-celebration-flash"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.28, 0.08, 0] }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      <motion.div
        className="going-celebration-wave"
        style={{ left: `${burst.originX}%`, top: `${burst.originY}%` }}
        initial={{ scale: 0.2, opacity: 0.55 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="going-celebration-wave going-celebration-wave--delayed"
        style={{ left: `${burst.originX}%`, top: `${burst.originY}%` }}
        initial={{ scale: 0.15, opacity: 0.25 }}
        animate={{ scale: 4.8, opacity: 0 }}
        transition={{ duration: 1.05, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      />
      {particles.map((particle) => (
        <motion.span
          key={`${burst.id}-${particle.id}`}
          className={[
            particle.isSpark ? 'going-celebration-spark' : 'going-celebration-particle',
            particle.isLarge ? 'going-celebration-particle--large' : '',
          ].filter(Boolean).join(' ')}
          style={{ left: `${particle.originX}%`, top: `${particle.originY}%` }}
          initial={{
            x: '-50%',
            y: '-50%',
            opacity: 0,
            scale: 0.1,
            rotate: 0,
          }}
          animate={{
            x: `calc(-50% + ${particle.dx}px)`,
            y: `calc(-50% + ${particle.dy}px)`,
            opacity: [0, 1, 1, 0.85, 0],
            scale: [0.1, particle.size, particle.size, particle.size * 0.85, 0.25],
            rotate: particle.rotate,
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {particle.emoji}
        </motion.span>
      ))}
    </div>,
    document.body,
  )
}

export function GoingCelebrationHost() {
  const [burst, setBurst] = useState<CelebrationBurst | null>(null)

  useEffect(() => {
    const onCelebrate = (event: Event) => {
      const custom = event as CustomEvent<GoingCelebrationDetail>
      const origin = originFromAnchor(custom.detail?.anchorEl)
      setBurst({ id: Date.now(), ...origin })
    }

    window.addEventListener(GOING_CELEBRATION_EVENT, onCelebrate)
    return () => window.removeEventListener(GOING_CELEBRATION_EVENT, onCelebrate)
  }, [])

  useEffect(() => {
    if (!burst) return
    const timer = window.setTimeout(() => setBurst(null), CELEBRATION_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [burst])

  if (!burst) return null
  return <BurstLayer burst={burst} />
}
