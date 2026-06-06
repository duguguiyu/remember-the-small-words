<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlansStore } from '@/stores/plans'
import { useSessionsStore } from '@/stores/sessions'
import { useWordbooksStore } from '@/stores/wordbooks'
import { useProgressStore } from '@/stores/progress'
import { Storage, KEYS } from '@/lib/storage'
import { getBeijingDateStr } from '@/lib/date'
import PlanCard from '@/components/PlanCard.vue'

const router = useRouter()
const plansStore = usePlansStore()
const sessionsStore = useSessionsStore()
const wordbooksStore = useWordbooksStore()
const progressStore = useProgressStore()

const showResumeDialog = ref(false)
const backupReminder = ref(false)
const streak = ref({ count: 0, lastDay: '' })

const completedPlanIds = computed(() => sessionsStore.getTodayCompletedPlanIds())
const inProgressPlanIds = computed(() => {
  const today = getBeijingDateStr()
  return sessionsStore.sessions
    .filter((s) => s.date === today && s.status === 'in_progress' && s.planId)
    .map((s) => s.planId!)
})

onMounted(async () => {
  await Promise.all([
    plansStore.load(),
    sessionsStore.load(),
    wordbooksStore.load(),
    progressStore.load(),
  ])

  streak.value = await Storage.get(KEYS.STREAK, { count: 0, lastDay: '' })

  if (progressStore.current) {
    showResumeDialog.value = true
  }

  const lastBackup = await Storage.get<string | null>(KEYS.LAST_BACKUP, null)
  if (lastBackup) {
    const diff = Date.now() - new Date(lastBackup).getTime()
    if (diff > 3 * 24 * 3600 * 1000) {
      backupReminder.value = true
    }
  } else {
    backupReminder.value = true
  }

})

function startPlan(planId: string) {
  router.push({ name: 'learn', params: { planId } })
}

function startExam() {
  router.push({ name: 'exam' })
}

function resumeSession() {
  showResumeDialog.value = false
  if (progressStore.current) {
    if (progressStore.current.type === 'exam') {
      router.push({ name: 'exam' })
    } else {
      router.push({ name: 'learn', params: { planId: progressStore.current.planId || '' } })
    }
  }
}

async function discardSession() {
  showResumeDialog.value = false
  await progressStore.clear()
}
</script>

<template>
  <div class="home-page">
    <header class="home-header">
      <h1>Josh 背单词</h1>
      <div class="streak-badge" v-if="streak.count > 0">
        🔥 {{ streak.count }}天
      </div>
    </header>

    <div v-if="wordbooksStore.syncing" class="sync-bar">正在同步词库...</div>
    <div v-if="wordbooksStore.lastSyncError" class="sync-error">
      词库同步失败: {{ wordbooksStore.lastSyncError }}
    </div>

    <div v-if="backupReminder" class="backup-reminder" @click="router.push({ name: 'settings' })">
      ⚠️ 已超过3天未备份数据，点击前往备份
    </div>

    <!-- Resume dialog -->
    <div v-if="showResumeDialog" class="resume-dialog">
      <div class="resume-content">
        <p>检测到未完成的学习进度</p>
        <div class="resume-actions">
          <button class="btn-resume" @click="resumeSession">继续上次学习</button>
          <button class="btn-discard" @click="discardSession">重新开始</button>
        </div>
      </div>
    </div>

    <!-- Plan cards -->
    <section class="plans-section">
      <div v-if="plansStore.plans.length === 0" class="empty-state">
        <p>还没有学习计划</p>
        <button class="btn-create" @click="router.push({ name: 'settings' })">创建计划</button>
      </div>
      <PlanCard
        v-for="plan in plansStore.plans"
        :key="plan.id"
        :plan="plan"
        :completed="completedPlanIds.includes(plan.id)"
        :in-progress="inProgressPlanIds.includes(plan.id)"
        @click="startPlan(plan.id)"
      />
    </section>

    <!-- Exam entry -->
    <section class="exam-section">
      <button class="btn-exam" @click="startExam">
        📝 开始考试
      </button>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.home-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
}

.streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(180deg, #FFE0E0, #FFB8B8);
  border: 2px solid #FF8585;
  padding: 6px 12px;
  border-radius: 20px;
  color: #A23030;
  box-shadow: 0 2px 0 rgba(61,43,31,.08);
}

.sync-bar {
  font-size: 12px;
  color: var(--ink-soft);
  text-align: center;
  padding: 8px 12px;
  background: var(--paper-warm);
  border: 2px solid var(--line);
  border-radius: var(--r-sm);
  margin-bottom: 12px;
}

.sync-error {
  font-size: 12px;
  color: var(--bad);
  text-align: center;
  padding: 8px 12px;
  background: #FFF0F0;
  border: 2px solid #FFD0D0;
  border-radius: var(--r-sm);
  margin-bottom: 12px;
}

.backup-reminder {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #7A5400;
  background: linear-gradient(135deg, #FFF1C5, #FFE082);
  padding: 14px 16px;
  border-radius: var(--r-md);
  border: 2.5px solid #F0C040;
  margin-bottom: 14px;
  cursor: pointer;
  box-shadow: 0 4px 0 rgba(61,43,31,.08);
}

.resume-dialog {
  background: var(--paper);
  border: 2.5px solid var(--line);
  border-radius: var(--r-lg);
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
}

.resume-content p {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
  color: var(--ink);
}

.resume-actions {
  display: flex;
  gap: 10px;
}

.btn-resume {
  flex: 1;
  padding: 12px;
  background: linear-gradient(180deg, #FF8E5E, #FF6B4B);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 4px 0 #C04428;
  transition: transform .12s, box-shadow .12s;
}

.btn-resume:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #C04428;
}

.btn-discard {
  flex: 1;
  padding: 12px;
  background: var(--paper);
  color: var(--ink-soft);
  border: 2.5px solid var(--line);
  border-radius: var(--r-md);
  font-size: 14px;
  font-weight: 600;
}

.plans-section {
  margin-bottom: 20px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--ink-light);
}

.empty-state p {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.btn-create {
  padding: 12px 28px;
  background: linear-gradient(180deg, #6FE0D8, #4ECDC4);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 4px 0 #2BB8AE;
  transition: transform .12s, box-shadow .12s;
}

.btn-create:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #2BB8AE;
}

.exam-section {
  padding: 0;
}

.btn-exam {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: var(--paper);
  color: var(--ink);
  border-radius: var(--r-lg);
  font-size: 16px;
  font-weight: 700;
  border: 2.5px solid var(--line);
  box-shadow: 0 4px 0 rgba(61,43,31,.08);
  transition: transform .12s, box-shadow .12s;
}

.btn-exam:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 rgba(61,43,31,.08);
}
</style>
