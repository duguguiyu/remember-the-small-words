<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'

interface AdminUserRow {
  id: string
  username: string
  role: string
  disabled: boolean
  createdAt: string
  streakCount: number
  lastStudyDate: string | null
  sessionCount: number
}

const router = useRouter()
const users = ref<AdminUserRow[]>([])
const error = ref('')
const form = reactive({ username: '', password: '', role: 'learner' })
const creating = ref(false)

async function load() {
  users.value = await api<AdminUserRow[]>('/api/admin/users')
}

onMounted(load)

async function createUser() {
  error.value = ''
  creating.value = true
  try {
    await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    form.username = ''
    form.password = ''
    form.role = 'learner'
    await load()
  } catch (e: any) {
    error.value = e.message
  } finally {
    creating.value = false
  }
}

async function toggleDisabled(user: AdminUserRow) {
  await api(`/api/admin/users/${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ disabled: !user.disabled }),
  })
  await load()
}

async function resetPassword(user: AdminUserRow) {
  const password = window.prompt(`为 ${user.username} 设置新密码（至少 6 位）`)
  if (!password) return
  try {
    await api(`/api/admin/users/${user.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    window.alert('密码已更新')
  } catch (e: any) {
    window.alert(e.message)
  }
}
</script>

<template>
  <div>
    <header class="head">
      <h1>学员名册</h1>
      <p>只由管理员开账号。点进名字可以看打卡、计划和记忆数据。</p>
    </header>

    <form class="create card" @submit.prevent="createUser">
      <h2>登记一个新学员</h2>
      <div class="row">
        <input v-model="form.username" placeholder="用户名" />
        <input v-model="form.password" type="password" placeholder="初始密码" />
        <select v-model="form.role">
          <option value="learner">学员</option>
          <option value="admin">管理员</option>
        </select>
        <button class="btn btn-primary" :disabled="creating">创建</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <div class="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>用户名</th>
            <th>角色</th>
            <th>连胜</th>
            <th>最近学习</th>
            <th>记录数</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <button class="link" @click="router.push({ name: 'admin-user-detail', params: { id: u.id } })">
                {{ u.username }}
              </button>
            </td>
            <td>{{ u.role === 'admin' ? '管理员' : '学员' }}</td>
            <td>{{ u.streakCount }} 天</td>
            <td>{{ u.lastStudyDate || '—' }}</td>
            <td>{{ u.sessionCount }}</td>
            <td>
              <span :class="['pill', u.disabled ? 'off' : 'on']">{{ u.disabled ? '已停用' : '正常' }}</span>
            </td>
            <td class="actions">
              <button @click="resetPassword(u)">重置密码</button>
              <button @click="toggleDisabled(u)">{{ u.disabled ? '启用' : '停用' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.head h1 { font-size: 28px; margin-bottom: 6px; }
.head p { color: var(--ink-soft); margin-bottom: 22px; }
.create { margin-bottom: 20px; }
.create h2 { font-size: 16px; margin-bottom: 12px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.row input, .row select {
  padding: 10px 12px;
  border: 2px solid var(--line);
  border-radius: 12px;
  font-weight: 600;
  min-width: 140px;
}
.error { color: var(--bad); margin-top: 8px; font-weight: 700; }
.table-wrap { overflow-x: auto; padding: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 12px 16px; border-bottom: 1px dashed var(--line); font-size: 14px; }
th { color: var(--ink-soft); font-size: 12px; letter-spacing: .04em; }
.link { background: none; color: var(--p1-deep); font-weight: 700; }
.pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.pill.on { background: #E8FAEC; color: var(--good-deep); }
.pill.off { background: #FFEBEB; color: var(--bad); }
.actions { display: flex; gap: 8px; }
.actions button {
  background: var(--paper-warm);
  border: 1.5px solid var(--line);
  border-radius: 10px;
  padding: 6px 10px;
  font-weight: 700;
  font-size: 12px;
}
</style>
