<script setup lang="ts">
import { useRoute } from 'vue-router'
import TabBar from './components/TabBar.vue'

const route = useRoute()

const hideTabBarRoutes = ['learn', 'exam']
</script>

<template>
  <div class="app-container">
    <router-view />
    <TabBar v-if="!hideTabBarRoutes.includes(route.name as string)" />
  </div>
</template>

<style>
.app-container {
  padding-bottom: 70px;
}
</style>
