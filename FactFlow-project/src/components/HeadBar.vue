<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'


const router = useRouter()
const authStore = useAuthStore()

const isAuthenticated = computed(() => !!authStore.user)


const isAdmin = computed(() => {
  const user = authStore.user
  if (!user) return false
  const primaryRole = typeof user.role === 'string' ? user.role.toUpperCase() : ''
  if (primaryRole === 'ROLE_ADMIN') return true
  if (Array.isArray(user.roles)) {
    return user.roles.some((role: string) => role?.toUpperCase?.() === 'ROLE_ADMIN')
  }
  return false
})

const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > 4
}
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function handleLogin() {
  router.push({ name: 'login' })
}

function handleProfile() {
  router.push({ name: 'profile' })
}

function handleManageNews() {
  router.push({ name: 'admin-news' })
}

function handleLogout() {
  authStore.logout()
  router.push({ name: 'home' })
}
</script>

<template>
  <header :data-scrolled="scrolled" class="relative sticky top-0 z-40 bg-white/70 backdrop-blur transition-shadow"
    :class="scrolled ? 'shadow-[0_10px_28px_-16px_rgba(137,32,32,0.34)]' : ''">

    <div aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_60%_at_50%_-20%,rgba(137,32,32,0.08),transparent_60%),radial-gradient(80%_50%_at_50%_120%,rgba(137,32,32,0.06),transparent_60%)]">
    </div>

    <div
      class="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-[1fr_auto_1fr] items-center transition-[height,padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] h-20 [@media(min-width:640px)]:h-20"
      :class="scrolled ? 'h-16' : 'h-20'">
      <div></div>

      <!-- Logo -->
      <RouterLink to="/" class="relative flex items-center justify-center">
        <div aria-hidden="true" class="absolute -z-10 w-56 h-12 rounded-full blur-2xl bg-[#892020]/10"></div>
        <img src="../assets/logosssss.png" alt="FactFlow"
          class="transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] w-auto object-contain"
          :class="scrolled ? 'h-12' : 'h-16'" />
      </RouterLink>

      <!-- Right side buttons -->
      <div class="flex justify-end items-center space-x-2">

        <!-- not login yet -->
        <template v-if="!isAuthenticated">
          <button @click="handleLogin"
            class="px-4 py-2 rounded-full text-sm font-semibold text-white bg-[#892020] hover:bg-[#a02a2a] transition">
            Login
          </button>
        </template>

        <!-- login -->
        <template v-else>
          <!-- show only admin -->
          <button v-if="isAdmin" @click="handleManageNews"
            class="px-4 py-2 rounded-full text-sm font-semibold text-white bg-[#892020] hover:bg-[#a02a2a] transition">
            Manage News
          </button>

          <button @click="handleProfile"
            class="px-4 py-2 rounded-full text-sm font-semibold text-[#892020] border border-[#892020]/30 hover:border-[#892020] hover:bg-[#892020]/5 transition">
            Profile
          </button>

          <button @click="handleLogout"
            class="px-4 py-2 rounded-full text-sm font-semibold text-white bg-[#892020] hover:bg-[#a02a2a] transition">
            Logout
          </button>
        </template>
      </div>
    </div>

    <div class="relative h-[3px] overflow-hidden">
      <div
        class="absolute inset-0 animate-flow bg-[linear-gradient(90deg,rgba(137,32,32,0),rgba(137,32,32,.8),rgba(137,32,32,0))] opacity-70">
      </div>
    </div>
  </header>
</template>
