import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import type { BuzoAgent } from '../../config/buzoAgents'

type BuzoAgentRemoveConfirmDialogProps = {
  agent: BuzoAgent
  onConfirm: () => void
  onDismiss: () => void
}

export function BuzoAgentRemoveConfirmDialog({
  agent,
  onConfirm,
  onDismiss,
}: BuzoAgentRemoveConfirmDialogProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="buzo-agent-remove-confirm"
        className="discover-confirm-overlay buzo-agent-remove-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buzo-agent-remove-confirm-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onDismiss}
      >
        <motion.div
          className="discover-confirm-dialog"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="buzo-agent-remove-confirm-title" className="discover-confirm-title">
            Remove {agent.name}?
          </h3>
          <p className="discover-confirm-body">
            You&apos;ll need to pick a bat again before chatting with Buzo. Your open chat will be
            cleared.
          </p>
          <div className="discover-confirm-actions">
            <button
              type="button"
              className="discover-confirm-btn discover-confirm-btn--ghost"
              onClick={onDismiss}
            >
              Keep bat
            </button>
            <button
              type="button"
              className="discover-confirm-btn discover-confirm-btn--danger"
              onClick={onConfirm}
              autoFocus
            >
              Remove bat
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
