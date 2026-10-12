<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/message'
import bg from '@/assets/FACTFLOW-4.png'
import logo from '@/assets/logosssss.png'
import { useProfileStore } from '@/stores/profile'
import { object, string, ValidationError, type InferType } from 'yup'

const signUpSchema = object({
  username: string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .required('Username is required.'),
  firstName: string()
    .trim()
    .required('First name is required.'),
  lastName: string()
    .trim()
    .required('Last name is required.'),
  email: string()
    .trim()
    .required('Email is required.')
    .matches(/@/, 'Email must include an @ symbol.'),
  password: string()
    .min(3, 'Password must be at least 3 characters.')
    .required('Password is required.'),
})

type SignUpForm = InferType<typeof signUpSchema>

const username = ref<SignUpForm['username']>('')
const firstName = ref<SignUpForm['firstName']>('')
const lastName = ref<SignUpForm['lastName']>('')
const email = ref<SignUpForm['email']>('')
const password = ref<SignUpForm['password']>('')
const showPass = ref(false)
const isLoading = ref(false)
const validationErrors = ref<Partial<Record<keyof SignUpForm, string>>>({})

const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)

const messageStore = useMessageStore()
const message = computed(() => messageStore.message)

const canSubmit = computed(() => {
  try {
    signUpSchema.validateSync(
      {
        username: username.value,
        firstName: firstName.value,
        lastName: lastName.value,
        email: email.value,
        password: password.value,
      },
      { abortEarly: true },
    )
    return !isLoading.value
  } catch {
    return false
  }
})

const authStore = useAuthStore()
const router = useRouter()
const profileStore = useProfileStore()
profileStore.init?.()

function clearFieldError(field: keyof SignUpForm) {
  if (validationErrors.value[field]) {
    const next = { ...validationErrors.value }
    delete next[field]
    validationErrors.value = next
  }
}

async function validateField(field: keyof SignUpForm) {
  try {
    await signUpSchema.validateAt(field, {
      username: username.value,
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
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
watch(firstName, () => {
  void validateField('firstName')
})
watch(lastName, () => {
  void validateField('lastName')
})
watch(email, () => {
  void validateField('email')
})
watch(password, () => {
  void validateField('password')
})

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}
async function onSubmit() {
  if (!canSubmit.value) return
  isLoading.value = true
  messageStore.resetMessage()
  try {
    const validated = await signUpSchema.validate(
      {
        username: username.value,
        firstName: firstName.value,
        lastName: lastName.value,
        email: email.value,
        password: password.value,
      },
      { abortEarly: false },
    )
    validationErrors.value = {}

    await authStore.register({
      username: validated.username,
      firstname: validated.firstName,
      lastname: validated.lastName,
      email: validated.email,
      password: validated.password,
    })
    let loggedIn = false
    try {
      await authStore.login(validated.username, validated.password)
      loggedIn = true
    } catch (loginError) {
      if (validated.email && validated.email !== validated.username) {
        try {
          await authStore.login(validated.email, validated.password)
          loggedIn = true
        } catch (emailLoginError) {
          console.warn('Login fallback with email failed:', emailLoginError)
        }
      } else {
        console.warn('Login after registration failed:', loginError)
      }
    }

    if (loggedIn) {
      await authStore.fetchUserProfile()
    }

    if (loggedIn) {
      const userId =
        authStore.user?.id ??
        (authStore.user as any)?.userId ??
        (authStore.user as any)?.user_id ??
        null

      if (selectedFile.value && userId !== null && userId !== undefined) {
        try {
          const uploaded = await profileStore.uploadAvatar(userId, selectedFile.value)
          if (uploaded) {
            profileStore.cacheAvatar(userId, uploaded)
          }
        } catch (avatarError) {
          console.warn('Avatar upload failed after signup:', avatarError)
        }
      }
    }

    if (loggedIn) {
      messageStore.updateMessage('✅ Account created and you are now signed in.')
      setTimeout(() => messageStore.resetMessage(), 2000)
      await router.push({ name: 'home' })
    } else {
      messageStore.updateMessage('✅ Account created. Please sign in to continue.')
      setTimeout(() => messageStore.resetMessage(), 2500)
      await router.push({ name: 'login' })
    }

    username.value = ''
    firstName.value = ''
    lastName.value = ''
    email.value = ''
    password.value = ''
    selectedFile.value = null
    previewUrl.value = null
  } catch (error: any) {
    if (error instanceof ValidationError) {
      const fieldErrors: Partial<Record<keyof SignUpForm, string>> = {}
      if (error.inner?.length) {
        error.inner.forEach((err) => {
          if (err.path) {
            fieldErrors[err.path as keyof SignUpForm] = err.message
          }
        })
      } else if (error.path) {
        fieldErrors[error.path as keyof SignUpForm] = error.message
      }
      validationErrors.value = fieldErrors
      isLoading.value = false
      return
    }
    const text =
      error?.message ||
      (error as { message?: string })?.message ||
      error?.response?.data?.message ||
      'Sign up failed'
    messageStore.updateMessage(`❌ ${text}`)
    setTimeout(() => messageStore.resetMessage(), 4000)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-[100svh] overflow-hidden text-neutral-800">
    <div aria-hidden class="fixed inset-0 -z-50 bg-center bg-cover brightness-[0.85] contrast-[1.05]"
      :style="{ backgroundImage: `url(${bg})` }"></div>

    <div aria-hidden class="pointer-events-none fixed inset-0 -z-40">
      <div class="absolute -left-24 top-16 h-[420px] w-[420px] rounded-full bg-[#892020]/12 blur-3xl animate-pulse">
      </div>
      <div class="absolute -right-28 bottom-10 h-[420px] w-[420px] rounded-full bg-[#892020]/12 blur-3xl animate-pulse">
      </div>
    </div>

    <div aria-hidden class="fixed inset-0 -z-30" style="background:
        linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.5) 60%, rgba(137,32,32,.08) 100%),
        radial-gradient(900px 600px at 70% 10%, rgba(137,32,32,.18), transparent 70%),
        radial-gradient(700px 420px at 15% 90%, rgba(137,32,32,.14), transparent 60%)"></div>

    <div class="grid place-items-center min-h-[100svh] px-4 pt-6 pb-10 sm:translate-y-[-2vh] translate-y-[-1vh]">
      <div class="relative w-full max-w-[520px]">
        <div aria-hidden
          class="absolute -inset-x-24 top-8 h-[64%] -z-10 bg-[radial-gradient(60%_48%_at_50%_0%,rgba(137,32,32,.25),transparent_70%)] blur-[90px] opacity-80">
        </div>

        <div
          class="rounded-[22px] ring-1 ring-white/80 bg-white/90 backdrop-blur-xl shadow-[0_30px_70px_-30px_rgba(0,0,0,.4)] transition-all duration-500">
          <form @submit.prevent="onSubmit" class="p-8 sm:p-9 space-y-7">
            <div class="flex flex-col items-center text-center space-y-4">
              <img :src="logo" alt="FactFlow" class="h-[98px] w-auto" />
              <div class="h-px w-full bg-gradient-to-r from-transparent via-[#892020]/25 to-transparent"></div>
              <div
                class="relative grid place-items-center h-[115px] w-[115px] rounded-full bg-white/95 ring-2 ring-[#892020]/50 shadow-[0_8px_22px_-10px_rgba(0,0,0,.25)] overflow-hidden">
                <label
                  class="group cursor-pointer w-full h-full grid place-items-center relative overflow-hidden rounded-full">
                  <input type="file" class="hidden" accept="image/*" @change="onFileChange" />


                  <img v-if="previewUrl" :src="previewUrl" alt="Profile preview"
                    class="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />

                  <div v-else
                    class="flex flex-col items-center justify-center w-full h-full bg-gradient-to-b from-[#ffffff] to-[#f7e9e9] text-[#892020]/70">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                      stroke="currentColor" class="w-8 h-8 opacity-70 mb-1">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3 7h2l2-3h10l2 3h2a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                    <span class="text-xs font-medium opacity-80">Upload</span>
                  </div>


                  <div
                    class="absolute inset-0 bg-[#892020]/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  </div>
                </label>

              </div>
            </div>

            <div class="space-y-5">
              <div
                class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                </svg>
                <input v-model="username" type="text" autocomplete="username" placeholder="Username"
                  class="w-full pl-12 pr-4 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]" />
              </div>
              <p v-if="validationErrors.username" class="px-3 text-xs text-[#892020]">
                {{ validationErrors.username }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <div
                    class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                    <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                    </svg>
                    <input v-model="firstName" type="text" autocomplete="given-name" placeholder="First name"
                      class="w-full pl-12 pr-4 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]" />
                  </div>
                  <p v-if="validationErrors.firstName" class="px-3 text-xs text-[#892020]">
                    {{ validationErrors.firstName }}
                  </p>
                </div>
                <div class="space-y-1">
                  <div
                    class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                    <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                    </svg>
                    <input v-model="lastName" type="text" autocomplete="family-name" placeholder="Last name"
                      class="w-full pl-12 pr-4 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]" />
                  </div>
                  <p v-if="validationErrors.lastName" class="px-3 text-xs text-[#892020]">
                    {{ validationErrors.lastName }}
                  </p>
                </div>
              </div>

              <div
                class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <input v-model="email" type="email" autocomplete="email" placeholder="Email address"
                  class="w-full pl-12 pr-4 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]" />
              </div>
              <p v-if="validationErrors.email" class="px-3 text-xs text-[#892020]">
                {{ validationErrors.email }}
              </p>

              <div
                class="relative rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-[#892020]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,.6),_0_4px_14px_-6px_rgba(137,32,32,.2)] transition">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#892020]/70" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input :type="showPass ? 'text' : 'password'" v-model="password" autocomplete="new-password"
                  placeholder="Password"
                  class="w-full pl-12 pr-24 py-3 rounded-2xl bg-transparent text-[13px] text-[#4a2c2c] placeholder:text-neutral-400 outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(137,32,32,.35),inset_0_1px_2px_rgba(255,255,255,.7)]" />
                <button type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-xs rounded-full px-3 py-1.5 bg-white/80 ring-1 ring-[#892020]/20 hover:ring-[#892020]/40 text-[#892020] font-medium transition active:scale-95"
                  @click="showPass = !showPass">
                  {{ showPass ? 'Hide' : 'Show' }}
                </button>
              </div>
              <p v-if="validationErrors.password" class="px-3 text-xs text-[#892020]">
                {{ validationErrors.password }}
              </p>
            </div>

            <button type="submit" :disabled="!canSubmit"
              class="mt-2 w-full overflow-hidden rounded-full px-6 py-3.5 text-white bg-gradient-to-b from-[#8f2626] to-[#6f1717] shadow-[0_14px_32px_-16px_rgba(137,32,32,.65)] hover:shadow-[0_18px_40px_-16px_rgba(137,32,32,.75)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition">
              <span v-if="!isLoading">Create account</span>
              <svg v-else class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </button>

            <transition name="fade">
              <div v-if="message" class="text-center text-sm"
                :class="message.startsWith('✅') ? 'text-emerald-700' : 'text-[#892020]'">
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
  0% {
    transform: rotate(0deg);
  }

  10% {
    transform: rotate(12deg);
  }

  20% {
    transform: rotate(-7deg);
  }

  30% {
    transform: rotate(12deg);
  }

  40% {
    transform: rotate(-4deg);
  }

  50% {
    transform: rotate(8deg);
  }

  60%,
  100% {
    transform: rotate(0deg);
  }
}

.animate-wave {
  animation: wave 2.1s ease-in-out infinite;
}

@keyframes halo {
  0% {
    box-shadow: 0 0 0 0 rgba(137, 32, 32, .20);
    opacity: .9;
  }

  70% {
    box-shadow: 0 0 0 14px rgba(137, 32, 32, 0);
    opacity: 0;
  }

  100% {
    box-shadow: 0 0 0 0 rgba(137, 32, 32, 0);
    opacity: 0;
  }
}

.animate-halo {
  animation: halo 2.8s ease-out infinite;
  border-radius: 9999px;
}

@media (prefers-reduced-motion: reduce) {

  .animate-wave,
  .animate-halo {
    animation: none !important;
  }
}
</style>
