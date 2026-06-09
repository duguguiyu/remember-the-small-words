<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue'
import { usePlansStore } from '@/stores/plans'
import { useWordbooksStore } from '@/stores/wordbooks'
import { useSessionsStore } from '@/stores/sessions'
import { useWordsStore } from '@/stores/words'
import { Storage, KEYS } from '@/lib/storage'
import { PLAN_COLORS } from '@/lib/types'
import type { LearningPlan, BackupData, Wordbook } from '@/lib/types'

const plansStore = usePlansStore()
const wordbooksStore = useWordbooksStore()
const sessionsStore = useSessionsStore()
const wordsStore = useWordsStore()

const showPlanEditor = ref(false)
const editingPlanId = ref<string | null>(null)
const planForm = reactive({
  name: '',
  wordbookIds: [] as string[],
  englishToChineseCount: 10,
  chineseToEnglishCount: 10,
  fillBlankCount: 5,
  color: '',
})

const settings = reactive({
  ttsEnabled: true,
  soundEnabled: true,
})

onMounted(async () => {
  await Promise.all([
    plansStore.load(),
    wordbooksStore.load(),
    sessionsStore.load(),
    wordsStore.load(),
  ])
  const saved = await Storage.get(KEYS.SETTINGS, { ttsEnabled: true, soundEnabled: true })
  settings.ttsEnabled = saved.ttsEnabled
  settings.soundEnabled = saved.soundEnabled
})

function openNewPlan() {
  editingPlanId.value = null
  planForm.name = ''
  planForm.wordbookIds = []
  planForm.englishToChineseCount = 10
  planForm.chineseToEnglishCount = 10
  planForm.fillBlankCount = 5
  planForm.color = plansStore.getRandomColor()
  expandedCategories.value = new Set()
  showPlanEditor.value = true
}

function openEditPlan(plan: LearningPlan) {
  editingPlanId.value = plan.id
  planForm.name = plan.name
  planForm.wordbookIds = [...plan.wordbookIds]
  planForm.englishToChineseCount = plan.englishToChineseCount
  planForm.chineseToEnglishCount = plan.chineseToEnglishCount
  planForm.fillBlankCount = plan.fillBlankCount
  planForm.color = plan.color
  // Expand categories that have selected wordbooks
  const cats = new Set<string>()
  for (const id of plan.wordbookIds) {
    const wb = wordbooksStore.wordbooks.find(w => w.id === id)
    if (wb) cats.add(wb.category)
  }
  expandedCategories.value = cats
  showPlanEditor.value = true
}

async function savePlan() {
  if (!planForm.name.trim()) return
  if (planForm.wordbookIds.length === 0) return

  if (editingPlanId.value) {
    await plansStore.updatePlan(editingPlanId.value, { ...planForm })
  } else {
    await plansStore.addPlan({ ...planForm })
  }
  showPlanEditor.value = false
}

async function deletePlan() {
  if (editingPlanId.value) {
    await plansStore.removePlan(editingPlanId.value)
    showPlanEditor.value = false
  }
}

const expandedCategories = ref<Set<string>>(new Set())

interface CategoryGroup {
  category: string
  categoryName: string
  books: Wordbook[]
}

const groupedWordbooks = computed<CategoryGroup[]>(() => {
  const map = new Map<string, CategoryGroup>()
  for (const book of wordbooksStore.wordbooks) {
    if (!map.has(book.category)) {
      map.set(book.category, { category: book.category, categoryName: book.categoryName, books: [] })
    }
    map.get(book.category)!.books.push(book)
  }
  return Array.from(map.values())
})

function toggleCategory(category: string) {
  if (expandedCategories.value.has(category)) {
    expandedCategories.value.delete(category)
  } else {
    expandedCategories.value.add(category)
  }
}

function isCategoryAllSelected(group: CategoryGroup): boolean {
  return group.books.every(b => planForm.wordbookIds.includes(b.id))
}

function isCategoryPartialSelected(group: CategoryGroup): boolean {
  const selected = group.books.filter(b => planForm.wordbookIds.includes(b.id))
  return selected.length > 0 && selected.length < group.books.length
}

function toggleCategorySelection(group: CategoryGroup) {
  if (isCategoryAllSelected(group)) {
    for (const b of group.books) {
      const idx = planForm.wordbookIds.indexOf(b.id)
      if (idx >= 0) planForm.wordbookIds.splice(idx, 1)
    }
  } else {
    for (const b of group.books) {
      if (!planForm.wordbookIds.includes(b.id)) {
        planForm.wordbookIds.push(b.id)
      }
    }
  }
}

function toggleWordbook(id: string) {
  const idx = planForm.wordbookIds.indexOf(id)
  if (idx >= 0) {
    planForm.wordbookIds.splice(idx, 1)
  } else {
    planForm.wordbookIds.push(id)
  }
}

async function exportBackup() {
  const data: BackupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    wordStats: wordsStore.stats,
    sessions: sessionsStore.sessions,
    plans: plansStore.plans,
    streak: await Storage.get(KEYS.STREAK, { count: 0, lastDay: '' }),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `josh-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  await Storage.set(KEYS.LAST_BACKUP, new Date().toISOString())
}

function importBackup() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text) as BackupData
      if (data.version !== 2) {
        alert('备份文件版本不兼容')
        return
      }
      await Storage.set(KEYS.WORD_STATS, data.wordStats)
      await Storage.set(KEYS.SESSIONS, data.sessions)
      await Storage.set(KEYS.PLANS, data.plans)
      await Storage.set(KEYS.STREAK, data.streak)
      await wordsStore.load()
      await sessionsStore.load()
      await plansStore.load()
      alert('数据恢复成功！')
    } catch {
      alert('备份文件格式错误')
    }
  }
  input.click()
}

async function saveSettings() {
  await Storage.set(KEYS.SETTINGS, { ...settings })
}
</script>

<template>
  <div class="settings-page">
    <header class="page-header">
      <h2>设置</h2>
    </header>

    <!-- Plan management -->
    <section class="section">
      <div class="section-header">
        <h3>学习计划</h3>
        <button class="btn-add" @click="openNewPlan">+ 新建</button>
      </div>
      <div v-if="plansStore.plans.length === 0" class="empty-hint">暂无计划</div>
      <div
        v-for="plan in plansStore.plans"
        :key="plan.id"
        class="plan-row"
        @click="openEditPlan(plan)"
      >
        <span class="plan-dot" :style="{ background: plan.color }"></span>
        <span class="plan-label">{{ plan.name }}</span>
        <span class="plan-arrow">›</span>
      </div>
    </section>

    <!-- Plan Editor -->
    <div v-if="showPlanEditor" class="editor-overlay">
      <div class="editor-panel">
        <div class="editor-header">
          <h3>{{ editingPlanId ? '编辑计划' : '新建计划' }}</h3>
          <button class="btn-close" @click="showPlanEditor = false">✕</button>
        </div>

        <div class="form-group">
          <label>计划名称</label>
          <input v-model="planForm.name" placeholder="例如：每日单词" />
        </div>

        <div class="form-group">
          <label>选择颜色</label>
          <div class="color-picker">
            <button
              v-for="c in PLAN_COLORS"
              :key="c"
              :class="['color-dot', { selected: planForm.color === c }]"
              :style="{ background: c }"
              @click="planForm.color = c"
            ></button>
          </div>
        </div>

        <div class="form-group">
          <label>选择词库</label>
          <div class="wordbook-selector">
            <div v-for="group in groupedWordbooks" :key="group.category" class="wb-category">
              <div class="wb-category-header" @click="toggleCategory(group.category)">
                <input
                  type="checkbox"
                  :checked="isCategoryAllSelected(group)"
                  :indeterminate="isCategoryPartialSelected(group)"
                  @click.stop
                  @change="toggleCategorySelection(group)"
                />
                <span class="wb-category-name">{{ group.categoryName }}</span>
                <span :class="['wb-arrow', { expanded: expandedCategories.has(group.category) }]">›</span>
              </div>
              <div v-show="expandedCategories.has(group.category)" class="wb-category-books">
                <label
                  v-for="book in group.books"
                  :key="book.id"
                  class="wordbook-option"
                >
                  <input
                    type="checkbox"
                    :checked="planForm.wordbookIds.includes(book.id)"
                    @change="toggleWordbook(book.id)"
                  />
                  <span>{{ book.name }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>看英文选中文</label>
          <div class="stepper">
            <button @click="planForm.englishToChineseCount = Math.max(0, planForm.englishToChineseCount - 1)">-</button>
            <span>{{ planForm.englishToChineseCount }}</span>
            <button @click="planForm.englishToChineseCount = Math.min(50, planForm.englishToChineseCount + 1)">+</button>
          </div>
        </div>

        <div class="form-group">
          <label>看中文写英文</label>
          <div class="stepper">
            <button @click="planForm.chineseToEnglishCount = Math.max(0, planForm.chineseToEnglishCount - 1)">-</button>
            <span>{{ planForm.chineseToEnglishCount }}</span>
            <button @click="planForm.chineseToEnglishCount = Math.min(50, planForm.chineseToEnglishCount + 1)">+</button>
          </div>
        </div>

        <div class="form-group">
          <label>例句填空</label>
          <div class="stepper">
            <button @click="planForm.fillBlankCount = Math.max(0, planForm.fillBlankCount - 1)">-</button>
            <span>{{ planForm.fillBlankCount }}</span>
            <button @click="planForm.fillBlankCount = Math.min(50, planForm.fillBlankCount + 1)">+</button>
          </div>
        </div>

        <div class="editor-actions">
          <button class="btn-save" @click="savePlan">保存</button>
          <button v-if="editingPlanId" class="btn-delete" @click="deletePlan">删除计划</button>
        </div>
      </div>
    </div>

    <!-- Backup -->
    <section class="section">
      <h3>数据管理</h3>
      <div class="action-row">
        <button class="btn-action" @click="exportBackup">导出备份</button>
        <button class="btn-action" @click="importBackup">导入备份</button>
      </div>
    </section>

    <!-- Preferences -->
    <section class="section">
      <h3>偏好设置</h3>
      <div class="toggle-row">
        <span>语音朗读 (TTS)</span>
        <input type="checkbox" v-model="settings.ttsEnabled" @change="saveSettings" />
      </div>
      <div class="toggle-row">
        <span>音效</span>
        <input type="checkbox" v-model="settings.soundEnabled" @change="saveSettings" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
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

.section {
  margin-bottom: 28px;
}

.section h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.btn-add {
  font-size: 14px;
  font-weight: 700;
  color: var(--p4);
  background: none;
  padding: 4px 8px;
}

.empty-hint {
  font-size: 14px;
  color: var(--ink-light);
  padding: 12px 0;
  font-weight: 500;
}

.plan-row {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1.5px dashed var(--line);
  cursor: pointer;
}

.plan-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,.15);
}

.plan-label {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
}

.plan-arrow {
  color: var(--ink-light);
  font-size: 18px;
}

/* Editor overlay */
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(61,43,31,.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.editor-panel {
  background: var(--paper-warm);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  padding: 20px;
  overflow-y: auto;
  box-shadow: 0 -8px 32px rgba(61,43,31,.15);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.editor-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.btn-close {
  font-size: 20px;
  background: none;
  color: var(--ink-light);
  padding: 4px 8px;
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

.form-group input[type="text"],
.form-group input:not([type]) {
  width: 100%;
  padding: 12px 14px;
  border: 2.5px solid var(--line);
  border-radius: var(--r-sm);
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  background: var(--paper);
  transition: border-color .15s, box-shadow .15s;
}

.form-group input:focus {
  border-color: var(--p1);
  box-shadow: 0 0 0 3px rgba(255,107,107,.15);
}

.color-picker {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid transparent;
  transition: border-color 0.15s, transform .15s;
  box-shadow: 0 2px 6px rgba(0,0,0,.15);
}

.color-dot.selected {
  border-color: var(--ink);
  transform: scale(1.15);
}

.wordbook-selector {
  max-height: 220px;
  overflow-y: auto;
  border: 2.5px solid var(--line);
  border-radius: var(--r-sm);
  padding: 6px;
  background: var(--paper);
}

.wb-category {
  margin-bottom: 2px;
}

.wb-category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  cursor: pointer;
  border-radius: 6px;
  transition: background .12s;
}

.wb-category-header:hover {
  background: rgba(61,43,31,.04);
}

.wb-category-header input[type="checkbox"] {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin: 0;
}

.wb-category-name {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.wb-arrow {
  font-size: 16px;
  color: var(--ink-light);
  transition: transform .2s;
}

.wb-arrow.expanded {
  transform: rotate(90deg);
}

.wb-category-books {
  padding-left: 12px;
}

.wordbook-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  border-radius: 4px;
  transition: background .12s;
}

.wordbook-option:hover {
  background: rgba(61,43,31,.03);
}

.wordbook-option input[type="checkbox"] {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin: 0 4px 0 0;
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

.editor-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.btn-save {
  padding: 14px;
  background: linear-gradient(180deg, #FF8E5E, #FF6B4B);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 5px 0 #C04428;
  transition: transform .12s, box-shadow .12s;
}

.btn-save:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 #C04428;
}

.btn-delete {
  padding: 14px;
  background: #FFEBEB;
  color: var(--bad);
  border: 2px solid var(--bad);
  border-radius: var(--r-md);
  font-size: 15px;
  font-weight: 700;
}

.action-row {
  display: flex;
  gap: 10px;
}

.btn-action {
  flex: 1;
  padding: 14px;
  background: var(--paper);
  border: 2.5px solid var(--line);
  border-radius: var(--r-md);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  box-shadow: 0 3px 0 rgba(61,43,31,.06);
  transition: transform .12s, box-shadow .12s;
}

.btn-action:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(61,43,31,.06);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1.5px dashed var(--line);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
</style>
