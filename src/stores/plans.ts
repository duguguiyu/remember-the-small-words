import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { LearningPlan } from '@/lib/types'
import { Storage, KEYS } from '@/lib/storage'
import { PLAN_COLORS } from '@/lib/types'

export const usePlansStore = defineStore('plans', () => {
  const plans = ref<LearningPlan[]>([])

  async function load() {
    plans.value = await Storage.get<LearningPlan[]>(KEYS.PLANS, [])
  }

  async function save() {
    await Storage.set(KEYS.PLANS, JSON.parse(JSON.stringify(toRaw(plans.value))))
  }

  async function addPlan(plan: Omit<LearningPlan, 'id' | 'createdAt'>) {
    const newPlan: LearningPlan = {
      ...plan,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
    }
    plans.value.push(newPlan)
    await save()
    return newPlan
  }

  async function updatePlan(id: string, updates: Partial<LearningPlan>) {
    const idx = plans.value.findIndex((p) => p.id === id)
    if (idx >= 0) {
      plans.value[idx] = { ...plans.value[idx], ...updates }
      await save()
    }
  }

  async function removePlan(id: string) {
    plans.value = plans.value.filter((p) => p.id !== id)
    await save()
  }

  function getRandomColor(): string {
    const usedColors = plans.value.map((p) => p.color)
    const available = PLAN_COLORS.filter((c) => !usedColors.includes(c))
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)]
    }
    return PLAN_COLORS[Math.floor(Math.random() * PLAN_COLORS.length)]
  }

  return { plans, load, save, addPlan, updatePlan, removePlan, getRandomColor }
})
