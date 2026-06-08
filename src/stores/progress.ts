import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { InProgressState } from '@/lib/types'
import { Storage, KEYS } from '@/lib/storage'

export const useProgressStore = defineStore('progress', () => {
  const current = ref<InProgressState | null>(null)

  async function load() {
    current.value = await Storage.get<InProgressState | null>(KEYS.PROGRESS, null)
  }

  async function save() {
    if (current.value) {
      current.value.timestamp = Date.now()
      await Storage.set(KEYS.PROGRESS, JSON.parse(JSON.stringify(toRaw(current.value))))
    }
  }

  async function clear() {
    current.value = null
    await Storage.remove(KEYS.PROGRESS)
  }

  async function setState(state: InProgressState) {
    current.value = state
    await save()
  }

  return { current, load, save, clear, setState }
})
