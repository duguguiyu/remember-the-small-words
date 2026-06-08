<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlansStore } from '@/stores/plans'
import { useWordbooksStore } from '@/stores/wordbooks'
import { useWordsStore } from '@/stores/words'
import { useSessionsStore } from '@/stores/sessions'
import { useProgressStore } from '@/stores/progress'
import { selectWords } from '@/lib/sm2'
import { generateQuestions, checkAnswer } from '@/lib/questions'
import { getBeijingDateStr } from '@/lib/date'
import { Storage, KEYS } from '@/lib/storage'
import { playCorrectSound, playWrongSound } from '@/lib/sound'
import type { Word, Question, QuestionResult, Round, InProgressState } from '@/lib/types'
import CountdownTimer from '@/components/CountdownTimer.vue'
import confetti from 'canvas-confetti'

const route = useRoute()
const router = useRouter()
const plansStore = usePlansStore()
const wordbooksStore = useWordbooksStore()
const wordsStore = useWordsStore()
const sessionsStore = useSessionsStore()
const progressStore = useProgressStore()

const phase = ref<'preview' | 'confirm' | 'test' | 'review' | 'complete'>('preview')
const previewIndex = ref(0)
const countdownDone = ref(false)
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
const comboCount = ref(0)
const showCombo = ref(false)
const comboText = ref('')
const sessionId = ref('')
const planName = ref('')
const planColor = ref('#4285F4')

const currentWord = computed(() => allWords.value[previewIndex.value])
const currentQuestion = computed(() => questions.value[questionIndex.value])
const wrongQuestions = computed(() => {
  return questions.value.filter((q, i) => {
    const r = results.value[i]
    return r && !r.correct
  })
})

onMounted(async () => {
  await Promise.all([
    plansStore.load(),
    wordbooksStore.load(),
    wordsStore.load(),
    sessionsStore.load(),
    progressStore.load(),
  ])

  if (progressStore.current && progressStore.current.type === 'learn') {
    restoreProgress(progressStore.current)
    return
  }

  const planId = route.params.planId as string
  const plan = plansStore.plans.find((p) => p.id === planId)
  if (!plan) {
    router.replace({ name: 'home' })
    return
  }

  planName.value = plan.name
  planColor.value = plan.color
  sessionId.value = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const poolWords = wordbooksStore.getWordsByWordbookIds(plan.wordbookIds)
  if (poolWords.length === 0) {
    alert('选中的词库中没有单词')
    router.replace({ name: 'home' })
    return
  }

  const total = plan.englishToChineseCount + plan.chineseToEnglishCount + plan.fillBlankCount
  const selected = selectWords(poolWords, total, wordsStore.stats)

  let offset = 0
  const en2cnWords = selected.slice(offset, offset + plan.englishToChineseCount)
  offset += en2cnWords.length
  const cn2enWords = selected.slice(offset, offset + plan.chineseToEnglishCount)
  offset += cn2enWords.length
  const remaining = selected.slice(offset)
  let fbCandidates = remaining.filter((w) => w.exampleEn)
  if (fbCandidates.length < plan.fillBlankCount) {
    const usedSet = new Set(fbCandidates.map((w) => w.english))
    const extra = selected.slice(0, offset).filter((w) => w.exampleEn && !usedSet.has(w.english))
    fbCandidates = [...fbCandidates, ...extra]
  }
  const fillBlankWords = fbCandidates.slice(0, plan.fillBlankCount)

  const uniqueWords = [...new Map([...en2cnWords, ...cn2enWords, ...fillBlankWords].map((w) => [w.english, w])).values()]
  allWords.value = uniqueWords

  questions.value = generateQuestions(en2cnWords, cn2enWords, fillBlankWords, poolWords)

  phase.value = 'preview'
  previewIndex.value = 0
  countdownDone.value = false
  speakWord(allWords.value[0].english)
  saveProgress()
})

function restoreProgress(state: InProgressState) {
  sessionId.value = state.sessionId
  planName.value = state.planName
  planColor.value = state.planColor
  phase.value = state.phase as any
  previewIndex.value = state.previewIndex
  questionIndex.value = state.questionIndex
  questions.value = state.questions
  results.value = state.results
  roundNumber.value = state.roundNumber
  rounds.value = state.rounds
  allWords.value = state.allWords
  countdownDone.value = true
}

async function saveProgress() {
  const state: InProgressState = {
    sessionId: sessionId.value,
    type: 'learn',
    planId: (route.params.planId as string) || null,
    planName: planName.value,
    planColor: planColor.value,
    phase: phase.value as InProgressState['phase'],
    previewIndex: previewIndex.value,
    questionIndex: questionIndex.value,
    questions: questions.value,
    results: results.value,
    roundNumber: roundNumber.value,
    rounds: rounds.value,
    allWords: allWords.value,
    timestamp: Date.now(),
  }
  await progressStore.setState(state)
}

function nextPreview() {
  if (previewIndex.value < allWords.value.length - 1) {
    previewIndex.value++
    countdownDone.value = false
    speakWord(allWords.value[previewIndex.value].english)
  } else {
    phase.value = 'confirm'
  }
  saveProgress()
}

function startTest() {
  phase.value = 'test'
  questionIndex.value = 0
  results.value = []
  showFeedback.value = false
  saveProgress()
}

function speakSentence(sentence?: string) {
  if (!sentence) return
  const text = sentence.replace(/______/g, 'blank')
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  speechSynthesis.speak(utterance)
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
    comboCount.value++
    if ([3, 5, 7, 10, 15].includes(comboCount.value)) {
      comboText.value = `${comboCount.value}连击！`
      showCombo.value = true
      setTimeout(() => (showCombo.value = false), 1500)
    }
  } else {
    playWrongSound()
    comboCount.value = 0
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

  if (wc === 0) {
    completeLearning()
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

async function completeLearning() {
  phase.value = 'complete'
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })

  const streak = await Storage.get(KEYS.STREAK, { count: 0, lastDay: '' })
  const today = getBeijingDateStr()
  if (streak.lastDay !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    if (streak.lastDay === yesterdayStr) {
      streak.count++
    } else {
      streak.count = 1
    }
    streak.lastDay = today
    await Storage.set(KEYS.STREAK, streak)
  }

  await sessionsStore.addSession({
    id: sessionId.value,
    type: 'learn',
    date: today,
    planId: (route.params.planId as string) || null,
    planName: planName.value,
    planColor: planColor.value,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    words: allWords.value.map((w) => w.english),
    rounds: rounds.value,
    totalRounds: rounds.value.length,
    score: null,
    status: 'completed',
  })

  await progressStore.clear()
}

function speakWord(text: string) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.8
    speechSynthesis.speak(utterance)
  }
}

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="learn-page">
    <!-- Preview Phase -->
    <div v-if="phase === 'preview'" class="phase-preview">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${((previewIndex + 1) / allWords.length) * 100}%` }"></div>
      </div>
      <div class="preview-counter">{{ previewIndex + 1 }} / {{ allWords.length }}</div>

      <div v-if="currentWord" class="word-card">
        <h2 class="word-english" @click="speakWord(currentWord.english)">
          {{ currentWord.english }} 🔊
        </h2>
        <p class="word-phonetic">{{ currentWord.phonetic }}</p>
        <p class="word-chinese">{{ currentWord.chinese }}</p>
        <div v-if="currentWord.exampleEn" class="word-example">
          <p class="example-en">{{ currentWord.exampleEn }}</p>
          <p class="example-cn">{{ currentWord.exampleCn }}</p>
        </div>
        <div v-if="currentWord.explanation" class="word-explanation">
          {{ currentWord.explanation }}
        </div>
      </div>

      <div class="sticky-footer">
        <CountdownTimer :seconds="3" :active="!countdownDone" @done="countdownDone = true" />
        <button class="btn-next" :disabled="!countdownDone" @click="nextPreview">
          {{ previewIndex < allWords.length - 1 ? '下一个' : '开始测试' }}
        </button>
      </div>
    </div>

    <!-- Confirm Phase -->
    <div v-if="phase === 'confirm'" class="phase-confirm">
      <h2>准备开始测试</h2>
      <div class="confirm-info">
        <p>共 {{ allWords.length }} 个单词</p>
        <p>{{ questions.length }} 道题目</p>
      </div>
      <button class="btn-start" @click="startTest">开始测试</button>
    </div>

    <!-- Test Phase -->
    <div v-if="phase === 'test'" class="phase-test">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${((questionIndex + 1) / questions.length) * 100}%` }"></div>
      </div>
      <div class="test-counter">
        第{{ roundNumber }}轮 · {{ questionIndex + 1 }}/{{ questions.length }}
      </div>

      <!-- Combo banner -->
      <div v-if="showCombo" class="combo-banner">{{ comboText }}</div>

      <div v-if="currentQuestion" :class="['question-card', showFeedback && lastCorrect ? 'correct-flash' : '', showFeedback && !lastCorrect ? 'wrong-flash' : '']">
        <div :class="['question-type', 'type-' + currentQuestion.type]">
          {{ currentQuestion.type === 'en2cn' ? '📘 看英文选中文' : currentQuestion.type === 'cn2en' ? '✏️ 看中文写英文' : '📝 例句填空' }}
        </div>

        <div class="question-prompt">
          <template v-if="currentQuestion.type === 'fillBlank'">
            <p class="sentence">{{ currentQuestion.sentence }}</p>
            <p v-if="currentQuestion.exampleCn" class="sentence-cn">{{ currentQuestion.exampleCn }}</p>
            <p v-else class="hint">{{ currentQuestion.prompt }}</p>
          </template>
          <template v-else>
            <p class="prompt-text">{{ currentQuestion.prompt }}</p>
          </template>
        </div>

        <!-- Multiple choice -->
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

        <!-- Text input -->
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

        <!-- Feedback -->
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
      <div class="review-stats">
        <div class="stat-correct">
          ✓ {{ rounds[rounds.length - 1]?.correctCount || 0 }}
        </div>
        <div class="stat-wrong">
          ✗ {{ rounds[rounds.length - 1]?.wrongCount || 0 }}
        </div>
      </div>
      <div class="wrong-list">
        <h3>错题列表</h3>
        <div v-for="q in wrongQuestions" :key="q.word" class="wrong-item">
          <span class="wrong-word">{{ q.word }}</span>
          <span class="wrong-answer">{{ q.correctAnswer }}</span>
        </div>
      </div>
      <button class="btn-retry" @click="startErrorCorrection">再来一轮</button>
    </div>

    <!-- Complete Phase -->
    <div v-if="phase === 'complete'" class="phase-complete">
      <div class="complete-icon">🎉</div>
      <h2>全部完成！</h2>
      <p>共 {{ rounds.length }} 轮完成所有题目</p>
      <button class="btn-home" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<style scoped>
.learn-page {
  padding: 14px 16px 90px;
  min-height: 100vh;
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
  background: linear-gradient(90deg, #FF8E5E 0%, #FFB546 50%, #FFD93D 100%);
  transition: width .45s cubic-bezier(.4,1.7,.5,1);
  box-shadow: 0 0 8px rgba(255,181,70,.6);
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

.preview-counter,
.test-counter {
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 600;
  margin-bottom: 14px;
}

.round-pill {
  display: inline-block;
  background: var(--p4);
  color: #fff;
  padding: 3px 10px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 6px;
}

/* Preview word card */
.word-card {
  background: var(--paper);
  border-radius: var(--r-lg);
  padding: 24px 20px;
  text-align: center;
  box-shadow: var(--shadow-card);
  border: 2.5px solid var(--line);
  margin-bottom: 24px;
  animation: slideUp .35s cubic-bezier(.4,1.7,.5,1);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.word-english {
  font-size: 30px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 8px;
  cursor: pointer;
}

.word-phonetic {
  font-size: 14px;
  color: var(--ink-light);
  margin-bottom: 12px;
  font-weight: 500;
}

.word-chinese {
  font-size: 22px;
  font-weight: 700;
  color: var(--p1-deep);
  margin-bottom: 16px;
}

.word-example {
  text-align: left;
  padding: 12px 14px;
  background: var(--paper-warm);
  border: 2px solid var(--line);
  border-radius: var(--r-sm);
  margin-bottom: 12px;
}

.example-en {
  font-size: 14px;
  color: var(--ink);
  margin-bottom: 4px;
  font-weight: 500;
}

.example-cn {
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 500;
}

.word-explanation {
  font-size: 13px;
  color: var(--ink-soft);
  text-align: left;
  padding-top: 10px;
  border-top: 2px dashed var(--line);
  white-space: pre-wrap;
  font-weight: 500;
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

/* Shared buttons */
.btn-next,
.btn-start,
.btn-submit,
.btn-retry,
.btn-home {
  padding: 14px 30px;
  background: linear-gradient(180deg, #FF8E5E, #FF6B4B);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 5px 0 #C04428;
  transition: transform .12s, box-shadow .12s;
}

.btn-next:active:not(:disabled),
.btn-start:active,
.btn-submit:active:not(:disabled),
.btn-retry:active,
.btn-home:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 #C04428;
}

.btn-next:disabled,
.btn-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-retry {
  background: linear-gradient(180deg, #6FE0D8, #4ECDC4);
  box-shadow: 0 5px 0 #2BB8AE;
}

.btn-retry:active {
  box-shadow: 0 2px 0 #2BB8AE;
}

.btn-home {
  background: linear-gradient(180deg, #A78BFA, #8B5CF6);
  box-shadow: 0 5px 0 #6B3FC7;
}

.btn-home:active {
  box-shadow: 0 2px 0 #6B3FC7;
}

/* Confirm phase */
.phase-confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 20px;
  animation: slideUp .35s ease;
}

.phase-confirm h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
}

.confirm-info {
  text-align: center;
  color: var(--ink-soft);
  font-size: 16px;
  font-weight: 600;
}

.confirm-info p {
  margin: 6px 0;
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
  line-height: 1.2;
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

/* Options */
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

.option-btn:active:not(.disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(61,43,31,.06);
  border-color: var(--p2);
  background: #FFF8E8;
}

.option-btn.selected {
  border-color: var(--p2);
  background: #FFF8E8;
  box-shadow: 0 4px 0 rgba(255,181,70,.2);
}

/* Input */
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
  transition: border-color .15s, box-shadow .15s, background .15s;
}

.input-area input:focus {
  border-color: var(--p1);
  box-shadow: 0 0 0 3px rgba(255,107,107,.18);
  background: #fff;
}

/* Feedback */
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

.sticky-footer .btn-submit,
.sticky-footer .btn-next {
  flex: 1;
  max-width: 400px;
}

/* Combo banner */
.combo-banner {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #FFD93D, #FF8E5E);
  color: #fff;
  padding: 10px 24px;
  border-radius: 50px;
  font-size: 18px;
  font-weight: 700;
  z-index: 9000;
  box-shadow: 0 8px 24px rgba(255,107,107,.4);
  border: 3px solid #fff;
  letter-spacing: .5px;
  animation: comboPop 1.1s cubic-bezier(.4,1.8,.5,1);
}

@keyframes comboPop {
  0% { opacity: 0; transform: translateX(-50%) scale(.4) rotate(-15deg); }
  20% { opacity: 1; transform: translateX(-50%) scale(1.15) rotate(5deg); }
  35% { transform: translateX(-50%) scale(.95) rotate(-2deg); }
  50% { transform: translateX(-50%) scale(1) rotate(0deg); }
  85% { opacity: 1; }
  100% { opacity: 0; transform: translateX(-50%) scale(1) translateY(-30px); }
}

/* Review phase */
.phase-review {
  text-align: center;
  animation: slideUp .35s ease;
}

.phase-review h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 16px;
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
  align-items: center;
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
  font-size: 13px;
  font-weight: 500;
}

/* Complete phase */
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
