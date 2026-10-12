<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import bg from '@/assets/FACTFLOW-4.png'
import logo from '@/assets/logosssss.png'
import { object, string, ValidationError, type InferType } from 'yup'

const loginSchema = object({
  username: string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .required('Username is required.'),
  password: string()
    .min(3, 'Password must be at least 3 characters.')
    .required('Password is required.'),
})

type LoginForm = InferType<typeof loginSchema>

const username = ref<LoginForm['username']>('')
const password = ref<LoginForm['password']>('')
const showPassword = ref(false)
const isLoading = ref(false)
const validationErrors = ref<Partial<Record<keyof LoginForm, string>>>({})

const messageStore = useMessageStore()
const message = computed(() => messageStore.message)

const canSubmit = computed(() => {
  try {
    loginSchema.validateSync(
      { username: username.value, password: password.value },
      { abortEarly: true },
    )
    return !isLoading.value
  } catch {
    return false
  }
})

const authStore = useAuthStore()
const router = useRouter()

function clearFieldError(field: keyof LoginForm) {
  if (validationErrors.value[field]) {
    const next = { ...validationErrors.value }
    delete next[field]
    validationErrors.value = next
  }
}

async function validateField(field: keyof LoginForm) {
  try {
    await loginSchema.validateAt(field, {
      username: username.value,
      password: password.value,
    })
    clearFieldError(field)
  } catch (error) {
    if (error instanceof ValidationError) {
      validationErrors.value = {
        ...validationErrors.value,
        [field]: error.message,
      }
    }
  }
}

watch(username, () => {
  void validateField('username')
})

watch(password, () => {
  void validateField('password')
})

async function onSubmit() {
  if (!canSubmit.value) return
  isLoading.value = true
  messageStore.resetMessage()
  try {
    const validated = await loginSchema.validate(
      { username: username.value, password: password.value },
      { abortEarly: false },
    )
    validationErrors.value = {}
    username.value = validated.username
    await authStore.login(validated.username, validated.password)
    messageStore.updateMessage('✅ Logged in')
    setTimeout(() => messageStore.resetMessage(), 1500)
    await router.push({ name: 'home' })
  } catch (error: any) {
    if (error instanceof ValidationError) {
      const fieldErrors: Partial<Record<keyof LoginForm, string>> = {}
      if (error.inner?.length) {
        error.inner.forEach((err) => {
          if (err.path) {
            fieldErrors[err.path as keyof LoginForm] = err.message
          }
        })
      } else if (error.path) {
        fieldErrors[error.path as keyof LoginForm] = error.message
      }
      validationErrors.value = fieldErrors
      isLoading.value = false
      return
    }
    const text =
      error?.message ||
      error?.response?.data?.message ||
      'Login failed'
    messageStore.updateMessage(`❌ ${text}`)
    setTimeout(() => messageStore.resetMessage(), 4000)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-[100svh] overflow-hidden text-neutral-800">
    <div
      aria-hidden
      class="fixed inset-0 -z-50 bg-center bg-cover brightness-[0.9]"
      :style="{ backgroundImage: `url(${bg})` }"
    ></div>

    <div aria-hidden class="pointer-events-none fixed inset-0 -z-40">
      <div class="absolute -left-24 top-16 h-[420px] w-[420px] rounded-full bg-[#892020]/12 blur-3xl animate-pulse"></div>
      <div class="absolute -right-28 bottom-10 h-[420px] w-[420px] rounded-full bg-[#892020]/12 blur-3xl animate-pulse"></div>
    </div>

    <div
      aria-hidden
      class="fixed inset-0 -z-30"
      style="background:
        linear-gradient(180deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,.5) 60%, rgba(137,32,32,.08) 100%),
        radial-gradient(900px 600px at 70% 10%, rgba(137,32,32,.18), transparent 70%),
        radial-gradient(700px 420px at 15% 90%, rgba(137,32,32,.14), transparent 60%)"
    ></div>

    <div class="grid place-items-center min-h-[100svh] px-4 pt-6 pb-10 sm:translate-y-[-2vh] translate-y-[-1vh]">
      <div class="relative w-full max-w-[480px]">
        <div
          aria-hidden
          class="absolute -inset-x-20 top-8 h-[64%] -z-10 bg-[radial-gradient(60%_48%_at_50%_0%,rgba(137,32,32,.25),transparent_70%)] blur-[90px] opacity-80"
        ></div>

        <div class="rounded-[22px] ring-1 ring-white/80 bg-white/90 backdrop-blur-xl shadow-[0_30px_70px_-30px_rgba(0,0,0,.4)] transition-all duration-500">
          <form @submit.prevent="onSubmit" class="p-8 sm:p-9 space-y-8">
            <div class="flex flex-col items-center text-center space-y-4">
              <img :src="logo" alt="FactFlow" class="h-[94px] w-auto" />
              <div class="h-px w-full bg-gradient-to-r from-transparent via-[#892020]/25 to-transparent"></div>
              <div class="relative grid place-items-center h-[110px] w-[110px] rounded-full bg-white/95 ring-2 ring-[#892020]/50 shadow-[0_8px_22px_-10px_rgba(0,0,0,.25)]">
                <span class="text-[58px] leading-none animate-wave" aria-hidden="true">👋🏼</span>
                <span aria-hidden class="pointer-events-none absolute inset-0 rounded-full animate-halo"></span>
              </div>
              <div>
                <h1 class="text-[16px] font-semibold text-[#5a2222]">
                  Sign in to <span class="text-[#892020]">FactFlow</span>
                </h1>
                <p class="mt-1 text-[12.5px] text-neutral-600">
                  Smarter fact-checking • Clean reading • Insightful analytics
                </p>
              </div>
            </div>

            <div class="space-y-5">
              <div class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                </svg>
                <input
                  v-model="username"
                  type="text"
                  autocomplete="username"
                  placeholder="Username"
                  class="w-full pl-12 pr-4 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]"
                />
              </div>
              <p v-if="validationErrors.username" class="px-3 text-xs text-[#892020]">
                {{ validationErrors.username }}
              </p>

              <div class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  :type="showPassword ? 'text' : 'password'"
                  v-model="password"
                  autocomplete="current-password"
                  placeholder="Password"
                  class="w-full pl-12 pr-20 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-xs rounded-full px-3 py-1.5 bg-white/80 ring-1 ring-[#892020]/20 hover:ring-[#892020]/40 text-[#892020] font-medium transition active:scale-95"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Hide' : 'Show' }}
                </button>
              </div>
              <p v-if="validationErrors.password" class="px-3 text-xs text-[#892020]">
                {{ validationErrors.password }}
              </p>

              <div class="flex justify-end px-1 text-[12.5px]">
                <RouterLink to="/forgot" class="text-[#892020] hover:underline">Forgot password?</RouterLink>
              </div>
            </div>

            <button
              type="submit"
              :disabled="!canSubmit"
              class="mt-2 w-full overflow-hidden rounded-full px-6 py-3.5 text-white bg-gradient-to-b from-[#8f2626] to-[#6f1717] shadow-[0_14px_32px_-16px_rgba(137,32,32,.65)] hover:shadow-[0_18px_40px_-16px_rgba(137,32,32,.75)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <span v-if="!isLoading">Log in</span>
              <svg
                v-else
                class="mx-auto h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </button>

            <div class="mt-1 text-center text-[13px] text-neutral-700">
              No account?
              <RouterLink to="/signup" class="text-[#892020] font-semibold hover:underline">
                Create one
              </RouterLink>
            </div>

            <transition name="fade">
              <div
                v-if="message"
                class="text-center text-sm"
                :class="message.startsWith('✅') ? 'text-emerald-700' : 'text-[#892020]'"
              >
                {{ message.replace(/^✅\s*|^❌\s*/u, '') }}
              </div>
            </transition>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes wave {
  0% { transform: rotate(0deg); }
  10% { transform: rotate(12deg); }
  20% { transform: rotate(-7deg); }
  30% { transform: rotate(12deg); }
  40% { transform: rotate(-4deg); }
  50% { transform: rotate(8deg); }
  60%,100% { transform: rotate(0deg); }
}
.animate-wave { animation: wave 2.1s ease-in-out infinite; }

@keyframes halo {
  0% { box-shadow: 0 0 0 0 rgba(137,32,32,.20); opacity:.9; }
  70% { box-shadow: 0 0 0 14px rgba(137,32,32,0); opacity:0; }
  100% { box-shadow: 0 0 0 0 rgba(137,32,32,0); opacity:0; }
}
.animate-halo { animation: halo 2.8s ease-out infinite; border-radius:9999px; }

@media (prefers-reduced-motion: reduce) {
  .animate-wave,
  .animate-halo { animation: none !important; }
}
</style>
