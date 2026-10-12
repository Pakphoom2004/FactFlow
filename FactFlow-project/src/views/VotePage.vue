<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useNewsStore } from '@/stores/news'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { isAxiosError } from 'axios'

const props = defineProps<{ show: boolean, newsId: string | number }>()
const emit = defineEmits<{ (e: 'close'): void, (e: 'submitted', comment: any): void }>()

const store = useNewsStore()
const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()

const choice = ref<'FAKE' | 'REAL'>('FAKE')
const author = ref('')
const text = ref('')
const errors = ref<{ author?: string; text?: string }>({})
const showFormAlert = ref(false)

/** 'form' = ฟอร์มโหวต, 'success' = ป็อปอัปสำเร็จ */
const phase = ref<'form' | 'success'>('form')

const currentUser = computed(() => authStore.user)
const normalizedUserId = computed(() => {
  const user = currentUser.value
  if (!user) return null
  const candidate = user.id ?? (user as any).username ?? user.email ?? null
  if (candidate === null || candidate === undefined || candidate === '') return null
  return candidate
})

const defaultAuthor = computed(() => {
  const user = currentUser.value
  if (!user) return ''
  const first =
    user.firstname ??
    (user as any).firstName ??
    (user as any).first_name ??
    ''
  const last =
    user.lastname ??
    (user as any).lastName ??
    (user as any).last_name ??
    ''
  const full = `${first} ${last}`.trim()
  return full || (user as any).username || user.email || ''
})

const currentAvatar = computed(() => {
  if (!normalizedUserId.value) return null
  return profileStore.avatarById(String(normalizedUserId.value))
})

watch(
  defaultAuthor,
  (val, oldVal) => {
    if (!author.value || author.value === (oldVal || '')) {
      author.value = val || ''
    }
  },
  { immediate: true },
)

function validate() {
  errors.value = {}
  if (!author.value.trim()) errors.value.author = 'Please enter your name.'
  if (!text.value.trim()) errors.value.text = 'Please add a comment.'
  const hasError = !!(errors.value.author || errors.value.text)
  showFormAlert.value = hasError
  return !hasError
}

function resetForm() {
  author.value = defaultAuthor.value || ''
  text.value = ''
  choice.value = 'FAKE'
  errors.value = {}
  showFormAlert.value = false
}

function closeModal() {
  // ปิดฟอร์มโดยไม่ redirect
  resetForm()
  phase.value = 'form'
  emit('close')
}

async function submitVote() {
  if (!validate()) return

  const voteType = choice.value
  const timestamp = new Date().toISOString()
  const newComment = {
    author: author.value || defaultAuthor.value || 'Anonymous',
    text: text.value,
    message: text.value,
    isFake: voteType === 'FAKE',
    voteType,
    createdAt: timestamp,
    commentedAt: timestamp,
    avatarUrl: currentAvatar.value || undefined,
    userId: normalizedUserId.value || undefined,
  }

  try {
    await store.addVote(props.newsId, voteType, newComment)

    // ส่งคอมเมนต์ให้พาเรนเดอร์ทันที แล้วโชว์ success popup
    emit('submitted', newComment)
    resetForm()
    phase.value = 'success'
  } catch (error) {
    console.error('Failed to submit vote:', error)
    const backendMessage = isAxiosError(error)
      ? error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.response?.data
      : null
    const message =
      (typeof backendMessage === 'string' ? backendMessage : null) ||
      (error instanceof Error && error.message
        ? error.message
        : 'Failed to submit your vote. Please try again.')
    alert(message)
  }
}

/** ปิด success แล้วค่อยออกจากโมดัล + ไปหน้า comments */
async function dismissSuccess() {
  phase.value = 'form'
  emit('close')
  await router.push({ name: 'news-comments', params: { id: String(props.newsId) } })
}
</script>

<template>
  <transition
    appear
    enter-active-class="transition duration-400 ease-[cubic-bezier(.2,.8,.2,1)]"
    enter-from-class="opacity-0" enter-to-class="opacity-100"
    leave-active-class="transition duration-250 ease-[cubic-bezier(.4,0,.2,1)]"
    leave-from-class="opacity-100" leave-to-class="opacity-0"
  >
    <!-- คอนเทนเนอร์มี padding รอบ ๆ เพื่อไม่ให้ชิดขอบหน้าจอ -->
    <div v-if="show" class="fixed inset-0 z-[52] grid place-items-center px-4 sm:px-8 py-6">
      <!-- Overlay: fixed เต็มขอบ + blur สุดขอบบน -->
      <div
        class="fixed inset-0 bg-black/30 backdrop-blur-md"
        @click="phase === 'success' ? dismissSuccess() : closeModal()"
      ></div>

      <!-- Modal -->
      <div
        class="relative w-full max-w-[720px] rounded-3xl overflow-hidden
               bg-gray-100/95 backdrop-blur-md ring-1 ring-[#892020]/10 shadow-2xl z-10"
        aria-live="polite"
      >
        <!-- Header (โค้งชนขอบบน) -->
        <div class="px-6 sm:px-8 pt-6 pb-4 bg-[#892020] text-white relative rounded-t-3xl">
          <h3 class="text-xl font-semibold">
            {{ phase === 'form' ? 'Vote' : 'Success' }}
          </h3>
          <button
            @click="phase === 'success' ? dismissSuccess() : closeModal()"
            class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/30"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <!-- ====================== FORM ====================== -->
        <template v-if="phase === 'form'">
          <!-- Alert -->
          <div
            v-if="showFormAlert && (errors.author || errors.text)"
            class="mx-6 sm:mx-8 mt-4 rounded-xl border border-rose-300 bg-rose-100/90 text-rose-800 px-4 py-3 text-sm flex items-center gap-2"
            role="alert"
          >
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-rose-600"></span>
            Please fix the fields highlighted below.
          </div>

          <!-- Form -->
          <form class="px-6 sm:px-8 py-6 space-y-6" @submit.prevent="submitVote">
            <!-- Choice -->
            <div>
              <label class="block text-sm font-medium mb-1">Your Decision</label>
              <div class="relative w-full max-w-[340px] h-10 rounded-full bg-white ring-1 ring-[#892020]/30 select-none flex items-center">
                <span
                  class="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full shadow-sm transition-transform"
                  :class="choice === 'FAKE' ? 'translate-x-0 bg-[#892020]' : 'translate-x-full bg-[#3D7A5E]'"
                ></span>
                <button type="button" class="relative flex-1 z-10 text-sm font-medium"
                  :class="choice === 'FAKE' ? 'text-white' : 'text-black'" @click="choice = 'FAKE'">Fake</button>
                <button type="button" class="relative flex-1 z-10 text-sm font-medium"
                  :class="choice === 'REAL' ? 'text-white' : 'text-black'" @click="choice = 'REAL'">Not Fake</button>
              </div>
            </div>

            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-slate-800 mb-1">Name</label>
              <input
                v-model="author"
                placeholder="Your Name"
                :aria-invalid="!!errors.author"
                aria-describedby="name-error"
                class="w-full rounded-full bg-white px-4 py-2 placeholder:text-slate-400 focus:outline-none border ring-0 transition"
                :class="errors.author
                  ? 'border-rose-500 focus:ring-2 focus:ring-rose-300'
                  : 'border-[#892020] focus:border-[#892020] focus:ring-2 focus:ring-[#892020]/30'"
              />
              <p v-if="errors.author" id="name-error" class="mt-1 text-xs text-rose-600">
                {{ errors.author }}
              </p>
            </div>

            <!-- Comment -->
            <div>
              <label class="block text-sm font-medium text-slate-800 mb-1">Comment</label>
              <textarea
                v-model="text"
                placeholder="Reasons..."
                :aria-invalid="!!errors.text"
                aria-describedby="comment-error"
                class="w-full min-h-[8rem] rounded-2xl bg-white px-4 py-2 placeholder:text-slate-400 focus:outline-none border transition"
                :class="errors.text
                  ? 'border-rose-500 focus:ring-2 focus:ring-rose-300'
                  : 'border-[#892020] focus:border-[#892020] focus:ring-2 focus:ring-[#892020]/30'"
              />
              <p v-if="errors.text" id="comment-error" class="mt-1 text-xs text-rose-600">
                {{ errors.text }}
              </p>
            </div>

            <!-- Buttons -->
            <div class="pt-2 flex justify-end gap-2">
              <button type="button" class="rounded-full px-4 py-2 bg-white ring-1 ring-[#892020]/25" @click="closeModal">
                Cancel
              </button>
              <button type="submit" class="rounded-full px-4 py-2 bg-[#892020] text-white hover:bg-[#a83232]">
                Submit vote
              </button>
            </div>
          </form>
        </template>

        <!-- ==================== SUCCESS POPUP ==================== -->
        <template v-else>
          <div class="px-6 sm:px-8 py-10 bg-gray-100/95">
            <div class="mx-auto max-w-sm text-center">
              <div class="mx-auto mb-4 grid place-items-center">
                <div class="h-14 w-14 rounded-full bg-[#892020] grid place-items-center shadow">
                  <!-- check icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
              </div>
              <h4 class="text-xl font-semibold text-slate-900">Vote successful</h4>
              <p class="mt-1.5 text-sm text-slate-600">
                Thanks for contributing. Your vote has been recorded.
              </p>

              <div class="mt-6 flex items-center justify-center gap-2">
                <button
                  class="rounded-full px-4 py-2 bg-white ring-1 ring-[#892020]/25"
                  @click="dismissSuccess()"
                >
                  Close
                </button>
                <button
                  class="rounded-full px-4 py-2 bg-[#892020] text-white hover:bg-[#a83232]"
                  @click="dismissSuccess()"
                >
                  View comments
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>
