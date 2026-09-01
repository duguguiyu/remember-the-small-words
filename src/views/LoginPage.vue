<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (auth.user?.role === 'admin') {
      router.replace(redirect.startsWith('/admin') ? redirect : { name: 'admin-users' })
    } else {
      router.replace(redirect && !redirect.startsWith('/admin') ? redirect : { name: 'home' })
    }
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-sky">
      <span class="star s1">✦</span>
      <span class="star s2">✧</span>
      <span class="star s3">✦</span>
    </div>
    <div class="notebook">
      <div class="spine"></div>
      <div class="sheet">
        <p class="kicker">Josh 的单词本</p>
        <h1>开始今天的小单词</h1>
        <p class="lede">用老师发的账号登录。进度会记在云端，换设备也不丢。</p>

        <form class="login-form" @submit.prevent="submit">
          <label>
            用户名
            <input v-model="username" autocomplete="username" placeholder="你的名字" />
          </label>
          <label>
            密码
            <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" />
          </label>
          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            {{ loading ? '正在翻开本子…' : '打开单词本' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  position: relative;
}

.login-sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.star {
  position: absolute;
  color: #FFB546;
  opacity: .7;
  animation: pulse 2.8s ease-in-out infinite;
}

.s1 { top: 14%; left: 18%; font-size: 22px; }
.s2 { top: 22%; right: 16%; font-size: 16px; animation-delay: .6s; color: #FF6B6B; }
.s3 { bottom: 18%; left: 28%; font-size: 18px; animation-delay: 1.1s; color: #4ECDC4; }

.notebook {
  display: flex;
  width: min(440px, 100%);
  background: var(--paper);
  border-radius: 28px;
  border: 3px solid var(--ink);
  box-shadow: 10px 12px 0 rgba(61, 43, 31, .18);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.spine {
  width: 18px;
  background:
    repeating-linear-gradient(
      180deg,
      #C04428 0 10px,
      #FF6B4B 10px 22px
    );
}

.sheet {
  flex: 1;
  padding: 32px 28px 28px;
  background:
    repeating-linear-gradient(
      180deg,
      transparent 0 31px,
      rgba(255, 181, 70, .18) 31px 32px
    );
}

.kicker {
  font-size: 12px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--p1-deep);
  font-weight: 700;
  margin-bottom: 8px;
}

h1 {
  font-size: 28px;
  line-height: 1.2;
  margin-bottom: 10px;
}

.lede {
  color: var(--ink-soft);
  font-size: 14px;
  margin-bottom: 22px;
  line-height: 1.5;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
}

input {
  padding: 12px 14px;
  border: 2.5px solid var(--line);
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  background: #fff;
  color: var(--ink);
}

input:focus {
  border-color: var(--p1);
  box-shadow: 0 0 0 3px rgba(255, 107, 107, .15);
}

.error {
  color: var(--bad);
  font-size: 13px;
  font-weight: 700;
}
</style>
