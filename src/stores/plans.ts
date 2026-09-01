import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LearningPlan } from '@/lib/types'
import { PLAN_COLORS } from '@/lib/types'
import { api } from '@/lib/api'

export const usePlansStore = defineStore('plans', () => {
  const plans = ref<LearningPlan[]>([])

  async function load() {
    plans.value = await api<LearningPlan[]>('/api/plans')
  }

  async function addPlan(plan: Omit<LearningPlan, 'id' | 'createdAt'>) {
    const created = await api<LearningPlan>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
    plans.value.push(created)
    return created
  }

  async function updatePlan(id: string, updates: Partial<LearningPlan>) {
    const updated = await api<LearningPlan>(`/api/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    const idx = plans.value.findIndex((p) => p.id === id)
    if (idx >= 0) plans.value[idx] = updated
  }

  async function removePlan(id: string) {
    await api(`/api/plans/${id}`, { method: 'DELETE' })
    plans.value = plans.value.filter((p) => p.id !== id)
  }

  function getRandomColor(): string {
    const usedColors = plans.value.map((p) => p.color)
    const available = PLAN_COLORS.filter((c) => !usedColors.includes(c))
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)]
    }
    return PLAN_COLORS[Math.floor(Math.random() * PLAN_COLORS.length)]
  }

  return { plans, load, save: async () => {}, addPlan, updatePlan, removePlan, getRandomColor }
})
