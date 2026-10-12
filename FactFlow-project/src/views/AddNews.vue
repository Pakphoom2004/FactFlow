<script setup lang="ts">
import { ref, computed, reactive, watch, watchEffect } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { isAxiosError } from "axios";
import NewsService from '@/services/NewService';
import apiClient from '@/services/AxiosClient';
import bgImage from '@/assets/FACTFLOW-4.png'
import type { NewsItem } from '@/type'
import { useNewsStore } from '@/stores/news'
import { useAuthStore } from '@/stores/auth'

import BaseInput from '@/components/BaseInput.vue'
import BaseTextarea from '@/components/BaseTextarea.vue'
import BaseFileUpload from '@/components/BaseFileUpload.vue'

interface News { imageUrl: string | string[]; title: string; summary: string; body: string; reporter: string }
const news = ref<News>({ imageUrl: "", title: "", summary: "", body: "", reporter: "" })
const newsStore = useNewsStore()
const authStore = useAuthStore()
const router = useRouter()
authStore.init()
const previewImage = ref<string | null>(null)
const message = ref("")
const errors = ref<Record<string, string>>({})
const isUploading = ref(false)
const isSubmitting = ref(false)
const canSubmit = computed(() => !isUploading.value && !isSubmitting.value)
const isBusy = computed(() => isUploading.value || isSubmitting.value)

const uploadEndpoint = (() => {
  const raw = (import.meta.env.VITE_UPLOAD_URL as string | undefined) || '/uploadImage'
  const base = raw.trim() || '/uploadImage'
  const isAbsolute = /^https?:\/\//i.test(base)
  const normalized = isAbsolute
    ? base.replace(/\/+$/, '')
    : `/${base.replace(/^\/+/, '').replace(/\/+$/, '')}`
  return normalized
})()

const alertClass = computed(() =>
  message.value.startsWith('✅')
    ? 'bg-white/90 text-emerald-800 ring-emerald-500/20 shadow-[0_10px_30px_-15px_rgba(16,185,129,.8)]'
    : 'bg-white/90 text-[#5f1111] ring-[#892020]/30 shadow-[0_10px_30px_-15px_rgba(137,32,32,.8)]'
)

const checklist = reactive({ image: false, title: false, summary: false, body: false, reporter: false })
const items = computed(() => ([
  { key: 'image', title: 'Cover image added', done: checklist.image, hint: 'Recommended 1280×720 (16:9)' },
  { key: 'title', title: 'Clear, concise headline', done: checklist.title },
  { key: 'summary', title: '1–2 line summary', done: checklist.summary },
  { key: 'body', title: 'Complete body content', done: checklist.body },
  { key: 'reporter', title: 'Reporter filled in', done: checklist.reporter },
]))
const completed = computed(() => items.value.filter(i => i.done).length)
const progressPercent = computed(() => (completed.value / items.value.length) * 100)
const tweenedPercent = ref(progressPercent.value)
const tweenedCount = ref(completed.value)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
function tween(from: number, to: number, ms: number, cb: (v: number) => void) {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    cb(from + (to - from) * easeOutCubic(t))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
watch(progressPercent, (to) => { tween(tweenedPercent.value, to, 600, v => (tweenedPercent.value = v)) })
watch(completed, (to) => { tween(tweenedCount.value, to, 450, v => (tweenedCount.value = v)) })

const recomputeChecklist = () => {
  const img = news.value.imageUrl
  const hasImage = Array.isArray(img) ? img.length > 0 : !!img
  checklist.image = hasImage || !!previewImage.value
  checklist.title = !!news.value.title.trim()
  checklist.summary = !!news.value.summary.trim()
  checklist.body = !!news.value.body.trim()
  checklist.reporter = !!news.value.reporter.trim()
}
watchEffect(recomputeChecklist)

/* ✅ อัปเดต: เคลียร์ข้อความเก่าทันที, ส่งทั้ง image และ file, รองรับ response หลายแบบ */
async function uploadImage(file: File) {
  // เคลียร์สถานะเก่า ๆ ก่อน
  errors.value.imageUrl = ''
  if (message.value && !message.value.startsWith('✅')) message.value = ''


  previewImage.value = URL.createObjectURL(file)

  const formData = new FormData()
  formData.append("image", file)
  formData.append("file", file) // บาง backend ใช้ key นี้
  try {
    isUploading.value = true

    const { data } = await apiClient.post(uploadEndpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    const d: any = data?.data ?? data ?? {}
    let url: string =
      d.url ||
      d.secure_url ||
      d.imageUrl ||
      d.imageURL ||
      d.image_url ||
      d.fileUrl ||
      d.fileURL ||
      d.file_url ||
      d.location ||
      d.path ||
      d.fullPath ||
      d.full_path ||
      d.name ||
      d.filename ||
      d.fileName ||
      d.key ||
      ''

    if (!url) {
      const first =
        Array.isArray(d) ? d[0] :
          (typeof d === 'object' && Object.values(d).find((v: any) => v?.url || v?.name || v?.filename))
      if (first && typeof first === 'object') {
        url =
          first?.url ||
          first?.secure_url ||
          first?.imageUrl ||
          first?.imageURL ||
          first?.image_url ||
          first?.fileUrl ||
          first?.fileURL ||
          first?.file_url ||
          first?.location ||
          first?.path ||
          first?.fullPath ||
          first?.full_path ||
          first?.name ||
          first?.filename ||
          first?.fileName ||
          first?.key ||
          ''
      } else if (typeof first === 'string') {
        url = first
      }
    }

    news.value.imageUrl = url || news.value.imageUrl || ''
    errors.value.imageUrl = ''
  } catch (err: any) {
    const apiMsg = err?.response?.data?.message || err?.message || 'Upload failed'
    message.value = `❌ ${apiMsg}`
    setTimeout(() => (message.value = ''), 2600)
  } finally {
    isUploading.value = false
  }
}

function clearImage() {
  previewImage.value = null
  news.value.imageUrl = ""
}

function clearForm() {
  clearImage()
  news.value = { imageUrl: "", title: "", summary: "", body: "", reporter: "" }
  errors.value = {}
  message.value = ""
}

const validateForm = (): boolean => {
  errors.value = {}
  let ok = true

  const img = news.value.imageUrl
  const hasImageFromState = Array.isArray(img) ? img.length > 0 : !!img
  const hasImage = hasImageFromState || !!previewImage.value

  if (!hasImage) { errors.value.imageUrl = "Please upload an image."; ok = false }
  if (!news.value.title.trim()) { errors.value.title = "Please enter a title."; ok = false }
  if (!news.value.summary.trim()) { errors.value.summary = "Please enter a short summary."; ok = false }
  if (!news.value.body.trim()) { errors.value.body = "Please enter the full news content."; ok = false }
  if (!news.value.reporter.trim()) { errors.value.reporter = "Please enter the reporter's name."; ok = false }
  return ok
}

const addNews = async () => {
  if (!validateForm() || !canSubmit.value) {
    if (!message.value) {
      message.value = "❌ Please fill in all required fields."
      setTimeout(() => (message.value = ""), 2200)
    }
    return
  }
  try {
    isSubmitting.value = true
    const payload: Partial<NewsItem> = {
      ...news.value,
      imageUrl: Array.isArray(news.value.imageUrl)
        ? news.value.imageUrl[0] || ""
        : news.value.imageUrl || "",
      reportedAt: new Date().toISOString()
    }
    const imageUrl = payload.imageUrl || ''
    if (!authStore.token && !localStorage.getItem('access_token')) {
      message.value = "❌ Please log in as an admin before publishing."
      setTimeout(() => (message.value = ""), 2800)
      router.push({ name: 'login' })
      return
    }

    await NewsService.createNews({
      ...payload,
      imageUrl,
    })
    await newsStore.reload().catch(() => undefined)

    message.value = "✅ News added successfully!"
    news.value = { imageUrl: "", title: "", summary: "", body: "", reporter: "" }
    previewImage.value = null
    errors.value = {}
    setTimeout(() => (message.value = ""), 2000)
  } catch (err) {
    let errorText = "Failed to add news."
    if (isAxiosError(err)) {
      errorText =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.statusText ||
        err.message ||
        errorText
    } else if (err instanceof Error && err.message) {
      errorText = err.message
    }
    console.error('❌ Failed to add news:', err)
    message.value = `❌ ${errorText}`
    setTimeout(() => (message.value = ""), 2200)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="relative min-h-[88vh]">
    <!-- BG: ภาพ + orbs ลอยช้า ๆ -->
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 bg-center bg-cover"
      :style="{ backgroundImage: `url(${bgImage})` }"></div>
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10">
      <div class="absolute -left-20 top-10 h-[420px] w-[420px] rounded-full bg-[#892020]/10 blur-3xl animate-orb1">
      </div>
      <div class="absolute -right-24 bottom-10 h-[380px] w-[380px] rounded-full bg-[#892020]/10 blur-3xl animate-orb2">
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between -mt-7 mb-4">
        <RouterLink to="/"
          class="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-white bg-[#892020] hover:bg-[#a12a2a] active:scale-95 shadow-lg hover:shadow-xl transition"
          aria-label="Back to Home">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span class="text-sm font-semibold">Back</span>
        </RouterLink>

        <div
          class="w-fit rounded-full border border-[#892020]/30 bg-white/80 backdrop-blur px-6 py-2 text-[#892020] font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,.35)]">
          FactFlow Admin
        </div>
      </div>

      <div class="relative animate-drop-in">
        <div
          class="absolute inset-x-6 -top-3 h-6 bg-gradient-to-r from-transparent via-[#892020]/10 to-transparent blur">
        </div>
        <div
          class="p-[1px] rounded-[30px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(137,32,32,.45),rgba(255,255,255,.6),rgba(137,32,32,.45))]">
          <div
            class="relative rounded-[28px] bg-white/90 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_30px_60px_-25px_rgba(137,32,32,.35),0_10px_30px_-15px_rgba(0,0,0,.25)] ring-1 ring-white/60">
            <div
              class="pointer-events-none absolute -inset-px rounded-[28px] [background:radial-gradient(80%_40%_at_20%_0%,rgba(137,32,32,.06),transparent_60%)]">
            </div>

            <div class="relative">
              <!-- Divider glow -->
              <div
                class="hidden md:block absolute inset-y-0 left-[40%] w-[2px] z-10 rounded-full bg-gradient-to-b from-transparent via-[#892020]/60 to-transparent shadow-[0_0_12px_rgba(137,32,32,0.28)] pointer-events-none animate-divider-pulse">
              </div>

              <div class="grid md:grid-cols-5 gap-0">
                <!-- Left: Checklist -->
                <div
                  class="md:col-span-2 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-white/60 dark:border-white/10 bg-[#f7f7f5]/85 dark:bg-white/5 rounded-t-[28px] md:rounded-l-[28px] md:rounded-tr-none ring-1 ring-neutral-200/70 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.20)]">
                  <div class="flex items-center gap-3 mb-5">
                    <div class="h-10 w-10 rounded-2xl bg-[#892020] text-white grid place-items-center shadow-md">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <div>
                      <h2 class="text-2xl font-black tracking-tight text-[#1b1b1b]">Quality Checklist</h2>
                      <p class="text-xs text-[#892020] font-medium">Make your article ready to publish</p>
                    </div>
                  </div>

                  <div class="mb-5">
                    <div class="flex items-center justify-between text-[13px] text-neutral-600 mb-1.5">
                      <span>Completeness</span>
                      <span class="font-semibold text-[#892020]">{{ Math.round(tweenedCount) }}/{{ items.length
                        }}</span>
                    </div>
                    <div class="h-2 rounded-full bg-white ring-1 ring-[#892020]/20 overflow-hidden">
                      <div class="h-full bg-[#892020] transition-[width] duration-300 ease-out will-change-[width]"
                        :class="isBusy ? 'animate-progress-stripes' : ''" :style="{ width: tweenedPercent + '%' }"
                        role="progressbar" :aria-valuenow="Math.round(tweenedPercent)" aria-valuemin="0"
                        aria-valuemax="100"></div>
                    </div>
                  </div>

                  <ul class="space-y-3">
                    <li v-for="it in items" :key="it.key"
                      class="flex items-start gap-3 rounded-xl bg-white/95 p-3 ring-1 ring-[#892020]/15 shadow-[0_6px_16px_-12px_rgba(137,32,32,.25)]">
                      <div
                        class="mt-0.5 h-5 w-5 rounded-full ring-1 ring-[#892020]/30 grid place-items-center transition-transform duration-300"
                        :class="it.done ? 'bg-[#892020] text-white scale-[1.06] animate-tick-pop' : 'bg-white text-transparent scale-100'">
                        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <div>
                        <p class="font-medium text-[15px] text-neutral-800">{{ it.title }}</p>
                        <p v-if="it.hint" class="text-[12px] text-neutral-500 mt-0.5">{{ it.hint }}</p>
                      </div>
                    </li>
                  </ul>

                  <div class="mt-6 rounded-2xl bg-white/95 p-4 ring-1 ring-[#892020]/15">
                    <p class="text-[12px] font-semibold text-[#892020] mb-2">Tips</p>
                    <ul class="list-disc pl-5 text-[13px] text-neutral-700 space-y-1.5">
                      <li>Use a 16:9 cover image, at least 1280×720px.</li>
                      <li>Keep the title ≤ 80 characters with a clear keyword.</li>
                      <li>Write a 1–2 line summary that captures the core idea.</li>
                      <li>Add sources when you cite numbers/statistics.</li>
                    </ul>
                  </div>
                </div>

                <!-- Right: Form -->
                <form @submit.prevent="addNews"
                  class="md:col-span-3 p-6 sm:p-8 space-y-7 bg-white/75 dark:bg-white/5 rounded-b-[28px] md:rounded-r-[28px] md:rounded-bl-none border-t md:border-t-0 border-white/60 dark:border-white/10">
                  <div class="space-y-2">
                    <div class="text-sm font-semibold text-[#1b1b1b] dark:text-white flex items-center gap-2">
                      <span class="h-1.5 w-1.5 rounded-full bg-[#892020]"></span>Cover Image
                    </div>
                    <BaseFileUpload :preview="previewImage" :uploading="isUploading" :error="errors.imageUrl"
                      hint="Click to upload JPG/PNG — 1280×720 (16:9) recommended" @select="uploadImage"
                      @clear="clearImage" />
                  </div>

                  <div class="grid grid-cols-1 gap-6">
                    <BaseInput v-model="news.title" label="Title" :error="errors.title" required />
                    <BaseTextarea v-model="news.summary" label="Summary" :rows="3" :error="errors.summary" required />
                    <BaseTextarea v-model="news.body" label="Body" :rows="8" :error="errors.body" required />
                    <BaseInput v-model="news.reporter" label="Reporter" :error="errors.reporter" required />
                  </div>

                  <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="text-sm text-gray-500" :class="{ 'text-[#892020]': isUploading }">
                      <span v-if="isUploading">Uploading image…</span>
                      <span v-else-if="isSubmitting">Publishing…</span>
                      <span v-else>Ready</span>
                    </div>
                    <div class="flex w-full sm:w-auto items-center gap-3">
                      <button type="button" @click="clearForm"
                        class="px-6 py-3 rounded-full border border-gray-300/70 dark:border-white/15 bg-white text-[#1b1b1b] dark:text-white hover:bg-white/90">Clear</button>

                      <button type="submit" :disabled="!canSubmit"
                        class="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-white bg-[#892020]
                               disabled:opacity-50 disabled:cursor-not-allowed
                               shadow-lg hover:shadow-xl active:scale-[0.99] transition w-full sm:w-auto overflow-hidden">
                        <svg v-if="isSubmitting" class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        <span>Publish</span>
                        <span aria-hidden="true"
                          class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition">
                          <span class="absolute -inset-y-2 -left-1/3 w-1/3 skew-x-[-20deg] animate-button-sheen"
                            style="background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);"></span>
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div
              class="absolute -bottom-5 left-6 right-6 h-8 bg-gradient-to-b from-[#892020]/20 to-transparent blur-2xl">
            </div>
          </div>
        </div>
      </div>

      <transition name="fade">
        <div v-if="message" class="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div class="relative flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md ring-1 select-none"
            :class="alertClass" role="status" aria-live="polite">
            <svg v-if="message.startsWith('✅')" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <span class="text-sm font-medium tracking-tight">{{ message.replace(/^✅\s*|^❌\s*/, '') }}</span>
            <button type="button"
              class="ml-2 inline-flex items-center justify-center rounded-full w-6 h-6 ring-1 ring-black/5 hover:bg-black/5 active:scale-95 transition"
              @click="message = ''" aria-label="Close">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div class="absolute inset-x-2 bottom-1 h-0.5 rounded-full"
              :class="message.startsWith('✅') ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0' : 'bg-gradient-to-r from-[#892020]/0 via-[#892020] to-[#892020]/0'">
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<!-- <style scoped>
@keyframes dropIn {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(.99)
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1)
  }
}

.animate-drop-in {
  animation: dropIn .5s cubic-bezier(.2, .8, .2, 1)
}

@keyframes orb1 {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: .9
  }

  50% {
    transform: translate3d(28px, 18px, 0) scale(1.05);
    opacity: .85
  }

  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: .9
  }
}

@keyframes orb2 {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: .85
  }

  50% {
    transform: translate3d(-26px, -16px, 0) scale(1.06);
    opacity: .8
  }

  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: .85
  }
}

.animate-orb1 {
  animation: orb1 14s ease-in-out infinite
}

.animate-orb2 {
  animation: orb2 16s ease-in-out infinite
}

@keyframes stripes {
  0% {
    background-position: 0 0
  }

  100% {
    background-position: 40px 0
  }
}

.animate-progress-stripes {
  background-image: linear-gradient(45deg, rgba(255, 255, 255, .35) 25%, rgba(255, 255, 255, 0) 25%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, .35) 50%, rgba(255, 255, 255, .35) 75%, rgba(255, 255, 255, 0) 75%, rgba(255, 255, 255, 0) 100%);
  background-size: 40px 40px;
  animation: stripes .9s linear infinite
}

@keyframes tickPop {
  0% {
    transform: scale(.7);
    opacity: .6
  }

  60% {
    transform: scale(1.15);
    opacity: 1
  }

  100% {
    transform: scale(1.06)
  }
}

.animate-tick-pop {
  animation: tickPop .35s ease-out
}

@keyframes dividerPulse {
  0% {
    box-shadow: 0 0 12px rgba(137, 32, 32, .20)
  }

  50% {
    box-shadow: 0 0 22px rgba(137, 32, 32, .28)
  }

  100% {
    box-shadow: 0 0 12px rgba(137, 32, 32, .20)
  }
}

.animate-divider-pulse {
  animation: dividerPulse 3.2s ease-in-out infinite
}

@keyframes buttonSheen {
  0% {
    transform: translateX(-140%);
    opacity: 0
  }

  10% {
    opacity: .6
  }

  100% {
    transform: translateX(180%);
    opacity: 0
  }
}

.animate-button-sheen {
  animation: buttonSheen 1.1s ease forwards
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .35s ease
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0
}
</style> -->
