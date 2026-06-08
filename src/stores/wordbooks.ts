import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { Wordbook } from '@/lib/types'
import { Storage, KEYS } from '@/lib/storage'
import { syncWordbooks } from '@/lib/sync'

export const useWordbooksStore = defineStore('wordbooks', () => {
  const wordbooks = ref<Wordbook[]>([])
  const syncing = ref(false)
  const lastSyncError = ref<string | null>(null)

  async function load() {
    wordbooks.value = await Storage.get<Wordbook[]>(KEYS.WORDBOOKS, [])
    await doSync()
  }

  async function doSync() {
    if (syncing.value) return
    syncing.value = true
    lastSyncError.value = null
    try {
      const updated = await syncWordbooks(wordbooks.value)
      wordbooks.value = updated
      await save()
    } catch (e: any) {
      lastSyncError.value = e.message
    } finally {
      syncing.value = false
    }
  }

  async function save() {
    await Storage.set(KEYS.WORDBOOKS, JSON.parse(JSON.stringify(toRaw(wordbooks.value))))
  }

  async function setWordbooks(books: Wordbook[]) {
    wordbooks.value = books
    await save()
  }

  async function upsertWordbook(book: Wordbook) {
    const idx = wordbooks.value.findIndex((w) => w.id === book.id)
    if (idx >= 0) {
      wordbooks.value[idx] = book
    } else {
      wordbooks.value.push(book)
    }
    await save()
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
    save,
    doSync,
    setWordbooks,
    upsertWordbook,
    getWordbookById,
    getWordsByWordbookIds,
  }
})
