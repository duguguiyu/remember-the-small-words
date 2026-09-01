import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginPage.vue'),
      meta: { public: true },
    },
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
    {
      path: '/admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      meta: { admin: true },
      children: [
        { path: '', redirect: { name: 'admin-users' } },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/AdminUsersPage.vue'),
          meta: { admin: true },
        },
        {
          path: 'users/:id',
          name: 'admin-user-detail',
          component: () => import('@/views/admin/AdminUserDetailPage.vue'),
          meta: { admin: true },
        },
        {
          path: 'wordbooks',
          name: 'admin-wordbooks',
          component: () => import('@/views/admin/AdminWordbooksPage.vue'),
          meta: { admin: true },
        },
        {
          path: 'wordbooks/:id',
          name: 'admin-wordbook-detail',
          component: () => import('@/views/admin/AdminWordbookDetailPage.vue'),
          meta: { admin: true },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) await auth.fetchMe()

  const isPublic = to.matched.some((r) => r.meta.public)
  const isAdminRoute = to.matched.some((r) => r.meta.admin)

  if (isPublic) {
    if (auth.user && to.name === 'login') {
      return auth.user.role === 'admin' ? { name: 'admin-users' } : { name: 'home' }
    }
    return true
  }

  if (!auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isAdminRoute && auth.user.role !== 'admin') {
    return { name: 'home' }
  }

  if (auth.user.role === 'admin' && !isAdminRoute) {
    return { name: 'admin-users' }
  }

  return true
})

export default router
