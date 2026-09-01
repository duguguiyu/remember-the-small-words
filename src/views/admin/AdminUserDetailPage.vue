<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { getBeijingDateStr, getDateRange, formatDate } from '@/lib/date'
import type { LearningPlan, SessionRecord, WordStats } from '@/lib/types'

interface Detail {
  user: { id: string; username: string; role: string; disabled: boolean; createdAt: string }
  streak: { count: number; lastDay: string }
  plans: LearningPlan[]
  sessions: SessionRecord[]
  wordStats: Record<string, WordStats>
  hasInProgress: boolean
}

const route = useRoute()
const router = useRouter()
const detail = ref<Detail | null>(null)
const importing = ref(false)
const importMsg = ref('')

async function load() {
  detail.value = await api<Detail>(`/api/admin/users/${route.params.id}`)
}

onMounted(load)

const dateList = computed(() => {
  if (!detail.value?.sessions.length) return []
  const dates = detail.value.sessions.map((s) => s.date).sort()
  const today = getBeijingDateStr()
  return getDateRange(dates[0], today).reverse()
})

function sessionsFor(date: string) {
  return detail.value?.sessions.filter((s) => s.date === date) || []
}

function accuracy(round: { correctCount: number; wrongCount: number }) {
  const total = round.correctCount + round.wrongCount
  if (!total) return '0%'
  return Math.round((round.correctCount / total) * 100) + '%'
}

const hardWords = computed(() => {
  const stats = Object.values(detail.value?.wordStats || {})
  return stats
    .filter((s) => s.reviewCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount || b.reviewCount - a.reviewCount)
    .slice(0, 20)
})

async function importBackup(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !detail.value) return
  importing.value = true
  importMsg.value = ''
  try {
    const data = JSON.parse(await file.text())
    await api(`/api/admin/users/${detail.value.user.id}/import-backup`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    importMsg.value = '旧备份已覆盖导入'
    await load()
  } catch (err: any) {
    importMsg.value = err.message || '导入失败'
  } finally {
    importing.value = false
    input.value = ''
  }
}
</script>

<template>
  <div v-if="detail">
    <button class="back" @click="router.push({ name: 'admin-users' })">‹ 返回名册</button>
    <header class="head">
      <div>
        <h1>{{ detail.user.username }}</h1>
        <p>
          {{ detail.user.role === 'admin' ? '管理员' : '学员' }}
          · 连胜 {{ detail.streak.count }} 天
          · {{ detail.hasInProgress ? '有未完成进度' : '当前没有进行中的学习' }}
        </p>
      </div>
      <label class="import">
        导入旧备份 JSON
        <input type="file" accept=".json,application/json" :disabled="importing" @change="importBackup" />
      </label>
    </header>
    <p v-if="importMsg" class="note">{{ importMsg }}</p>

    <section class="card block">
      <h2>学习计划</h2>
      <p v-if="detail.plans.length === 0" class="muted">还没有计划</p>
      <ul>
        <li v-for="p in detail.plans" :key="p.id">
          <span class="dot" :style="{ background: p.color }"></span>
          {{ p.name }}
          <small>{{ p.wordbookIds.length }} 本词库 · {{ p.englishToChineseCount }}/{{ p.chineseToEnglishCount }}/{{ p.fillBlankCount }}</small>
        </li>
      </ul>
    </section>

    <section class="card block">
      <h2>容易错的词</h2>
      <p v-if="hardWords.length === 0" class="muted">还没有记忆数据</p>
      <table v-else>
        <thead>
          <tr><th>单词</th><th>复习</th><th>对</th><th>错</th><th>下次</th></tr>
        </thead>
        <tbody>
          <tr v-for="w in hardWords" :key="w.english">
            <td>{{ w.english }}</td>
            <td>{{ w.reviewCount }}</td>
            <td>{{ w.correctCount }}</td>
            <td>{{ w.wrongCount }}</td>
            <td>{{ w.nextReviewTime || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="block">
      <h2>打卡记录</h2>
      <div v-if="dateList.length === 0" class="muted">暂无学习记录</div>
      <div v-for="date in dateList" :key="date" class="date-block">
        <div class="date-header">
          <strong>{{ formatDate(date) }}</strong>
          <span v-if="date === getBeijingDateStr()" class="today">今天</span>
        </div>
        <div v-if="sessionsFor(date).length === 0" class="muted">未学习</div>
        <div v-for="session in sessionsFor(date)" :key="session.id" class="session" :style="{ borderLeftColor: session.planColor }">
          <div class="session-top">
            <b>{{ session.type === 'exam' ? '考试' : session.planName }}</b>
            <span v-if="session.score != null">{{ session.score }} 分</span>
            <span>{{ session.status === 'completed' ? '已完成' : '未完成' }}</span>
          </div>
          <div class="muted">{{ session.words.length }} 词 · {{ session.totalRounds }} 轮</div>
          <div v-for="round in session.rounds" :key="round.roundNumber" class="muted">
            第{{ round.roundNumber }}轮 正确率 {{ accuracy(round) }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.back { background: none; color: var(--ink-soft); font-weight: 700; margin-bottom: 12px; }
.head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; }
.head h1 { font-size: 28px; }
.head p { color: var(--ink-soft); }
.import {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  background: var(--paper);
  border: 2px dashed var(--p2);
  padding: 10px 14px;
  border-radius: 14px;
}
.note { margin-bottom: 16px; font-weight: 700; color: var(--p3-deep); }
.block { margin-bottom: 18px; }
h2 { font-size: 18px; margin-bottom: 10px; }
.muted { color: var(--ink-light); font-size: 13px; }
ul { list-style: none; }
li { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-weight: 600; }
li small { color: var(--ink-light); font-weight: 500; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px dashed var(--line); font-size: 13px; }
.date-block { margin-bottom: 16px; }
.date-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.today { background: var(--p2); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 2px 8px; }
.session {
  background: var(--paper);
  border: 2px solid var(--line);
  border-left: 4px solid var(--p2);
  border-radius: 16px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.session-top { display: flex; gap: 10px; font-weight: 700; margin-bottom: 4px; }
</style>
