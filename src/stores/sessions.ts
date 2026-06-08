import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { SessionRecord } from '@/lib/types'
import { Storage, KEYS } from '@/lib/storage'
import { getBeijingDateStr } from '@/lib/date'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<SessionRecord[]>([])

  async function load() {
    sessions.value = await Storage.get<SessionRecord[]>(KEYS.SESSIONS, [])
  }

  async function save() {
    await Storage.set(KEYS.SESSIONS, JSON.parse(JSON.stringify(toRaw(sessions.value))))
  }

  async function addSession(session: SessionRecord) {
    sessions.value.push(session)
    await save()
  }

  async function updateSession(id: string, updates: Partial<SessionRecord>) {
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx >= 0) {
      sessions.value[idx] = { ...sessions.value[idx], ...updates }
      await save()
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
    save,
    addSession,
    updateSession,
    getSessionsByDate,
    getTodayCompletedPlanIds,
  }
})
