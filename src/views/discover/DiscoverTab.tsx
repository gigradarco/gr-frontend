import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Send,
  History,
  Trash2,
  X,
} from 'lucide-react'
import { useAppState } from '../../store/appStore'
import {
  discoverSuggestedPrompts,
  discoverTargetPrompt,
  events as demoEventsFallback,
} from '../../data/demoData'
import {
  type DiscoverAgentResult,
  fetchOpenAIDiscoverResult,
  getHardcodedAgentFallback,
  normalizePrompt,
} from './discoverAgent'
import { LaylaAttachDropdown } from '../../components/LaylaAttachDropdown'
import { getBuzoAgent, type BuzoAgentId } from '../../config/buzoAgents'
import {
  readSelectedBuzoAgentId,
  writeSelectedBuzoAgentId,
  clearSelectedBuzoAgentId,
} from '../../lib/buzo-agent-preference'
import { api } from '../../lib/trpc'
import { getAccessToken } from '../../lib/session'
import { handleEventImageError } from '../../lib/event-image-fallback'
import { DISCOVER_COMPOSER_CONFIG } from '../../config/discoverUi'
import type { EventItem } from '../../types'
import { BuzoAgentPicker } from './BuzoAgentPicker'
import { BuzoAgentRemoveConfirmDialog } from './BuzoAgentRemoveConfirmDialog'

type DiscoverTabProps = {
  onOpenEvent: (eventId: string) => void
  prefillPrompt: string
  onConsumePrefill: () => void
  events: EventItem[]
}

type Conversation = {
  id: string
  prompt: string
  /** User-edited title; falls back to `prompt` when empty. */
  title?: string
  status: 'idle' | 'loading' | 'done'
  resultMode: 'none' | 'hardcoded' | 'agent'
  agentReply: string
  agentEventId: string | null
  /** Built-in replies used because the assistant API did not return a result */
  usedDemoFallback: boolean
}

export function DiscoverTab({
  onOpenEvent,
  prefillPrompt,
  onConsumePrefill,
  events,
}: DiscoverTabProps) {
  const discoverMut = api.discover.recommend.useMutation()
  const discoverChipAgentPromptsNormalized = useMemo(() => {
    const jazzNorm = normalizePrompt(discoverTargetPrompt)
    return new Set(
      discoverSuggestedPrompts.map((p) => normalizePrompt(p)).filter((n) => n !== jazzNorm),
    )
  }, [])

  const hardcodedJazzEvent = useMemo(() => {
    const fromProps = events.find((e) => e.id === 'bluenote') ?? events[0]
    if (fromProps) return fromProps
    return (
      demoEventsFallback.find((e) => e.id === 'bluenote') ?? demoEventsFallback[0] ?? null
    )
  }, [events])
  const [inputValue, setInputValue] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [resultMode, setResultMode] = useState<'none' | 'hardcoded' | 'agent'>('none')
  const [agentReply, setAgentReply] = useState('')
  const [agentEventId, setAgentEventId] = useState<string | null>(null)
  const [usedDemoFallback, setUsedDemoFallback] = useState(false)

  // Chat History State
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingTitleDraft, setEditingTitleDraft] = useState('')
  const editingInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState<string | null>(null)
  const [discoverMoreOpen, setDiscoverMoreOpen] = useState(false)
  /** Thread-mode composer: user can expand for more visible typing area */
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<BuzoAgentId | null>(() =>
    readSelectedBuzoAgentId(),
  )
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false)
  const [isAgentAdvisorOpen, setIsAgentAdvisorOpen] = useState(false)
  const [showRemoveAgentConfirm, setShowRemoveAgentConfirm] = useState(false)
  const selectedAgent = useMemo(
    () => (selectedAgentId ? getBuzoAgent(selectedAgentId) : null),
    [selectedAgentId],
  )

  const tryAskingLabelId = useId()
  const requestCounter = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chipScrollerRef = useRef<HTMLDivElement | null>(null)
  const [chipScrollHints, setChipScrollHints] = useState({
    overflow: false,
    canLeft: false,
    canRight: false,
  })
  const discoverMoreRef = useRef<HTMLDivElement | null>(null)
  const agentEvent = useMemo(
    () => (agentEventId ? events.find((item) => item.id === agentEventId) ?? null : null),
    [agentEventId],
  )

  const { isDiscoverExpanded, toggleDiscoverExpanded } = useAppState()

  // Sync active view back to the current conversation
  useEffect(() => {
    if (!currentConversationId) return
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              prompt: submittedPrompt || conv.prompt,
              status,
              resultMode,
              agentReply,
              agentEventId,
              usedDemoFallback,
            }
          : conv
      )
    )
  }, [submittedPrompt, status, resultMode, agentReply, agentEventId, usedDemoFallback, currentConversationId])

  const handleSelectAgent = (agentId: BuzoAgentId) => {
    const changed = selectedAgentId !== null && selectedAgentId !== agentId
    writeSelectedBuzoAgentId(agentId)
    setSelectedAgentId(agentId)
    setIsAgentPickerOpen(false)
    if (changed) {
      handleNewChat()
    }
  }

  const openAgentPicker = () => {
    setDiscoverMoreOpen(false)
    setIsAgentAdvisorOpen(false)
    setIsAgentPickerOpen(true)
  }

  const closeAgentPicker = () => {
    setIsAgentPickerOpen(false)
    setIsAgentAdvisorOpen(false)
  }

  const requestRemoveAgent = () => {
    setDiscoverMoreOpen(false)
    setShowRemoveAgentConfirm(true)
  }

  const cancelRemoveAgent = () => {
    setShowRemoveAgentConfirm(false)
  }

  const confirmRemoveAgent = () => {
    clearSelectedBuzoAgentId()
    setSelectedAgentId(null)
    setShowRemoveAgentConfirm(false)
    closeAgentPicker()
    handleNewChat()
  }

  const handleChangeHeaderBack = () => {
    if (isAgentAdvisorOpen) {
      setIsAgentAdvisorOpen(false)
      return
    }
    closeAgentPicker()
  }

  const handleNewChat = () => {
    setInputValue('')
    setSubmittedPrompt('')
    setStatus('idle')
    setResultMode('none')
    setAgentReply('')
    setAgentEventId(null)
    setUsedDemoFallback(false)
    setCurrentConversationId(null)
    setIsDrawerOpen(false)
    setDiscoverMoreOpen(false)
    setComposerExpanded(false)
  }

  const handleSelectConversation = (conv: Conversation) => {
    setInputValue('')
    setSubmittedPrompt(conv.prompt)
    setStatus(conv.status)
    setResultMode(conv.resultMode)
    setAgentReply(conv.agentReply)
    setAgentEventId(conv.agentEventId)
    setUsedDemoFallback(conv.usedDemoFallback ?? false)
    setCurrentConversationId(conv.id)
    setIsDrawerOpen(false)
  }

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDeleteConvId(id)
  }

  const cancelPendingDelete = () => {
    setPendingDeleteConvId(null)
  }

  const confirmPendingDelete = () => {
    const id = pendingDeleteConvId
    if (!id) return
    setConversations((prev) => prev.filter((conv) => conv.id !== id))
    if (currentConversationId === id) {
      handleNewChat()
    }
    setPendingDeleteConvId(null)
  }

  const pendingDeleteConv = useMemo(
    () => conversations.find((c) => c.id === pendingDeleteConvId) ?? null,
    [conversations, pendingDeleteConvId],
  )


  useEffect(() => {
    if (!pendingDeleteConvId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingDeleteConvId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDeleteConvId])

  useEffect(() => {
    if (!showRemoveAgentConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowRemoveAgentConfirm(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showRemoveAgentConfirm])

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingConvId(conv.id)
    setEditingTitleDraft(conv.title?.trim() || conv.prompt)
    window.setTimeout(() => {
      editingInputRef.current?.focus()
      editingInputRef.current?.select()
    }, 0)
  }

  const handleCancelRename = () => {
    setEditingConvId(null)
    setEditingTitleDraft('')
  }

  const handleSaveRename = (id: string) => {
    const nextTitle = editingTitleDraft.trim()
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, title: nextTitle || undefined } : conv,
      ),
    )
    setEditingConvId(null)
    setEditingTitleDraft('')
  }

  useEffect(() => {
    if (!prefillPrompt) {
      return
    }

    handleNewChat()
    setInputValue('')
    onConsumePrefill()
    void submitPrompt(prefillPrompt)
  }, [prefillPrompt, onConsumePrefill])

  useEffect(() => {
    if (status !== 'loading' || resultMode !== 'hardcoded') {
      return
    }

    const timer = window.setTimeout(() => {
      setStatus('done')
    }, 2500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [status, resultMode])

  const submitPrompt = async (rawPrompt: string) => {
    const nextPrompt = rawPrompt.trim()

    if (!nextPrompt || !selectedAgentId) {
      return
    }

    const requestId = requestCounter.current + 1
    requestCounter.current = requestId

    setSubmittedPrompt(nextPrompt)
    setAgentReply('')
    setAgentEventId(null)

    let convId = currentConversationId
    if (!convId) {
      convId = Date.now().toString()
      setCurrentConversationId(convId)
      setConversations((prev) => [
        {
          id: convId as string,
          prompt: nextPrompt,
          status: 'loading',
          resultMode: 'none',
          agentReply: '',
          agentEventId: null,
          usedDemoFallback: false,
        },
        ...prev,
      ])
    }

    if (normalizePrompt(nextPrompt) === discoverTargetPrompt) {
      setResultMode('hardcoded')
      setStatus('loading')
      setUsedDemoFallback(false)
      return
    }

    setResultMode('agent')
    setStatus('loading')
    setUsedDemoFallback(false)

    const agentLoadingStartedAt = performance.now()
    const needsMinAgentLoading = discoverChipAgentPromptsNormalized.has(normalizePrompt(nextPrompt))

    let resolvedAgentResult: DiscoverAgentResult | null = null

    if (getAccessToken()) {
      try {
        resolvedAgentResult = await discoverMut.mutateAsync({
          prompt: nextPrompt,
          agentId: selectedAgentId,
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            venue: e.venue,
            district: e.district,
            genre: e.genre,
            time: e.displayDateTimeLabel ?? e.time,
            verified: e.verified,
            vibeTags: e.vibeTags,
          })),
        })
      } catch {
        resolvedAgentResult = null
      }
    }

    let fromDemoFallback = false
    if (!resolvedAgentResult) {
      const openAiResult = await fetchOpenAIDiscoverResult(nextPrompt, selectedAgentId, events)
      fromDemoFallback = openAiResult === null
      resolvedAgentResult = openAiResult ?? getHardcodedAgentFallback(nextPrompt, selectedAgentId)
    }

    if (requestCounter.current !== requestId) {
      return
    }

    const finalReply = resolvedAgentResult.reply

    const hasMatchingEvent =
      resolvedAgentResult.suggestedEventId !== null &&
      events.some((item) => item.id === resolvedAgentResult.suggestedEventId)

    if (needsMinAgentLoading) {
      const elapsed = performance.now() - agentLoadingStartedAt
      const waitMs = Math.max(0, DISCOVER_COMPOSER_CONFIG.chipAgentMinLoadingMs - elapsed)
      if (waitMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, waitMs))
      }
    }

    if (requestCounter.current !== requestId) {
      return
    }

    setAgentReply(finalReply)
    setAgentEventId(hasMatchingEvent ? resolvedAgentResult.suggestedEventId : null)
    setUsedDemoFallback(fromDemoFallback)
    setStatus('done')

    return
  }

  const handleSend = () => {
    void submitPrompt(inputValue)
  }

  const hasThread =
    Boolean(submittedPrompt) ||
    status === 'loading' ||
    (status === 'done' && (resultMode === 'hardcoded' || resultMode === 'agent'))

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) {
      return
    }

    if (composerExpanded) {
      el.style.height = ''
      el.style.minHeight = ''
      return
    }

    const cs = getComputedStyle(el)
    const lineHeight = parseFloat(cs.lineHeight)
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)

    const minLines = 1
    const minPx = Number.isFinite(lineHeight)
      ? Math.ceil(lineHeight * minLines + padY)
      : 44
    const maxPx = Math.min(window.innerHeight * 0.34, 140)
    el.style.height = 'auto'
    if (el.value === '') {
      el.style.height = `${minPx}px`
      return
    }
    const next = Math.max(minPx, Math.min(el.scrollHeight, maxPx))
    el.style.height = `${next}px`
  }, [inputValue, composerExpanded])

  useLayoutEffect(() => {
    syncTextareaHeight()
  }, [syncTextareaHeight])

  const updateChipScrollHints = useCallback(() => {
    const el = chipScrollerRef.current
    if (!el) {
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = scrollWidth - clientWidth
    const epsilon = 2
    const overflow = maxScroll > epsilon
    setChipScrollHints({
      overflow,
      canLeft: overflow && scrollLeft > epsilon,
      canRight: overflow && scrollLeft < maxScroll - epsilon,
    })
  }, [])

  const scrollChipsToStart = useCallback(() => {
    chipScrollerRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [])

  const scrollChipsToEnd = useCallback(() => {
    const el = chipScrollerRef.current
    if (!el) {
      return
    }
    el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' })
  }, [])

  useLayoutEffect(() => {
    if (hasThread) {
      return
    }
    updateChipScrollHints()
    const el = chipScrollerRef.current
    if (!el) {
      return
    }
    el.addEventListener('scroll', updateChipScrollHints, { passive: true })
    const ro = new ResizeObserver(updateChipScrollHints)
    ro.observe(el)
    window.addEventListener('resize', updateChipScrollHints)
    return () => {
      el.removeEventListener('scroll', updateChipScrollHints)
      ro.disconnect()
      window.removeEventListener('resize', updateChipScrollHints)
    }
  }, [hasThread, updateChipScrollHints])

  useEffect(() => {
    if (!discoverMoreOpen) {
      return
    }

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target
      if (!(t instanceof Node)) {
        return
      }
      if (
        discoverMoreOpen &&
        discoverMoreRef.current &&
        !discoverMoreRef.current.contains(t)
      ) {
        if (t instanceof Element) {
          if (
            t.closest('.discover-drawer-backdrop') ||
            t.closest('.discover-drawer')
          ) {
            return
          }
        }
        setDiscoverMoreOpen(false)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDiscoverMoreOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [discoverMoreOpen])

  const needsAgentSelection = selectedAgentId === null
  const isChangingAgent = isAgentPickerOpen && selectedAgentId !== null
  const showAgentPicker = needsAgentSelection || isChangingAgent

  useEffect(() => {
    if (!isChangingAgent) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleChangeHeaderBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isChangingAgent, isAgentAdvisorOpen])

  return (
    <motion.div
      className="discover-tab discover-layla"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="discover-secondary-header">
        {isChangingAgent ? (
          <>
            <button
              type="button"
              className="discover-agent-change-back"
              onClick={handleChangeHeaderBack}
              aria-label={isAgentAdvisorOpen ? 'Back to all bats' : 'Back to chat'}
            >
              <ChevronLeft size={20} strokeWidth={2.25} aria-hidden />
              <span>{isAgentAdvisorOpen ? 'All bats' : 'Back to chat'}</span>
            </button>
          </>
        ) : (
          <>
        <div className="discover-more-row" ref={discoverMoreRef}>
          <button
            className={`icon-btn discover-more-btn${discoverMoreOpen ? ' icon-btn--active' : ''}`}
            type="button"
            aria-expanded={discoverMoreOpen}
            aria-controls="discover-more-panel"
            id="discover-more-trigger"
            aria-label={discoverMoreOpen ? 'Close more options' : 'More options'}
            onClick={() => {
              setDiscoverMoreOpen((open) => !open)
            }}
          >
            <MoreHorizontal size={20} strokeWidth={2} aria-hidden />
          </button>
          <motion.div
            id="discover-more-panel"
            className="discover-more-panel-clip"
            role="region"
            aria-labelledby="discover-more-trigger"
            aria-hidden={!discoverMoreOpen}
            initial={false}
            animate={{
              maxWidth: discoverMoreOpen ? 120 : 0,
              opacity: discoverMoreOpen ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{
              overflow: 'hidden',
              pointerEvents: discoverMoreOpen ? 'auto' : 'none',
            }}
          >
            <div className="discover-more-panel-inner">
              <button
                type="button"
                className="icon-btn discover-more-strip-btn"
                onClick={() => {
                  toggleDiscoverExpanded()
                }}
                aria-label={isDiscoverExpanded ? 'Show header and footer' : 'Hide header and footer'}
              >
                {isDiscoverExpanded ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
              </button>
              <button
                type="button"
                className="icon-btn discover-more-strip-btn"
                onClick={() => {
                  setIsDrawerOpen(true)
                }}
                aria-label="Open chat history"
              >
                <History size={20} aria-hidden />
              </button>
            </div>
          </motion.div>
        </div>
        <div className="discover-secondary-header-actions">
          {status === 'done' && resultMode === 'agent' ? (
            <div
              className={
                usedDemoFallback
                  ? 'discover-agent-mode-hint discover-agent-mode-hint--demo'
                  : 'discover-agent-mode-hint discover-agent-mode-hint--live'
              }
              role="status"
              aria-live="polite"
            >
              {usedDemoFallback ? 'Offline' : 'Live'}
            </div>
          ) : null}
          {selectedAgent ? (
            <div className="discover-agent-badge">
              <button
                type="button"
                className="discover-agent-badge-main discover-agent-badge--button"
                aria-label={`Your bat: ${selectedAgent.name}, ${selectedAgent.title}. Tap to change bat.`}
                onClick={openAgentPicker}
              >
                <span className="discover-agent-badge-glyph" aria-hidden>
                  {selectedAgent.glyph}
                </span>
                <span className="discover-agent-badge-copy">
                  <span className="discover-agent-badge-name">{selectedAgent.name}</span>
                  <span className="discover-agent-badge-title">{selectedAgent.title}</span>
                </span>
              </button>
              <button
                type="button"
                className="discover-agent-badge-remove"
                aria-label={`Remove ${selectedAgent.name}`}
                onClick={requestRemoveAgent}
              >
                <X size={14} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          ) : null}
          <button
            className="discover-new-chat-button"
            type="button"
            aria-label="Start new chat"
            onClick={() => handleNewChat()}
            disabled={needsAgentSelection}
          >
            <span className="discover-new-chat-label">New chat</span>
          </button>
        </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              className="discover-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div
              className="discover-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="discover-drawer-header">
                <h2>Chat History</h2>
                <button
                  className="icon-btn"
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="discover-drawer-content">
                {conversations.length === 0 ? (
                  <p className="discover-drawer-empty">No past conversations.</p>
                ) : (
                  <ul className="discover-drawer-list">
                    {conversations.map((conv) => {
                      const displayTitle = conv.title?.trim() || conv.prompt
                      const isEditing = editingConvId === conv.id
                      return (
                        <li
                          key={conv.id}
                          className={`discover-drawer-item ${currentConversationId === conv.id ? 'active' : ''}`}
                          onClick={() => {
                            if (isEditing) return
                            handleSelectConversation(conv)
                          }}
                        >
                          {isEditing ? (
                            <input
                              ref={editingInputRef}
                              className="discover-drawer-item-input"
                              value={editingTitleDraft}
                              onChange={(e) => setEditingTitleDraft(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleSaveRename(conv.id)
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  handleCancelRename()
                                }
                              }}
                              onBlur={() => handleSaveRename(conv.id)}
                              aria-label="Edit conversation title"
                              maxLength={120}
                            />
                          ) : (
                            <div
                              className="discover-drawer-item-text"
                              title={displayTitle}
                            >
                              {displayTitle}
                            </div>
                          )}
                          <div className="discover-drawer-item-actions">
                            {isEditing ? (
                              <button
                                className="discover-drawer-item-action discover-drawer-item-action--save"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSaveRename(conv.id)
                                }}
                                aria-label="Save title"
                              >
                                <Check size={16} />
                              </button>
                            ) : (
                              <button
                                className="discover-drawer-item-action"
                                type="button"
                                onClick={(e) => handleStartRename(conv, e)}
                                aria-label="Rename conversation"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              className="discover-drawer-item-action discover-drawer-item-delete"
                              type="button"
                              onClick={(e) => handleDeleteConversation(conv.id, e)}
                              aria-label="Delete conversation"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDeleteConv && (
          <motion.div
            key="discover-delete-confirm"
            className="discover-confirm-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-confirm-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={cancelPendingDelete}
          >
            <motion.div
              className="discover-confirm-dialog"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="discover-confirm-title" className="discover-confirm-title">
                Delete this conversation?
              </h3>
              <p className="discover-confirm-body">
                &ldquo;{pendingDeleteConv.title?.trim() || pendingDeleteConv.prompt}&rdquo; will be
                removed from your chat history. This can&apos;t be undone.
              </p>
              <div className="discover-confirm-actions">
                <button
                  type="button"
                  className="discover-confirm-btn discover-confirm-btn--ghost"
                  onClick={cancelPendingDelete}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="discover-confirm-btn discover-confirm-btn--danger"
                  onClick={confirmPendingDelete}
                  autoFocus
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showRemoveAgentConfirm && selectedAgent ? (
        <BuzoAgentRemoveConfirmDialog
          agent={selectedAgent}
          onConfirm={confirmRemoveAgent}
          onDismiss={cancelRemoveAgent}
        />
      ) : null}

      <div
        className={[
          hasThread || showAgentPicker
            ? 'discover-layla-scroll'
            : 'discover-layla-scroll discover-layla-scroll--empty',
          isAgentAdvisorOpen && 'discover-layla-scroll--advisor',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {showAgentPicker ? (
          <BuzoAgentPicker
            variant={needsAgentSelection ? 'initial' : 'change'}
            selectedAgentId={selectedAgentId}
            onSelect={handleSelectAgent}
            advisorOpen={isAgentAdvisorOpen}
            onAdvisorOpenChange={setIsAgentAdvisorOpen}
          />
        ) : hasThread ? (
          <div className="discover-layla-scroll-inner">
            {submittedPrompt && <div className="chat-bubble user">{submittedPrompt}</div>}

            {status === 'loading' && (
              <div className="chat-bubble bot loading-bubble" aria-label="Agent is typing">
                <div className="typing-loader" role="status" aria-live="polite">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {status === 'done' && resultMode === 'hardcoded' && hardcodedJazzEvent && (
              <>
                <div className="chat-bubble bot">
                  Tiong Bahru is swinging tonight. I found two spots with high credibility and
                  matching vibe.
                </div>
                <article className="event-card compact">
                  <img
                    src={hardcodedJazzEvent.image}
                    alt={hardcodedJazzEvent.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => handleEventImageError(hardcodedJazzEvent, e)}
                  />
                  <div className="event-meta">
                    <span className="chip">Jazz</span>
                  </div>
                  <div className="event-body">
                    <h3>{hardcodedJazzEvent.title}</h3>
                    <p>
                      {hardcodedJazzEvent.venue}, {hardcodedJazzEvent.district} ·{' '}
                      {hardcodedJazzEvent.displayDateTimeLabel ?? hardcodedJazzEvent.time}
                    </p>
                    <div className="tags">
                      {hardcodedJazzEvent.vibeTags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <button
                      className="cta-full"
                      type="button"
                      onClick={() => onOpenEvent(hardcodedJazzEvent.id)}
                    >
                      I'm Going
                    </button>
                  </div>
                </article>
              </>
            )}

            {status === 'done' && resultMode === 'agent' && agentReply && (
              <div className="chat-bubble bot">{agentReply}</div>
            )}

            {status === 'done' && resultMode === 'agent' && agentEvent && (
              <article className="event-card compact">
                <img
                  src={agentEvent.image}
                  alt={agentEvent.title}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => handleEventImageError(agentEvent, e)}
                />
                <div className="event-meta">
                  <span className="chip">{agentEvent.genre}</span>
                </div>
                <div className="event-body">
                  <h3>{agentEvent.title}</h3>
                  <p>
                    {agentEvent.venue}, {agentEvent.district} · {agentEvent.displayDateTimeLabel ?? agentEvent.time}
                  </p>
                  <div className="tags">
                    {agentEvent.vibeTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <button
                    className="cta-full"
                    type="button"
                    onClick={() => onOpenEvent(agentEvent.id)}
                  >
                    I'm Going
                  </button>
                </div>
              </article>
            )}
          </div>
        ) : (
          <div className="discover-layla-empty">
            <h4 className="discover-layla-empty-title">
              Chat with {selectedAgent?.name ?? 'Buzo'}...
            </h4>
            <p className="discover-layla-empty-sub">
              {selectedAgent?.tagline ?? 'Venues, lineups, areas, or budget — replies show up here.'}
            </p>
          </div>
        )}
      </div>

      {!showAgentPicker ? (
      <div className="discover-layla-footer">
        <div className="welcome-layla-prompt-stack discover-layla-prompt-stack">
          {!hasThread && (
            <div className="discover-layla-chip-section">
              <p className="discover-layla-try-asking" id={tryAskingLabelId}>
                Try asking
              </p>
              <div
                className="discover-layla-chip-row-wrap"
                role="group"
                aria-labelledby={tryAskingLabelId}
              >
                {chipScrollHints.overflow && (
                  <button
                    type="button"
                    className="discover-layla-chip-scroll-btn"
                    aria-label="Scroll quick prompts to the start"
                    disabled={!chipScrollHints.canLeft}
                    onClick={scrollChipsToStart}
                  >
                    <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                )}
                <div
                  ref={chipScrollerRef}
                  className="welcome-chip-scroller welcome-layla-chip-row"
                  role="list"
                  aria-label="Quick prompts"
                >
                  {discoverSuggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="welcome-layla-shortcut"
                      role="listitem"
                      onClick={() => {
                        setInputValue(prompt)
                        void submitPrompt(prompt)
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {chipScrollHints.overflow && (
                  <button
                    type="button"
                    className="discover-layla-chip-scroll-btn"
                    aria-label="Scroll quick prompts to the end"
                    disabled={!chipScrollHints.canRight}
                    onClick={scrollChipsToEnd}
                  >
                    <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            className={[
              'welcome-layla-composer',
              'welcome-layla-composer--compact',
              composerExpanded && 'welcome-layla-composer--compact-expanded',
            ]
              .filter(Boolean)
              .join(' ')}
            role="group"
            aria-label="Describe your night"
          >
            <LaylaAttachDropdown variant="icon" />
            <textarea
              ref={textareaRef}
              className="welcome-layla-textarea"
              placeholder={DISCOVER_COMPOSER_CONFIG.samplePlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
              aria-label="What do you want to do tonight?"
            />
            <div className="welcome-layla-toolbar">
              <button
                type="button"
                className="welcome-layla-expand-composer"
                aria-label={composerExpanded ? 'Collapse composer' : 'Expand composer'}
                aria-pressed={composerExpanded}
                onClick={() => setComposerExpanded((v) => !v)}
              >
                {composerExpanded ? (
                  <Minimize2 size={18} strokeWidth={2} aria-hidden />
                ) : (
                  <Maximize2 size={18} strokeWidth={2} aria-hidden />
                )}
              </button>
              <button
                type="button"
                className="welcome-layla-send"
                aria-label="Send prompt"
                onClick={handleSend}
              >
                <Send size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </motion.div>
  )
}
