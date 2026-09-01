import type { Word, Question } from './types'
import { shuffle } from './sm2'

export function generateQuestions(
  en2cnWords: Word[],
  cn2enWords: Word[],
  fillBlankWords: Word[],
  allPoolWords: Word[]
): Question[] {
  const questions: Question[] = []

  for (const w of en2cnWords) {
    const distractors = getDistractors(w, allPoolWords, 2)
    const options = shuffle([w.chinese, ...distractors.map((d) => d.chinese)])
    questions.push({
      word: w.english,
      type: 'en2cn',
      prompt: w.english,
      correctAnswer: w.chinese,
      options,
    })
  }

  for (const w of cn2enWords) {
    questions.push({
      word: w.english,
      type: 'cn2en',
      prompt: w.chinese,
      correctAnswer: w.english,
      exampleEn: w.exampleEn || '',
    })
  }

  for (const w of fillBlankWords) {
    if (!w.exampleEn) continue
    questions.push({
      word: w.english,
      type: 'fillBlank',
      prompt: w.chinese,
      correctAnswer: w.english,
      sentence: blankOutExample(w.exampleEn, w.english),
      exampleEn: w.exampleEn,
      exampleCn: w.exampleCn || '',
    })
  }

  return shuffle(questions)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Blank the headword in an example, including gapped phrases like "regard as". */
export function blankOutExample(sentence: string, english: string): string {
  const exact = new RegExp(escapeRegExp(english), 'gi')
  const exactReplaced = sentence.replace(exact, '______')
  if (exactReplaced !== sentence) return exactReplaced

  if (/\bone's\b/i.test(english)) {
    const flex = english.replace(/\bone's\b/gi, "(?:one's|my|your|his|her|our|their)")
    const flexReplaced = sentence.replace(new RegExp(flex, 'gi'), '______')
    if (flexReplaced !== sentence) return flexReplaced
  }

  const parts = english.split(/\s*\.\.\.\s*|\s+/).filter(Boolean)
  if (parts.length === 2) {
    const gapped = new RegExp(
      `${escapeRegExp(parts[0])}(\\s+\\S+)\\s+${escapeRegExp(parts[1])}`,
      'gi'
    )
    const gappedReplaced = sentence.replace(gapped, '______$1 ______')
    if (gappedReplaced !== sentence) return gappedReplaced
  }

  return sentence
}

function getDistractors(target: Word, pool: Word[], count: number): Word[] {
  const others = pool.filter((w) => w.english !== target.english && w.chinese !== target.chinese)
  return shuffle(others).slice(0, count)
}

export function checkAnswer(question: Question, userAnswer: string): boolean {
  if (question.type === 'en2cn') {
    return userAnswer === question.correctAnswer
  }
  return normalize(userAnswer) === normalize(question.correctAnswer)
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
