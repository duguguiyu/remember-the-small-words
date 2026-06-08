import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { WordStats } from '@/lib/types'
import { Storage, KEYS } from '@/lib/storage'

export const useWordsStore = defineStore('words', () => {
  const stats = ref<Record<string, WordStats>>({})

  async function load() {
    stats.value = await Storage.get<Record<string, WordStats>>(KEYS.WORD_STATS, {})
  }

  async function save() {
    await Storage.set(KEYS.WORD_STATS, JSON.parse(JSON.stringify(toRaw(stats.value))))
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

    await save()
  }

  return { stats, load, save, getStats, updateStats }
})
