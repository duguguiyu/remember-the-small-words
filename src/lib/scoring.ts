import type { QuestionResult } from './types'

export function computeExamScore(results: QuestionResult[]): number {
  if (results.length === 0) return 0

  let totalWeight = 0
  let correctWeight = 0

  for (const r of results) {
    const weight = r.type === 'en2cn' ? 1 : 2
    totalWeight += weight
    if (r.correct) {
      correctWeight += weight
    }
  }

  if (totalWeight === 0) return 0
  return Math.round((correctWeight / totalWeight) * 100)
}
