import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

type PlanCancelConfirmDialogProps = {
  eventTitle: string
  onConfirm: () => void
  onDismiss: () => void
}

export function PlanCancelConfirmDialog({
  eventTitle,
  onConfirm,
  onDismiss,
}: PlanCancelConfirmDialogProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="plan-cancel-confirm"
        className="discover-confirm-overlay plan-cancel-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-cancel-confirm-title"
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
          <h3 id="plan-cancel-confirm-title" className="discover-confirm-title">
            Cancel this plan?
          </h3>
          <p className="discover-confirm-body">
            Are you sure you want to cancel this event? &ldquo;{eventTitle}&rdquo; will be removed
            from your plan.
          </p>
          <div className="discover-confirm-actions">
            <button
              type="button"
              className="discover-confirm-btn discover-confirm-btn--ghost"
              onClick={onDismiss}
            >
              Keep in plan
            </button>
            <button
              type="button"
              className="discover-confirm-btn discover-confirm-btn--danger"
              onClick={onConfirm}
              autoFocus
            >
              Cancel plan
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
