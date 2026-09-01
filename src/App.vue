<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, watch } from 'vue'
import TabBar from './components/TabBar.vue'

const route = useRoute()

const isAdmin = computed(() => route.path.startsWith('/admin'))
const isLogin = computed(() => route.name === 'login')
const hideTabBar = computed(() => {
  const name = String(route.name || '')
  return ['learn', 'exam', 'login'].includes(name) || isAdmin.value
})

watch(
  [isAdmin, isLogin],
  ([admin, login]) => {
    document.documentElement.classList.toggle('wide-layout', admin)
    document.documentElement.classList.toggle('login-layout', login)
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-container" :class="{ 'app-wide': isAdmin || isLogin }">
    <router-view />
    <TabBar v-if="!hideTabBar" />
  </div>
</template>

<style>
.app-container {
  padding-bottom: 70px;
}

.app-container.app-wide {
  padding-bottom: 0;
}
</style>
