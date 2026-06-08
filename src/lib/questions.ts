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
    })
  }

  for (const w of fillBlankWords) {
    if (!w.exampleEn) continue
    const sentence = w.exampleEn.replace(
      new RegExp(w.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      '______'
    )
    questions.push({
      word: w.english,
      type: 'fillBlank',
      prompt: w.chinese,
      correctAnswer: w.english,
      sentence,
      exampleCn: w.exampleCn || '',
    })
  }

  return shuffle(questions)
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
