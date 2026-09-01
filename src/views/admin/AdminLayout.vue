<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

async function logout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="admin-shell">
    <aside class="rail">
      <div class="brand">
        <span class="mark">✎</span>
        <div>
          <strong>单词本后台</strong>
          <small>{{ auth.user?.username }}</small>
        </div>
      </div>
      <nav>
        <router-link :class="{ on: route.path.startsWith('/admin/users') }" :to="{ name: 'admin-users' }">
          学员
        </router-link>
        <router-link :class="{ on: route.path.startsWith('/admin/wordbooks') }" :to="{ name: 'admin-wordbooks' }">
          词库
        </router-link>
      </nav>
      <button class="logout" @click="logout">退出</button>
    </aside>
    <main class="stage">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px 1fr;
}

.rail {
  background: #3D2B1F;
  color: #FFF6EA;
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.brand {
  display: flex;
  gap: 10px;
  align-items: center;
}

.mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #FF6B4B;
  display: grid;
  place-items: center;
  font-size: 18px;
  box-shadow: 0 3px 0 #C04428;
}

.brand strong {
  display: block;
  font-size: 15px;
}

.brand small {
  color: #E8C9B0;
  font-size: 12px;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

nav a {
  color: #E8C9B0;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 700;
}

nav a.on,
nav a.router-link-active {
  background: #FF6B4B;
  color: #fff;
}

.logout {
  margin-top: auto;
  background: transparent;
  color: #E8C9B0;
  font-weight: 700;
  padding: 10px 12px;
  text-align: left;
}

.stage {
  padding: 28px 32px 48px;
  min-width: 0;
}

@media (max-width: 800px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }
  .rail {
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
  }
  nav {
    flex-direction: row;
    flex: 1;
  }
  .logout {
    margin-top: 0;
  }
}
</style>
