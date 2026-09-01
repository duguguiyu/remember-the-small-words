import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SessionRecord } from '@/lib/types'
import { api } from '@/lib/api'
import { getBeijingDateStr } from '@/lib/date'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<SessionRecord[]>([])

  async function load() {
    sessions.value = await api<SessionRecord[]>('/api/sessions')
  }

  async function addSession(session: SessionRecord) {
    const created = await api<SessionRecord>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    })
    sessions.value.push(created)
  }

  async function updateSession(id: string, updates: Partial<SessionRecord>) {
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx >= 0) {
      sessions.value[idx] = { ...sessions.value[idx], ...updates }
    }
  }

  const todaySessions = computed(() => {
    const today = getBeijingDateStr()
    return sessions.value.filter((s) => s.date === today)
  })

  function getSessionsByDate(date: string) {
    return sessions.value.filter((s) => s.date === date)
  }

  function getTodayCompletedPlanIds(): string[] {
    const today = getBeijingDateStr()
    return sessions.value
      .filter((s) => s.date === today && s.status === 'completed' && s.planId)
      .map((s) => s.planId!)
  }

  const firstSessionDate = computed(() => {
    if (sessions.value.length === 0) return null
    const dates = sessions.value.map((s) => s.date).sort()
    return dates[0]
  })

  return {
    sessions,
    todaySessions,
    firstSessionDate,
    load,
    save: async () => {},
    addSession,
    updateSession,
    getSessionsByDate,
    getTodayCompletedPlanIds,
  }
})
