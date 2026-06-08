<script setup lang="ts">
import type { LearningPlan } from '@/lib/types'

const props = defineProps<{
  plan: LearningPlan
  completed: boolean
  inProgress: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

function getStatusText() {
  if (props.completed) return '已完成'
  if (props.inProgress) return '进行中'
  return '未开始'
}

function getStatusClass() {
  if (props.completed) return 'status-done'
  if (props.inProgress) return 'status-progress'
  return 'status-pending'
}
</script>

<template>
  <div class="plan-card" :style="{ borderLeftColor: plan.color }" @click="emit('click')">
    <div class="plan-header">
      <h3 class="plan-name">{{ plan.name }}</h3>
      <span :class="['plan-status', getStatusClass()]">{{ getStatusText() }}</span>
    </div>
    <div class="plan-info">
      <span v-if="plan.englishToChineseCount">📘 选择{{ plan.englishToChineseCount }}题</span>
      <span v-if="plan.chineseToEnglishCount">✏️ 拼写{{ plan.chineseToEnglishCount }}题</span>
      <span v-if="plan.fillBlankCount">📝 填空{{ plan.fillBlankCount }}题</span>
    </div>
  </div>
</template>

<style scoped>
.plan-card {
  background: var(--paper);
  border-radius: var(--r-lg);
  padding: 18px 20px;
  margin-bottom: 12px;
  border-left: 5px solid #4285F4;
  box-shadow: var(--shadow-card);
  border-top: 2.5px solid var(--line);
  border-right: 2.5px solid var(--line);
  border-bottom: 2.5px solid var(--line);
  cursor: pointer;
  transition: transform .12s, box-shadow .12s;
}

.plan-card:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 rgba(61,43,31,.08);
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.plan-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
}

.plan-status {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
}

.status-done {
  background: linear-gradient(180deg, #D4F5D4, #B8EDBA);
  color: #2A7A2A;
  border: 2px solid #8DD88D;
}

.status-progress {
  background: linear-gradient(180deg, #FFF1C5, #FFE082);
  color: #7A5400;
  border: 2px solid #F0C040;
}

.status-pending {
  background: var(--paper-warm);
  color: var(--ink-light);
  border: 2px solid var(--line);
}

.plan-info {
  display: flex;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}
</style>
