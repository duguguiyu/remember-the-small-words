import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'learner'
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loaded = ref(false)

  async function fetchMe() {
    try {
      user.value = await api<AuthUser>('/api/auth/me', {
        skipAuthRedirect: true,
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(4000) : undefined,
      })
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(username: string, password: string) {
    user.value = await api<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    loaded.value = true
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
    }
  }

  return { user, loaded, fetchMe, login, logout }
})
