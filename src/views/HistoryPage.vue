<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useSessionsStore } from '@/stores/sessions'
import { getBeijingDateStr, getDateRange, formatDate } from '@/lib/date'

const sessionsStore = useSessionsStore()

onMounted(async () => {
  await sessionsStore.load()
})

const dateList = computed(() => {
  const first = sessionsStore.firstSessionDate
  if (!first) return []
  const today = getBeijingDateStr()
  return getDateRange(first, today).reverse()
})

function getSessionsForDate(date: string) {
  return sessionsStore.getSessionsByDate(date)
}

function getRoundAccuracy(round: { correctCount: number; wrongCount: number }) {
  const total = round.correctCount + round.wrongCount
  if (total === 0) return '0%'
  return Math.round((round.correctCount / total) * 100) + '%'
}
</script>

<template>
  <div class="history-page">
    <header class="page-header">
      <h2>学习记录</h2>
    </header>

    <div v-if="dateList.length === 0" class="empty-state">
      <p>暂无学习记录</p>
    </div>

    <div v-for="date in dateList" :key="date" class="date-block">
      <div class="date-header">
        <span class="date-text">{{ formatDate(date) }}</span>
        <span v-if="date === getBeijingDateStr()" class="today-badge">今天</span>
      </div>

      <div v-if="getSessionsForDate(date).length === 0" class="no-session">
        未学习
      </div>

      <div
        v-for="session in getSessionsForDate(date)"
        :key="session.id"
        class="session-card"
        :style="{ borderLeftColor: session.planColor }"
      >
        <div class="session-header">
          <span class="session-name">
            {{ session.type === 'exam' ? '📝 考试' : session.planName }}
          </span>
          <span v-if="session.score != null" class="session-score">
            {{ session.score }}分
          </span>
          <span
            :class="['session-status', session.status === 'completed' ? 'done' : 'incomplete']"
          >
            {{ session.status === 'completed' ? '已完成' : '未完成' }}
          </span>
        </div>
        <div class="session-detail">
          <span>{{ session.words.length }}词</span>
          <span>{{ session.totalRounds }}轮</span>
        </div>
        <div v-if="session.rounds.length > 0" class="rounds-list">
          <div v-for="round in session.rounds" :key="round.roundNumber" class="round-item">
            <span>第{{ round.roundNumber }}轮</span>
            <span>正确率 {{ getRoundAccuracy(round) }}</span>
            <span>{{ round.correctCount }}/{{ round.correctCount + round.wrongCount }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  padding: 14px 16px 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-soft);
  font-size: 15px;
  font-weight: 600;
}

.date-block {
  margin-bottom: 20px;
}

.date-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.date-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.today-badge {
  font-size: 11px;
  background: var(--p2);
  color: #fff;
  padding: 2px 8px;
  border-radius: 50px;
  font-weight: 700;
}

.no-session {
  font-size: 13px;
  color: var(--ink-light);
  padding: 8px 0;
  font-weight: 500;
}

.session-card {
  background: var(--paper);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  margin-bottom: 10px;
  border-left: 4px solid var(--p2);
  box-shadow: 0 3px 0 rgba(61,43,31,.06);
  border-top: 2px solid var(--line);
  border-right: 2px solid var(--line);
  border-bottom: 2px solid var(--line);
  transition: transform .12s;
}

.session-card:active {
  transform: translateY(1px);
}

.session-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.session-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  flex: 1;
}

.session-score {
  font-size: 15px;
  font-weight: 700;
  color: var(--p1);
}

.session-status {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 50px;
  font-weight: 700;
}

.session-status.done {
  background: #E8FAEC;
  color: var(--good-deep);
  border: 1.5px solid var(--good);
}

.session-status.incomplete {
  background: #FFF1C5;
  color: #7A5400;
  border: 1.5px solid #F0C040;
}

.session-detail {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 500;
  margin-bottom: 6px;
}

.rounds-list {
  border-top: 1.5px dashed var(--line);
  padding-top: 8px;
  margin-top: 6px;
}

.round-item {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 500;
  padding: 4px 0;
}
</style>
