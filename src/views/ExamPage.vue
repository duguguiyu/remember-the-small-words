<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useWordbooksStore } from '@/stores/wordbooks'
import { useWordsStore } from '@/stores/words'
import { useSessionsStore } from '@/stores/sessions'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { shuffle } from '@/lib/sm2'
import { generateQuestions, checkAnswer } from '@/lib/questions'
import { computeExamScore } from '@/lib/scoring'
import { getBeijingDateStr } from '@/lib/date'
import { playCorrectSound, playWrongSound } from '@/lib/sound'
import { useQuestionTts } from '@/lib/useQuestionTts'
import type { Word, Question, QuestionResult, Round, InProgressState } from '@/lib/types'
import confetti from 'canvas-confetti'

const router = useRouter()
const wordbooksStore = useWordbooksStore()
const wordsStore = useWordsStore()
const sessionsStore = useSessionsStore()
const progressStore = useProgressStore()
const settingsStore = useSettingsStore()

const phase = ref<'config' | 'test' | 'review' | 'complete'>('config')
const config = reactive({
  wordbookIds: [] as string[],
  englishToChineseCount: 10,
  chineseToEnglishCount: 10,
  fillBlankCount: 5,
})

const questionIndex = ref(0)
const questions = ref<Question[]>([])
const results = ref<QuestionResult[]>([])
const roundNumber = ref(1)
const rounds = ref<Round[]>([])
const allWords = ref<Word[]>([])
const selectedAnswer = ref('')
const typedAnswer = ref('')
const showFeedback = ref(false)
const lastCorrect = ref(false)
const sessionId = ref('')
const examScore = ref<number | null>(null)
const firstRoundResults = ref<QuestionResult[]>([])

const currentQuestion = computed(() => questions.value[questionIndex.value])
const { speakEn2cnQuestion, speakFillBlankQuestion, speakCn2enQuestion } = useQuestionTts(phase, currentQuestion, questionIndex)
const wrongQuestions = computed(() => {
  return questions.value.filter((_, i) => results.value[i] && !results.value[i].correct)
})

onMounted(async () => {
  await Promise.all([
    wordbooksStore.load(),
    wordsStore.load(),
    sessionsStore.load(),
    progressStore.load(),
    settingsStore.load(),
  ])

  if (progressStore.current && progressStore.current.type === 'exam') {
    restoreProgress(progressStore.current)
    return
  }
})

function restoreProgress(state: InProgressState) {
  sessionId.value = state.sessionId
  phase.value = state.phase === 'preview' || state.phase === 'confirm' ? 'test' : state.phase as any
  questionIndex.value = state.questionIndex
  questions.value = state.questions
  results.value = state.results
  roundNumber.value = state.roundNumber
  rounds.value = state.rounds
  allWords.value = state.allWords
  if (state.wordbookIds) {
    config.wordbookIds = state.wordbookIds
  }
}

async function saveProgress() {
  const state: InProgressState = {
    sessionId: sessionId.value,
    type: 'exam',
    planId: null,
    planName: '考试',
    planColor: '#EA4335',
    phase: phase.value as any,
    previewIndex: 0,
    questionIndex: questionIndex.value,
    questions: questions.value,
    results: results.value,
    roundNumber: roundNumber.value,
    rounds: rounds.value,
    allWords: allWords.value,
    wordbookIds: config.wordbookIds,
    timestamp: Date.now(),
  }
  await progressStore.setState(state)
}

function toggleWordbook(id: string) {
  const idx = config.wordbookIds.indexOf(id)
  if (idx >= 0) config.wordbookIds.splice(idx, 1)
  else config.wordbookIds.push(id)
}

function startExam() {
  if (config.wordbookIds.length === 0) {
    alert('请至少选择一个词库')
    return
  }

  sessionId.value = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const poolWords = wordbooksStore.getWordsByWordbookIds(config.wordbookIds)
  if (poolWords.length === 0) {
    alert('选中的词库中没有单词')
    return
  }

  const total = config.englishToChineseCount + config.chineseToEnglishCount + config.fillBlankCount
  const selected = shuffle(poolWords).slice(0, total)

  let offset = 0
  const en2cnWords = selected.slice(offset, offset + config.englishToChineseCount)
  offset += en2cnWords.length
  const cn2enWords = selected.slice(offset, offset + config.chineseToEnglishCount)
  offset += cn2enWords.length
  const remaining = selected.slice(offset)
  let fbCandidates = remaining.filter((w) => w.exampleEn)
  if (fbCandidates.length < config.fillBlankCount) {
    const usedSet = new Set(fbCandidates.map((w) => w.english))
    const extra = selected.slice(0, offset).filter((w) => w.exampleEn && !usedSet.has(w.english))
    fbCandidates = [...fbCandidates, ...extra]
  }
  const fillBlankWords = fbCandidates.slice(0, config.fillBlankCount)

  const uniqueWords = [...new Map([...en2cnWords, ...cn2enWords, ...fillBlankWords].map((w) => [w.english, w])).values()]
  allWords.value = uniqueWords

  questions.value = generateQuestions(en2cnWords, cn2enWords, fillBlankWords, poolWords)
  phase.value = 'test'
  questionIndex.value = 0
  results.value = []
  roundNumber.value = 1
  rounds.value = []
  showFeedback.value = false
  saveProgress()
}

function submitAnswer() {
  const q = currentQuestion.value
  if (!q) return

  let answer = ''
  if (q.type === 'en2cn') {
    answer = selectedAnswer.value
  } else {
    answer = typedAnswer.value.trim()
  }
  if (!answer) return

  const correct = checkAnswer(q, answer)
  lastCorrect.value = correct
  showFeedback.value = true

  if (correct) {
    playCorrectSound()
  } else {
    playWrongSound()
  }

  results.value.push({
    word: q.word,
    type: q.type,
    correct,
    userAnswer: answer,
  })

  wordsStore.updateStats(q.word, correct)
  saveProgress()
}

function nextQuestion() {
  showFeedback.value = false
  selectedAnswer.value = ''
  typedAnswer.value = ''

  if (questionIndex.value < questions.value.length - 1) {
    questionIndex.value++
  } else {
    finishRound()
  }
  saveProgress()
}

function finishRound() {
  const roundResults = [...results.value]
  const cc = roundResults.filter((r) => r.correct).length
  const wc = roundResults.filter((r) => !r.correct).length

  rounds.value.push({
    roundNumber: roundNumber.value,
    results: roundResults,
    correctCount: cc,
    wrongCount: wc,
  })

  if (roundNumber.value === 1) {
    firstRoundResults.value = roundResults
    examScore.value = computeExamScore(roundResults)
  }

  if (wc === 0) {
    completeExam()
  } else {
    phase.value = 'review'
  }
  saveProgress()
}

function startErrorCorrection() {
  roundNumber.value++
  const wrongQs = questions.value.filter((_, i) => results.value[i] && !results.value[i].correct)
  questions.value = wrongQs
  questionIndex.value = 0
  results.value = []
  phase.value = 'test'
  showFeedback.value = false
  saveProgress()
}

async function completeExam() {
  phase.value = 'complete'
  confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } })

  const today = getBeijingDateStr()
  await sessionsStore.addSession({
    id: sessionId.value,
    type: 'exam',
    date: today,
    planId: null,
    planName: '考试',
    planColor: '#EA4335',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    words: allWords.value.map((w) => w.english),
    rounds: rounds.value,
    totalRounds: rounds.value.length,
    score: examScore.value,
    status: 'completed',
  })

  await progressStore.clear()
}

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="exam-page">
    <!-- Config Phase -->
    <div v-if="phase === 'config'" class="phase-config">
      <header class="page-header">
        <button class="btn-back" @click="goHome">← 返回</button>
        <h2>开始考试</h2>
      </header>

      <div class="form-group">
        <label>选择词库</label>
        <div class="wordbook-selector">
          <label
            v-for="book in wordbooksStore.wordbooks"
            :key="book.id"
            class="wordbook-option"
          >
            <input
              type="checkbox"
              :checked="config.wordbookIds.includes(book.id)"
              @change="toggleWordbook(book.id)"
            />
            <span>{{ book.categoryName }} - {{ book.name }}</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label>看英文选中文</label>
        <div class="stepper">
          <button @click="config.englishToChineseCount = Math.max(0, config.englishToChineseCount - 1)">-</button>
          <span>{{ config.englishToChineseCount }}</span>
          <button @click="config.englishToChineseCount = Math.min(50, config.englishToChineseCount + 1)">+</button>
        </div>
      </div>

      <div class="form-group">
        <label>看中文写英文</label>
        <div class="stepper">
          <button @click="config.chineseToEnglishCount = Math.max(0, config.chineseToEnglishCount - 1)">-</button>
          <span>{{ config.chineseToEnglishCount }}</span>
          <button @click="config.chineseToEnglishCount = Math.min(50, config.chineseToEnglishCount + 1)">+</button>
        </div>
      </div>

      <div class="form-group">
        <label>例句填空</label>
        <div class="stepper">
          <button @click="config.fillBlankCount = Math.max(0, config.fillBlankCount - 1)">-</button>
          <span>{{ config.fillBlankCount }}</span>
          <button @click="config.fillBlankCount = Math.min(50, config.fillBlankCount + 1)">+</button>
        </div>
      </div>

      <button class="btn-start" :disabled="config.wordbookIds.length === 0" @click="startExam">
        开始考试
      </button>
    </div>

    <!-- Test Phase -->
    <div v-if="phase === 'test'" class="phase-test">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${((questionIndex + 1) / questions.length) * 100}%` }"></div>
      </div>
      <div class="test-counter">
        第{{ roundNumber }}轮 · {{ questionIndex + 1 }}/{{ questions.length }}
      </div>

      <div v-if="currentQuestion" :class="['question-card', showFeedback && lastCorrect ? 'correct-flash' : '', showFeedback && !lastCorrect ? 'wrong-flash' : '']">
        <div :class="['question-type', 'type-' + currentQuestion.type]">
          {{ currentQuestion.type === 'en2cn' ? '📘 看英文选中文' : currentQuestion.type === 'cn2en' ? '✏️ 看中文写英文' : '📝 例句填空' }}
        </div>

        <div class="question-prompt">
          <template v-if="currentQuestion.type === 'fillBlank'">
            <div class="prompt-row">
              <p class="sentence">{{ currentQuestion.sentence }}</p>
              <button
                type="button"
                class="btn-speak"
                aria-label="朗读例句"
                @click="speakFillBlankQuestion(currentQuestion)"
              >🔊</button>
            </div>
            <p v-if="currentQuestion.exampleCn" class="sentence-cn">{{ currentQuestion.exampleCn }}</p>
            <p v-else class="hint">{{ currentQuestion.prompt }}</p>
          </template>
          <template v-else-if="currentQuestion.type === 'en2cn'">
            <div class="prompt-row">
              <p class="prompt-text">{{ currentQuestion.prompt }}</p>
              <button
                type="button"
                class="btn-speak"
                aria-label="朗读单词"
                @click="speakEn2cnQuestion(currentQuestion)"
              >🔊</button>
            </div>
          </template>
          <template v-else-if="currentQuestion.type === 'cn2en'">
            <div class="prompt-row">
              <p class="prompt-text">{{ currentQuestion.prompt }}</p>
              <button
                type="button"
                class="btn-speak"
                aria-label="朗读英文"
                @click="speakCn2enQuestion(currentQuestion)"
              >🔊</button>
            </div>
          </template>
          <template v-else>
            <p class="prompt-text">{{ currentQuestion.prompt }}</p>
          </template>
        </div>

        <div v-if="currentQuestion.type === 'en2cn' && !showFeedback" class="options">
          <button
            v-for="opt in currentQuestion.options"
            :key="opt"
            :class="['option-btn', { selected: selectedAnswer === opt }]"
            @click="selectedAnswer = opt"
          >
            {{ opt }}
          </button>
        </div>

        <div v-if="currentQuestion.type !== 'en2cn' && !showFeedback" class="input-area">
          <input
            v-model="typedAnswer"
            type="text"
            placeholder="输入答案..."
            @keyup.enter="submitAnswer"
            autocomplete="off"
            autocapitalize="off"
          />
        </div>

        <div v-if="showFeedback" :class="['feedback', lastCorrect ? 'correct' : 'wrong']">
          <p class="feedback-icon">{{ lastCorrect ? '✓' : '✗' }}</p>
          <p v-if="!lastCorrect" class="correct-answer">
            正确答案: {{ currentQuestion.correctAnswer }}
          </p>
        </div>
      </div>

      <div class="sticky-footer">
        <button v-if="!showFeedback" class="btn-submit" :disabled="!selectedAnswer && !typedAnswer.trim()" @click="submitAnswer">
          确认
        </button>
        <button v-else class="btn-next" @click="nextQuestion">
          {{ questionIndex < questions.length - 1 ? '下一题' : '查看结果' }}
        </button>
      </div>
    </div>

    <!-- Review Phase -->
    <div v-if="phase === 'review'" class="phase-review">
      <h2>本轮结果</h2>
      <div v-if="examScore != null" class="score-display">
        <span class="score-number">{{ examScore }}</span>
        <span class="score-label">分</span>
      </div>
      <div class="review-stats">
        <div class="stat-correct">✓ {{ rounds[rounds.length - 1]?.correctCount || 0 }}</div>
        <div class="stat-wrong">✗ {{ rounds[rounds.length - 1]?.wrongCount || 0 }}</div>
      </div>
      <div class="wrong-list">
        <h3>错题列表</h3>
        <div v-for="q in wrongQuestions" :key="q.word" class="wrong-item">
          <span class="wrong-word">{{ q.word }}</span>
          <span class="wrong-answer">{{ q.correctAnswer }}</span>
        </div>
      </div>
      <button class="btn-retry" @click="startErrorCorrection">继续答错题</button>
    </div>

    <!-- Complete Phase -->
    <div v-if="phase === 'complete'" class="phase-complete">
      <div class="complete-icon">🎉</div>
      <h2>考试完成！</h2>
      <div v-if="examScore != null" class="final-score">
        <span class="score-number large">{{ examScore }}</span>
        <span class="score-label">分</span>
      </div>
      <p>共 {{ rounds.length }} 轮完成</p>
      <button class="btn-home" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<style scoped>
.exam-page {
  padding: 14px 16px 90px;
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.btn-back {
  background: none;
  font-size: 15px;
  font-weight: 700;
  color: var(--p1);
}

.page-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
  margin-bottom: 8px;
}

.wordbook-selector {
  max-height: 200px;
  overflow-y: auto;
  border: 2.5px solid var(--line);
  border-radius: var(--r-md);
  padding: 10px;
  background: var(--paper);
}

.wordbook-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stepper button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--paper);
  border: 2.5px solid var(--line);
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 0 rgba(61,43,31,.08);
  transition: transform .12s, box-shadow .12s;
}

.stepper button:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(61,43,31,.08);
}

.stepper span {
  font-size: 18px;
  font-weight: 700;
  min-width: 28px;
  text-align: center;
  color: var(--ink);
}

.btn-start,
.btn-submit,
.btn-next,
.btn-retry,
.btn-home {
  width: 100%;
  padding: 16px;
  background: linear-gradient(180deg, #FF8E5E, #FF6B4B);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 16px;
  font-weight: 700;
  margin-top: 20px;
  box-shadow: 0 5px 0 #C04428;
  transition: transform .12s, box-shadow .12s;
}

.btn-start:active:not(:disabled),
.btn-submit:active:not(:disabled),
.btn-next:active,
.btn-retry:active,
.btn-home:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 #C04428;
}

.btn-start:disabled,
.btn-submit:disabled {
  opacity: 0.4;
}

.btn-retry {
  background: linear-gradient(180deg, #6FE0D8, #4ECDC4);
  box-shadow: 0 5px 0 #2BB8AE;
}

.btn-home {
  background: linear-gradient(180deg, #A78BFA, #8B5CF6);
  box-shadow: 0 5px 0 #6B3FC7;
}

/* Progress bar */
.progress-bar {
  height: 14px;
  background: #FFE5C9;
  border-radius: 8px;
  margin-bottom: 6px;
  overflow: hidden;
  border: 2px solid #E5C7A0;
  box-shadow: inset 0 2px 0 rgba(61,43,31,.08);
}

.progress-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--p1) 0%, #FF8E5E 50%, var(--p2) 100%);
  transition: width .45s cubic-bezier(.4,1.7,.5,1);
  box-shadow: 0 0 8px rgba(255,107,107,.6);
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);
  background-size: 50px 100%;
  animation: shimmer 1.6s linear infinite;
}

@keyframes shimmer {
  0% { background-position: -50px 0; }
  100% { background-position: calc(100% + 50px) 0; }
}

.test-counter {
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 600;
  text-align: center;
  margin-bottom: 14px;
}

/* Question card */
.question-card {
  background: var(--paper);
  border-radius: var(--r-lg);
  padding: 24px 20px;
  box-shadow: var(--shadow-card);
  border: 2.5px solid var(--line);
  margin-bottom: 18px;
  animation: slideUp .35s cubic-bezier(.4,1.7,.5,1);
  transition: transform .25s, box-shadow .25s, border-color .2s;
}

.question-card.correct-flash {
  border-color: var(--good);
  box-shadow: 0 0 0 4px rgba(81,207,102,.3), var(--shadow-card);
  animation: correctPulse .55s ease;
}

.question-card.wrong-flash {
  border-color: var(--bad);
  box-shadow: 0 0 0 4px rgba(255,107,107,.3), var(--shadow-card);
  animation: shake .45s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes correctPulse {
  0% { transform: scale(1); }
  30% { transform: scale(1.04) rotate(.5deg); }
  60% { transform: scale(.98); }
  100% { transform: scale(1); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.question-type {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 14px;
  letter-spacing: .5px;
}

.type-en2cn {
  background: #FFE5C9;
  color: #A55A00;
  border: 2px solid #FFB546;
}

.type-cn2en {
  background: #FFD8E0;
  color: #A23050;
  border: 2px solid #FF8FA8;
}

.type-fillBlank {
  background: #E2D5FF;
  color: #5D38B8;
  border: 2px solid #A78BFA;
}

.question-prompt {
  margin-bottom: 16px;
  text-align: center;
}

.prompt-text {
  font-size: 30px;
  font-weight: 700;
  color: var(--ink);
  word-break: break-word;
}

.prompt-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.prompt-row .prompt-text,
.prompt-row .sentence {
  margin-bottom: 0;
}

.sentence-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sentence-row .sentence {
  flex: 1;
  margin-bottom: 0;
}

.btn-speak {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 6px;
  transition: background .15s;
}

.btn-speak:active {
  background: var(--line);
}

.sentence {
  font-size: 16px;
  line-height: 1.6;
  color: var(--ink);
  font-weight: 500;
  margin-bottom: 8px;
}

.sentence-cn {
  font-size: 13px;
  color: var(--ink-light);
  line-height: 1.5;
  margin-bottom: 6px;
  font-style: italic;
}

.hint {
  font-size: 14px;
  color: var(--ink-light);
  font-weight: 500;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-btn {
  width: 100%;
  padding: 16px 18px;
  border: 2.5px solid var(--line);
  border-radius: 16px;
  background: var(--paper);
  font-size: 17px;
  font-weight: 600;
  color: var(--ink);
  text-align: left;
  box-shadow: 0 4px 0 rgba(61,43,31,.06);
  transition: transform .12s, box-shadow .12s, border-color .15s, background .15s;
}

.option-btn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(61,43,31,.06);
}

.option-btn.selected {
  border-color: var(--p2);
  background: #FFF8E8;
}

.input-area input {
  width: 100%;
  height: 54px;
  border: 2.5px solid var(--line);
  border-radius: 14px;
  padding: 0 16px;
  background: var(--paper-warm);
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
  transition: border-color .15s, box-shadow .15s;
}

.input-area input:focus {
  border-color: var(--p1);
  box-shadow: 0 0 0 3px rgba(255,107,107,.18);
  background: #fff;
}

.feedback {
  text-align: center;
  padding: 14px 16px;
  border-radius: 14px;
  font-weight: 700;
  animation: slideUp .25s ease;
}

.feedback.correct {
  background: #E8FAEC;
  color: var(--good-deep);
  border: 2px solid var(--good);
}

.feedback.wrong {
  background: #FFEBEB;
  color: var(--bad);
  border: 2px solid var(--bad);
}

.feedback-icon {
  font-size: 36px;
  margin-bottom: 6px;
}

.correct-answer {
  font-size: 15px;
  color: var(--ink-soft);
  font-weight: 600;
}

/* Sticky footer for buttons */
.sticky-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
  background: linear-gradient(to top, rgba(255,248,240,.98) 60%, rgba(255,248,240,0));
  padding-top: 24px;
  z-index: 100;
}

.sticky-footer .btn-submit,
.sticky-footer .btn-next {
  flex: 1;
  max-width: 400px;
}

/* Review & Score */
.phase-review {
  text-align: center;
  animation: slideUp .35s ease;
}

.phase-review h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 12px;
}

.score-display,
.final-score {
  margin-bottom: 16px;
}

.score-number {
  font-size: 52px;
  font-weight: 700;
  color: var(--p1);
}

.score-number.large {
  font-size: 72px;
}

.score-label {
  font-size: 18px;
  color: var(--ink-soft);
  font-weight: 600;
  margin-left: 4px;
}

.review-stats {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-bottom: 24px;
}

.stat-correct,
.stat-wrong {
  text-align: center;
  padding: 16px 22px;
  border-radius: 18px;
  min-width: 100px;
  border: 2.5px solid;
  box-shadow: 0 4px 0 rgba(61,43,31,.06);
  font-size: 28px;
  font-weight: 700;
}

.stat-correct {
  background: #E8FAEC;
  border-color: var(--good);
  color: var(--good-deep);
}

.stat-wrong {
  background: #FFEBEB;
  border-color: var(--bad);
  color: var(--bad);
}

.wrong-list {
  text-align: left;
  background: var(--paper);
  border-radius: var(--r-lg);
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-card);
  border: 2.5px solid var(--line);
}

.wrong-list h3 {
  font-size: 15px;
  color: var(--bad);
  margin-bottom: 10px;
  font-weight: 700;
}

.wrong-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1.5px dashed var(--line);
  font-size: 14px;
}

.wrong-item:last-child {
  border-bottom: none;
}

.wrong-word {
  font-weight: 700;
  color: var(--ink);
}

.wrong-answer {
  color: var(--ink-light);
  font-weight: 500;
}

/* Complete */
.phase-complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
  animation: slideUp .4s ease;
}

.complete-icon {
  font-size: 72px;
  animation: bounce .8s ease;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-20px); }
  60% { transform: translateY(-10px); }
}

.phase-complete h2 {
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
}

.phase-complete p {
  color: var(--ink-soft);
  font-size: 15px;
  font-weight: 600;
}
</style>
