import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue'),
    },
    {
      path: '/wordbook',
      name: 'wordbook',
      component: () => import('@/views/WordbookPage.vue'),
    },
    {
      path: '/wordbook/:id',
      name: 'wordbook-detail',
      component: () => import('@/views/WordbookDetailPage.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
    },
    {
      path: '/learn/:planId',
      name: 'learn',
      component: () => import('@/views/LearnPage.vue'),
    },
    {
      path: '/exam',
      name: 'exam',
      component: () => import('@/views/ExamPage.vue'),
    },
  ],
})

export default router
