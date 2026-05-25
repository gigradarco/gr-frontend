import { useCallback, useMemo } from 'react'
import { useAppState } from '../store/appStore'
import { api } from './trpc'

export function useEventPlans() {
  const isAuthenticated = useAppState((s) => s.isAuthenticated)
  const openSignIn = useAppState((s) => s.openSignIn)
  const utils = api.useUtils()

  const idsQuery = api.plan.ids.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  })

  const invalidatePlans = useCallback(async () => {
    await Promise.all([
      utils.plan.ids.invalidate(),
      utils.plan.upcoming.invalidate(),
      utils.plan.past.invalidate(),
    ])
  }, [utils])

  const addMutation = api.plan.add.useMutation({
    onSuccess: invalidatePlans,
  })
  const removeMutation = api.plan.remove.useMutation({
    onSuccess: invalidatePlans,
  })

  const plannedEventIds = useMemo(
    () => idsQuery.data?.ids ?? [],
    [idsQuery.data?.ids],
  )
  const plannedEventIdSet = useMemo(() => new Set(plannedEventIds), [plannedEventIds])

  const isEventPlanned = useCallback(
    (eventId: string) => plannedEventIdSet.has(eventId),
    [plannedEventIdSet],
  )

  const toggleEventPlan = useCallback(
    (eventId: string) => {
      const id = eventId.trim()
      if (!id) return
      if (!isAuthenticated) {
        openSignIn()
        return
      }

      if (plannedEventIdSet.has(id)) {
        removeMutation.mutate({ eventId: id })
      } else {
        addMutation.mutate({ eventId: id })
      }
    },
    [addMutation, isAuthenticated, openSignIn, plannedEventIdSet, removeMutation],
  )

  return {
    plannedEventIds,
    isEventPlanned,
    toggleEventPlan,
    isUpdating: addMutation.isPending || removeMutation.isPending,
    error: idsQuery.error ?? addMutation.error ?? removeMutation.error ?? null,
  }
}
