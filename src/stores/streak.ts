import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'

export const useStreakStore = defineStore('streak', () => {
  const count = ref(0)
  const lastDay = ref('')

  async function load() {
    const row = await api<{ count: number; lastDay: string }>('/api/streak')
    count.value = row.count
    lastDay.value = row.lastDay
  }

  async function save(next: { count: number; lastDay: string }) {
    count.value = next.count
    lastDay.value = next.lastDay
    await api('/api/streak', {
      method: 'PUT',
      body: JSON.stringify(next),
    })
  }

  return { count, lastDay, load, save }
})
