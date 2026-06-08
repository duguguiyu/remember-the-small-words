export interface Word {
  english: string
  chinese: string
  phonetic: string
  exampleEn: string
  exampleCn: string
  explanation: string
}

export interface Wordbook {
  id: string
  name: string
  category: string
  categoryName: string
  md5: string
  words: Word[]
}

export interface WordStats {
  english: string
  reviewCount: number
  correctCount: number
  wrongCount: number
  lastReviewTime: string | null
  nextReviewTime: string | null
  easeFactor: number
  interval: number
}

export interface LearningPlan {
  id: string
  name: string
  wordbookIds: string[]
  englishToChineseCount: number
  chineseToEnglishCount: number
  fillBlankCount: number
  color: string
  createdAt: number
}

export interface QuestionResult {
  word: string
  type: 'en2cn' | 'cn2en' | 'fillBlank'
  correct: boolean
  userAnswer: string
}

export interface Round {
  roundNumber: number
  results: QuestionResult[]
  correctCount: number
  wrongCount: number
}

export interface SessionRecord {
  id: string
  type: 'learn' | 'exam'
  date: string
  planId: string | null
  planName: string
  planColor: string
  startTime: string
  endTime: string | null
  words: string[]
  rounds: Round[]
  totalRounds: number
  score: number | null
  status: 'completed' | 'in_progress'
}

export interface Question {
  word: string
  type: 'en2cn' | 'cn2en' | 'fillBlank'
  prompt: string
  correctAnswer: string
  options?: string[]
  sentence?: string
  exampleCn?: string
}

export interface InProgressState {
  sessionId: string
  type: 'learn' | 'exam'
  planId: string | null
  planName: string
  planColor: string
  phase: 'preview' | 'confirm' | 'test' | 'review'
  previewIndex: number
  questionIndex: number
  questions: Question[]
  results: QuestionResult[]
  roundNumber: number
  rounds: Round[]
  allWords: Word[]
  wordbookIds?: string[]
  timestamp: number
}

export interface BackupData {
  version: number
  exportedAt: string
  wordStats: Record<string, WordStats>
  sessions: SessionRecord[]
  plans: LearningPlan[]
  streak: { count: number; lastDay: string }
}

export const PLAN_COLORS = [
  '#4285F4',
  '#34A853',
  '#F5A623',
  '#9C27B0',
  '#EA4335',
  '#00ACC1',
  '#E91E63',
  '#795548',
] as const
