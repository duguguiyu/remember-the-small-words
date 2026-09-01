import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WordStats } from '@/lib/types'
import { api, enqueueWrite } from '@/lib/api'

export const useWordsStore = defineStore('words', () => {
  const stats = ref<Record<string, WordStats>>({})

  async function load() {
    stats.value = await api<Record<string, WordStats>>('/api/word-stats')
  }

  function getStats(english: string): WordStats {
    if (!stats.value[english]) {
      stats.value[english] = {
        english,
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
        lastReviewTime: null,
        nextReviewTime: null,
        easeFactor: 2.5,
        interval: 0,
      }
    }
    return stats.value[english]
  }

  async function updateStats(english: string, correct: boolean) {
    const s = getStats(english)
    s.reviewCount++
    s.lastReviewTime = new Date().toISOString()

    if (correct) {
      s.correctCount++
      s.easeFactor = Math.min(3.0, s.easeFactor + 0.1)
      if (s.interval === 0) {
        s.interval = 1
      } else if (s.interval === 1) {
        s.interval = 3
      } else {
        s.interval = Math.round(s.interval * s.easeFactor)
      }
    } else {
      s.wrongCount++
      s.easeFactor = Math.max(1.3, s.easeFactor - 0.3)
      s.interval = 1
    }

    const next = new Date()
    next.setDate(next.getDate() + s.interval)
    s.nextReviewTime = next.toISOString().slice(0, 10)

    const payload = { ...s }
    await enqueueWrite(() =>
      api('/api/word-stats', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }).then(() => undefined),
    )
  }

  return { stats, load, save: async () => {}, getStats, updateStats }
})
