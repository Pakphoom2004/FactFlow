import './assets/style.css'


import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@/services/AxiosInceptorSetup'
import 'nprogress/nprogress.css'
import '@mdi/font/css/materialdesignicons.css'
import { useAuthStore } from '@/stores/auth'
import { useAdminRequestStore } from '@/stores/adminRequest'
import { useProfileStore } from '@/stores/profile'
const app = createApp(App)


app.use(createPinia())
app.use(router)
const authStore = useAuthStore()
authStore.init()
const adminRequestStore = useAdminRequestStore()
if (authStore.user && authStore.isAdmin) {
  adminRequestStore.fetchRequests().catch((error: unknown) => {
    const status = (error as any)?.response?.status
    if (status && Number(status) === 403) {
      return
    }
    console.warn('Unable to prefetch admin requests:', error)
  })
}
const profileStore = useProfileStore()
profileStore.init()

app.mount('#app')
