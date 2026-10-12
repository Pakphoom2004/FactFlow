import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/views/HomePage.vue'
import NewsDetailPage from '@/views/NewsDetailPage.vue'
import VotePage from '@/views/VotePage.vue'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import LoginPage from '@/views/LoginPage.vue'
import SignUpPage from '@/views/SignUpPage.vue'
import AddNews from '@/views/AddNews.vue'
import UserProfile from '@/views/UserProfile.vue'
import AdminNewsManager from '@/views/AdminNewsManager.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminRequestStore } from '@/stores/adminRequest'

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 120,
  minimum: 0.08,
})

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/news/:id',
    name: 'news-detail',
    component: NewsDetailPage,
    props: true,
    children: [
      {
        path: 'comments',
        name: 'news-comments',
        component: () => import('@/components/CommentsList.vue'),
      },
      {
        path: 'vote',
        name: 'news-vote',
        component: VotePage,
      },
    ],
  },
  {
    path: '/add-news',
    name: 'add-news',
    component: AddNews,
    meta: { requiresAuth: true, adminOnly: true },
  },
  {
    path: '/admin/news',
    name: 'admin-news',
    component: AdminNewsManager,
    meta: { requiresAuth: true, adminOnly: true, fullBleed: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: UserProfile,
    meta: { requiresAuth: true, fullBleed: true },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { guestOnly: true, hideChrome: true },
  },
  {
    path: '/signup',
    name: 'signup',
    component: SignUpPage,
    meta: { guestOnly: true, hideChrome: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
router.beforeEach((to, from, next) => {
  NProgress.start()

  const authStore = useAuthStore()
  authStore.init()

  const token = authStore.token ?? localStorage.getItem('access_token')
  const isAuthenticated = !!token
  const currentUser = authStore.user
  const adminStore = useAdminRequestStore()

  let isApprovedRequest = false
  try {
    const userId = (currentUser as any)?.id
    if (userId) {
      const latest = adminStore.latestRequestByUser(userId)
      isApprovedRequest = latest?.status?.toLowerCase() === 'approved'
    }
  } catch {
    isApprovedRequest = false
  }

  const derivedAdmin =
    authStore.isAdmin ||
    isApprovedRequest ||
    (typeof (currentUser as any)?.role === 'string' &&
      ((currentUser as any).role as string).toUpperCase() === 'ROLE_ADMIN') ||
    (Array.isArray((currentUser as any)?.roles) &&
      (currentUser as any).roles.some((role: string) => role?.toUpperCase?.() === 'ROLE_ADMIN')) ||
    localStorage.getItem('user_role') === 'ROLE_ADMIN'

  if (isAuthenticated && to.meta.guestOnly) {
    next({ name: 'home' })
    NProgress.done()
    return
  }

  if (to.meta.adminOnly && !derivedAdmin) {
    next({ name: 'home' })
    NProgress.done()
    return
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
