import { watch, type Ref } from 'vue'
import { speakEnglish } from '@/lib/tts'
import type { Question } from '@/lib/types'

export function speakEn2cnQuestion(q: Question) {
  void speakEnglish(q.word || q.prompt, { rate: 0.85 })
}

/** Speak the full example sentence (with the answer filled in). */
export function speakFillBlankQuestion(q: Question) {
  const text = q.exampleEn
    || (q.sentence && q.correctAnswer
      ? q.sentence.replace(/______+/g, q.correctAnswer)
      : '')
  if (!text.trim()) return
  void speakEnglish(text, { rate: 0.88 })
}

/** Optional: hear example sentence, or the English word if no example. */
export function speakCn2enQuestion(q: Question) {
  const text = q.exampleEn?.trim() || q.correctAnswer || q.word
  void speakEnglish(text, { rate: q.exampleEn?.trim() ? 0.88 : 0.85 })
}

/** Auto-speak en2cn prompts when the test question changes. */
export function useQuestionTts(
  phase: Ref<string>,
  currentQuestion: Ref<Question | undefined>,
  questionIndex: Ref<number>,
) {
  watch(
    [phase, questionIndex, currentQuestion],
    ([p, , q]) => {
      if (p !== 'test' || !q || q.type !== 'en2cn') return
      speakEn2cnQuestion(q)
    },
  )

  return { speakEn2cnQuestion, speakFillBlankQuestion, speakCn2enQuestion }
}
