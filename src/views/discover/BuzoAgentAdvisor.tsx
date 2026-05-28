import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MessageSquareText, Send, Sparkles, Zap } from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  buzoAdvisorQuestions,
  getAdvisorRecommendationCopy,
  getMatchPercentLabel,
  recommendBuzoAgentFromAnswers,
  recommendBuzoAgentFromPrompt,
  withPromptMatchPercent,
  type AdvisorAnswers,
  type AdvisorQuestionId,
  type AdvisorRecommendation,
} from '../../config/buzoAgentAdvisor'
import { getBuzoAgent, type BuzoAgentId } from '../../config/buzoAgents'
import { api } from '../../lib/trpc'
import { getAccessToken } from '../../lib/session'

type BuzoAgentAdvisorProps = {
  onBack: () => void
  onSelect: (agentId: BuzoAgentId) => void
  /** Parent already renders a back control (e.g. change-bat header). */
  hideHeader?: boolean
}

type AdvisorMode = 'landing' | 'quiz' | 'describe' | 'result'
type MatchSource = 'quiz' | 'describe-live' | 'describe-offline'

const DESCRIBE_PLACEHOLDER =
  'Date night in Tiong Bahru, jazz or low-key — not too loud or touristy'

export function BuzoAgentAdvisor({ onBack, onSelect, hideHeader = false }: BuzoAgentAdvisorProps) {
  const matchMut = api.discover.matchAgent.useMutation()
  const describeInputRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<AdvisorMode>('landing')
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<AdvisorAnswers>({})
  const [describeInput, setDescribeInput] = useState('')
  const [describeLoading, setDescribeLoading] = useState(false)
  const [recommendation, setRecommendation] = useState<AdvisorRecommendation | null>(null)
  const [matchSource, setMatchSource] = useState<MatchSource>('quiz')

  const question = buzoAdvisorQuestions[stepIndex]
  const recommendedAgent = recommendation ? getBuzoAgent(recommendation.agentId) : null

  const resetAll = () => {
    setMode('landing')
    setStepIndex(0)
    setAnswers({})
    setDescribeInput('')
    setDescribeLoading(false)
    setRecommendation(null)
    setMatchSource('quiz')
  }

  const showResult = (next: AdvisorRecommendation, source: MatchSource) => {
    setRecommendation(next)
    setMatchSource(source)
    setMode('result')
  }

  const pickAnswer = (questionId: AdvisorQuestionId, optionId: string) => {
    const nextAnswers = { ...answers, [questionId]: optionId }
    setAnswers(nextAnswers)

    if (stepIndex >= buzoAdvisorQuestions.length - 1) {
      showResult(recommendBuzoAgentFromAnswers(nextAnswers), 'quiz')
      return
    }

    setStepIndex((current) => current + 1)
  }

  const submitDescribe = useCallback(async () => {
    const prompt = describeInput.trim()
    if (prompt.length < 3 || describeLoading) return

    setDescribeLoading(true)
    try {
      if (getAccessToken()) {
        try {
          const live = await matchMut.mutateAsync({ prompt })
          showResult(withPromptMatchPercent(prompt, live), 'describe-live')
          return
        } catch {
          /* fall through to offline matcher */
        }
      }
      showResult(recommendBuzoAgentFromPrompt(prompt), 'describe-offline')
    } finally {
      setDescribeLoading(false)
    }
  }, [describeInput, describeLoading, matchMut])

  const goBackOneStep = () => {
    if (mode === 'landing') {
      onBack()
      return
    }
    if (mode === 'result') {
      setRecommendation(null)
      setMode(matchSource === 'quiz' ? 'quiz' : 'describe')
      if (matchSource === 'quiz') {
        setStepIndex(buzoAdvisorQuestions.length - 1)
      }
      return
    }
    if (mode === 'describe') {
      setDescribeInput('')
      setMode('landing')
      return
    }
    if (stepIndex === 0) {
      setMode('landing')
      return
    }
    const previousQuestion = buzoAdvisorQuestions[stepIndex - 1]
    setAnswers((current) => {
      const next = { ...current }
      delete next[previousQuestion.id]
      return next
    })
    setStepIndex((current) => current - 1)
  }

  const backLabel =
    mode === 'landing'
      ? 'All bats'
      : mode === 'result'
        ? matchSource === 'quiz'
          ? 'Back'
          : 'Edit description'
        : mode === 'describe'
          ? 'Back'
          : stepIndex === 0
            ? 'Back'
            : 'Back'

  const focusDescribeInput = useCallback(() => {
    describeInputRef.current?.focus({ preventScroll: false })
  }, [])

  useEffect(() => {
    if (mode !== 'describe') return
    const frame = window.requestAnimationFrame(() => {
      focusDescribeInput()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusDescribeInput, mode])

  return (
    <motion.div
      className="buzo-agent-advisor"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {hideHeader && mode === 'landing' ? null : (
        <div className="buzo-agent-advisor-header">
          <button type="button" className="buzo-agent-advisor-back" onClick={goBackOneStep}>
            <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
            <span>{backLabel}</span>
          </button>
          <div className="buzo-agent-advisor-brand" aria-hidden>
            <Sparkles size={16} />
          </div>
        </div>
      )}

      <div className="buzo-agent-advisor-intro">
        <p className="buzo-agent-advisor-eyebrow">Find your bat</p>
        <h2 className="buzo-agent-advisor-title">
          {mode === 'result'
            ? 'Your bat'
            : mode === 'describe'
              ? 'Describe your night'
              : 'Which bat fits you?'}
        </h2>
        <p className="buzo-agent-advisor-sub">
          {mode === 'result'
            ? 'Buzo picked one of four bats — Echo, Shade, Blaze, or Noir.'
            : mode === 'describe'
              ? 'Tell Buzo how you want to go out. It will match you to Echo, Shade, Blaze, or Noir.'
              : mode === 'quiz'
                ? 'Three quick taps to find your bat, or describe your night in your own words below.'
                : 'You are choosing one of four bats — quick taps or your own words.'}
        </p>
      </div>

      {mode === 'landing' ? (
        <div className="buzo-agent-advisor-paths" role="list" aria-label="Find your bat">
          <button
            type="button"
            className="buzo-agent-advisor-path"
            role="listitem"
            onClick={() => {
              setStepIndex(0)
              setAnswers({})
              setMode('quiz')
            }}
          >
            <span className="buzo-agent-advisor-path-icon" aria-hidden>
              <Zap size={18} strokeWidth={2.25} />
            </span>
            <span className="buzo-agent-advisor-path-copy">
              <span className="buzo-agent-advisor-path-label">Quick picks</span>
              <span className="buzo-agent-advisor-path-sub">Three taps — then Buzo picks a bat for you</span>
            </span>
          </button>
          <button
            type="button"
            className="buzo-agent-advisor-path buzo-agent-advisor-path--agentic"
            role="listitem"
            onClick={() => setMode('describe')}
          >
            <span className="buzo-agent-advisor-path-icon" aria-hidden>
              <MessageSquareText size={18} strokeWidth={2.25} />
            </span>
            <span className="buzo-agent-advisor-path-copy">
              <span className="buzo-agent-advisor-path-label">Describe my night</span>
              <span className="buzo-agent-advisor-path-sub">
                Your words — Buzo matches you to Echo, Shade, Blaze, or Noir
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {mode === 'quiz' && question ? (
        <>
          <div className="buzo-agent-advisor-progress" aria-hidden>
            {buzoAdvisorQuestions.map((entry, index) => (
              <span
                key={entry.id}
                className={[
                  'buzo-agent-advisor-progress-dot',
                  index <= stepIndex && 'buzo-agent-advisor-progress-dot--active',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              className="buzo-agent-advisor-step"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <h3 className="buzo-agent-advisor-question">{question.prompt}</h3>
              <div className="buzo-agent-advisor-options" role="list">
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="buzo-agent-advisor-option"
                    role="listitem"
                    onClick={() => pickAnswer(question.id, option.id)}
                  >
                    <span className="buzo-agent-advisor-option-label">{option.label}</span>
                    <span className="buzo-agent-advisor-option-sub">{option.sub}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <button type="button" className="buzo-agent-advisor-switch" onClick={() => setMode('describe')}>
            Or describe your night in your own words
          </button>
        </>
      ) : null}

      {mode === 'describe' ? (
        <div className="buzo-agent-advisor-describe">
          <label className="buzo-agent-advisor-describe-label" htmlFor="buzo-agent-describe-input">
            What kind of night do you want?
          </label>
          <textarea
            ref={describeInputRef}
            id="buzo-agent-describe-input"
            className="buzo-agent-advisor-describe-input"
            placeholder={DESCRIBE_PLACEHOLDER}
            value={describeInput}
            onChange={(e) => setDescribeInput(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              e.stopPropagation()
              focusDescribeInput()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submitDescribe()
              }
            }}
            rows={4}
            autoComplete="off"
            autoCorrect="on"
            spellCheck
            enterKeyHint="done"
            inputMode="text"
          />
          <button
            type="button"
            className="buzo-agent-advisor-describe-send"
            disabled={describeInput.trim().length < 3 || describeLoading}
            onClick={() => void submitDescribe()}
          >
            {describeLoading ? (
              'Finding your bat...'
            ) : (
              <>
                <Send size={16} strokeWidth={2.25} aria-hidden />
                <span>Find my bat</span>
              </>
            )}
          </button>
          <button type="button" className="buzo-agent-advisor-switch" onClick={() => setMode('quiz')}>
            Prefer quick taps instead?
          </button>
        </div>
      ) : null}

      {mode === 'result' && recommendation && recommendedAgent ? (
        <motion.div
          className="buzo-agent-advisor-result"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {matchSource !== 'quiz' ? (
            <p
              className={
                matchSource === 'describe-live'
                  ? 'buzo-agent-advisor-result-source buzo-agent-advisor-result-source--live'
                  : 'buzo-agent-advisor-result-source buzo-agent-advisor-result-source--offline'
              }
            >
              {matchSource === 'describe-live' ? 'Matched from your words' : 'Offline match from your words'}
            </p>
          ) : null}
          <article
            className="buzo-agent-advisor-result-card"
            style={{ '--agent-accent': recommendedAgent.accent } as CSSProperties}
          >
            <span className="buzo-agent-advisor-result-glyph" aria-hidden>
              {recommendedAgent.glyph}
            </span>
            <div className="buzo-agent-advisor-result-copy">
              <div className="buzo-agent-advisor-result-top">
                <span className="buzo-agent-advisor-result-name">{recommendedAgent.name}</span>
                <span
                  className="buzo-agent-advisor-result-match"
                  aria-label={`${recommendation.matchPercent}% match. ${getMatchPercentLabel(recommendation.matchPercent)}.`}
                >
                  <span className="buzo-agent-advisor-result-match-value">
                    {recommendation.matchPercent}%
                  </span>
                  <span className="buzo-agent-advisor-result-match-label">match</span>
                </span>
              </div>
              <span className="buzo-agent-advisor-result-title">{recommendedAgent.title}</span>
              <p className="buzo-agent-advisor-result-reason">
                {getAdvisorRecommendationCopy(recommendation)}
              </p>
            </div>
          </article>
          <button
            type="button"
            className="buzo-agent-advisor-choose"
            onClick={() => onSelect(recommendedAgent.id)}
          >
            Pick {recommendedAgent.name}
          </button>
          <button type="button" className="buzo-agent-advisor-retry" onClick={resetAll}>
            Start over
          </button>
        </motion.div>
      ) : null}
    </motion.div>
  )
}
