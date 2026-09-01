import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { InProgressState } from '@/lib/types'
import { api, enqueueWrite } from '@/lib/api'

export const useProgressStore = defineStore('progress', () => {
  const current = ref<InProgressState | null>(null)

  async function load() {
    current.value = await api<InProgressState | null>('/api/progress')
  }

  async function save() {
    if (!current.value) return
    current.value.timestamp = Date.now()
    const snapshot = JSON.parse(JSON.stringify(toRaw(current.value))) as InProgressState
    await enqueueWrite(() =>
      api('/api/progress', {
        method: 'PUT',
        body: JSON.stringify(snapshot),
      }).then(() => undefined),
    )
  }

  async function clear() {
    current.value = null
    await enqueueWrite(() => api('/api/progress', { method: 'DELETE' }).then(() => undefined))
  }

  async function setState(state: InProgressState) {
    current.value = state
    await save()
  }

  return { current, load, save, clear, setState }
})
