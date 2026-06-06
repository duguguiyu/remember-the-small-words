<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'home', label: '首页', icon: '🏠' },
  { name: 'wordbook', label: '词库', icon: '📚' },
  { name: 'history', label: '记录', icon: '📊' },
  { name: 'settings', label: '设置', icon: '⚙️' },
]

function navigate(name: string) {
  router.push({ name })
}
</script>

<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      :class="['tab-item', { active: route.name === tab.name }]"
      @click="navigate(tab.name)"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  height: 64px;
  background: var(--paper);
  border-top: 3px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 14px;
  background: none;
  color: var(--ink-light);
  font-size: 11px;
  font-weight: 600;
  transition: color 0.2s, transform 0.15s;
  border-radius: var(--r-sm);
}

.tab-item:active {
  transform: scale(0.92);
}

.tab-item.active {
  color: var(--p1);
}

.tab-icon {
  font-size: 22px;
}

.tab-label {
  font-size: 11px;
  font-weight: 600;
}
</style>
