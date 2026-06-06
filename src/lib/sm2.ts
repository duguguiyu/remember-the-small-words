import type { Word, WordStats } from './types'
import { getBeijingDateStr } from './date'

export function selectWords(
  pool: Word[],
  total: number,
  statsMap: Record<string, WordStats>
): Word[] {
  if (pool.length === 0) return []
  if (pool.length <= total) return shuffle([...pool])

  const today = getBeijingDateStr()
  const avgReviewCount = computeAvgReviewCount(pool, statsMap)

  const scored = pool.map((w) => ({
    word: w,
    score: computePriority(w.english, statsMap, today, avgReviewCount),
  }))

  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, total).map((s) => s.word)
}

function computePriority(
  english: string,
  statsMap: Record<string, WordStats>,
  today: string,
  avgReviewCount: number
): number {
  const s = statsMap[english]
  if (!s || s.reviewCount === 0) {
    return -1000 + Math.random() * 30
  }

  let score = 0

  if (s.nextReviewTime && s.nextReviewTime <= today) {
    score = -500 + Math.random() * 30
  } else {
    score = 100 + Math.random() * 30
  }

  if (s.reviewCount > avgReviewCount * 1.5) {
    score += 200
  }

  if (s.lastReviewTime && s.lastReviewTime.slice(0, 10) === today) {
    score += 200
  }

  return score
}

function computeAvgReviewCount(pool: Word[], statsMap: Record<string, WordStats>): number {
  let total = 0
  let count = 0
  for (const w of pool) {
    const s = statsMap[w.english]
    if (s) {
      total += s.reviewCount
      count++
    }
  }
  return count > 0 ? total / count : 0
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
