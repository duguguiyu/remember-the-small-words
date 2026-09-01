import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Wordbook } from '@/lib/types'
import { api } from '@/lib/api'

export const useWordbooksStore = defineStore('wordbooks', () => {
  const wordbooks = ref<Wordbook[]>([])
  const syncing = ref(false)
  const lastSyncError = ref<string | null>(null)
  let inflight: Promise<void> | null = null

  async function load() {
    if (inflight) return inflight
    syncing.value = true
    lastSyncError.value = null
    inflight = (async () => {
      try {
        wordbooks.value = await api<Wordbook[]>('/api/wordbooks')
      } catch (e: any) {
        lastSyncError.value = e.message
      } finally {
        syncing.value = false
        inflight = null
      }
    })()
    return inflight
  }

  function getWordbookById(id: string): Wordbook | undefined {
    return wordbooks.value.find((w) => w.id === id)
  }

  function getWordsByWordbookIds(ids: string[]) {
    return ids.flatMap((id) => {
      const wb = wordbooks.value.find((w) => w.id === id)
      return wb ? wb.words : []
    })
  }

  return {
    wordbooks,
    syncing,
    lastSyncError,
    load,
    getWordbookById,
    getWordsByWordbookIds,
    save: async () => {},
    doSync: load,
    setWordbooks: async (books: Wordbook[]) => {
      wordbooks.value = books
    },
    upsertWordbook: async (book: Wordbook) => {
      const idx = wordbooks.value.findIndex((w) => w.id === book.id)
      if (idx >= 0) wordbooks.value[idx] = book
      else wordbooks.value.push(book)
    },
  }
})
