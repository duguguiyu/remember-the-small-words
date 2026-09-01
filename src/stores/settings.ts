import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import { setSoundEnabled } from '@/lib/sound'

export const useSettingsStore = defineStore('settings', () => {
  const ttsEnabled = ref(true)
  const soundEnabled = ref(true)

  async function load() {
    const saved = await api<{ ttsEnabled: boolean; soundEnabled: boolean }>('/api/settings')
    ttsEnabled.value = saved.ttsEnabled
    soundEnabled.value = saved.soundEnabled
    setSoundEnabled(saved.soundEnabled)
  }

  async function save() {
    setSoundEnabled(soundEnabled.value)
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        ttsEnabled: ttsEnabled.value,
        soundEnabled: soundEnabled.value,
      }),
    })
  }

  return { ttsEnabled, soundEnabled, load, save }
})
