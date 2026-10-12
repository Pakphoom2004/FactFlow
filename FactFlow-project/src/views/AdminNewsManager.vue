<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNewsStore } from '@/stores/news'
import { useAuthStore } from '@/stores/auth'
import { useAdminRequestStore } from '@/stores/adminRequest'
import { formatDateTime } from '@/utils/time'
import backgroundTexture from '@/assets/FACTFLOW-4.png'

const router = useRouter()
const newsStore = useNewsStore()
const authStore = useAuthStore()
const adminRequestStore = useAdminRequestStore()

newsStore.load()

const hasApprovedRequest = computed(() => {
  const user = authStore.user
  if (!user) return false
  const identifier = user.id ?? (user as any).username ?? user.email
  if (identifier === null || identifier === undefined) return false
  const latest = adminRequestStore.latestRequestByUser(String(identifier))
  return latest?.status === 'approved'
})

const canModerate = computed(() => {
  const user = authStore.user
  if (!user) return false
  const primaryRole = typeof user.role === 'string' ? user.role.toUpperCase() : ''
  if (primaryRole === 'ROLE_ADMIN') return true
  if (Array.isArray(user.roles) && user.roles.some((role: string) => role?.toUpperCase?.() === 'ROLE_ADMIN')) {
    return true
  }
  return !!hasApprovedRequest.value
})

const newsEntries = computed(() => {
  return newsStore.all.map((item) => ({
    item,
    hidden: newsStore.isNewsHidden(item.id),
    votes: newsStore.combinedVotes(item.id),
    comments: newsStore.combinedComments(item.id),
  }))
})

const backgroundStyle = computed(() => ({
  backgroundImage: `url(${backgroundTexture})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}))

const metricsCards = computed(() => {
  const total = newsEntries.value.length
  const visibleCount = newsEntries.value.filter((entry) => !entry.hidden).length
  const hiddenCount = newsEntries.value.filter((entry) => entry.hidden).length
  const commentsCount = newsEntries.value.reduce((totalComments, entry) => totalComments + (entry.comments?.length || 0), 0)

  return [
    {
      key: 'total',
      label: 'Total Stories',
      value: total,
      borderClass: 'border-[#f0e4db]',
      backgroundClass:
        "bg-[radial-gradient(120%_120%_at_20%_20%,rgba(247,235,229,0.6),rgba(255,255,255,0.95))]",
      labelClass: 'text-[#b96a4c]/80',
      valueClass: 'text-[#311d1d]',
    },
    {
      key: 'visible',
      label: 'Visible',
      value: visibleCount,
      borderClass: 'border-[#cfddd3]',
      backgroundClass:
        "bg-[radial-gradient(120%_120%_at_20%_20%,rgba(227,239,233,0.65),rgba(255,255,255,0.95))]",
      labelClass: 'text-[#4c6353]/80',
      valueClass: 'text-[#4c6353]',
    },
    {
      key: 'hidden',
      label: 'Hidden',
      value: hiddenCount,
      borderClass: 'border-[#f2d5cf]',
      backgroundClass:
        "bg-[radial-gradient(120%_120%_at_20%_20%,rgba(252,231,226,0.68),rgba(255,255,255,0.95))]",
      labelClass: 'text-[#a65a45]/80',
      valueClass: 'text-[#a65a45]',
    },
    {
      key: 'comments',
      label: 'Total Comments',
      value: commentsCount,
      borderClass: 'border-[#eadad6]',
      backgroundClass:
        "bg-[radial-gradient(120%_120%_at_20%_20%,rgba(247,232,235,0.65),rgba(255,255,255,0.95))]",
      labelClass: 'text-[#75525b]/70',
      valueClass: 'text-[#4a2b32]',
    },
  ]
})

function goAddNews() {
  router.push({ name: 'add-news' })
}

function goDetail(id: string | number) {
  router.push({ name: 'news-detail', params: { id } })
}

function toggleVisibility(id: string | number, hidden: boolean) {
  newsStore.setNewsHidden(id, hidden)
}

function removeComment(newsId: string | number, commentId: string) {
  if (!confirm('Remove this comment?')) return
  newsStore.removeComment(newsId, commentId)
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div
      aria-hidden="true"
      class="fixed inset-0 -z-20 bg-cover bg-center"
      :style="backgroundStyle"
    ></div>
    <section class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 space-y-8">
      <header class="space-y-6 rounded-[32px] border border-[#e4d7cc] bg-white p-6 sm:p-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-4 text-[#311d1d]">
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-[0.55em] text-[#b96a4c]">Control Center</p>
              <h1 class="text-3xl sm:text-[2.625rem] font-semibold leading-tight">News Management</h1>
            </div>
            <p class="text-sm sm:text-base text-[#311d1d]/70 max-w-2xl">
              Review submissions, moderate conversations, and highlight trustworthy stories for FactFlow readers.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              class="inline-flex items-center gap-2 rounded-full border border-[#c8b7aa] px-5 py-2.5 text-sm font-semibold text-[#5a3d2c] transition hover:border-[#b58a58] hover:bg-[#f7efe8]"
              @click="router.push({ name: 'home' })"
            >
              <span class="text-lg leading-none">←</span>
              Back to site
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-full bg-[#942d29] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(164,82,56,0.45)] transition hover:bg-[#8d3e26]"
              @click="goAddNews"
            >
              <span class="text-lg leading-none">＋</span>
              Add News
            </button>
          </div>
        </div>

        <TransitionGroup
          appear
          name="metrics"
          tag="div"
          class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-[#311d1d]"
        >
          <div
            v-for="card in metricsCards"
            :key="card.key"
            class="group relative overflow-hidden rounded-3xl border bg-white px-5 py-4 transition-transform duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1 hover:shadow-[0_22px_48px_-30px_rgba(73,50,40,0.35)] after:content-[''] after:absolute after:left-[-20%] after:right-[-20%] after:top-[-120%] after:bottom-[40%] after:bg-[radial-gradient(60%_60%_at_50%_45%,rgba(185,106,76,0.18),transparent_70%)] after:pointer-events-none after:opacity-0 after:transition-opacity after:duration-500 group-hover:after:opacity-100"
            :class="[card.borderClass, card.backgroundClass]"
          >
            <p class="text-[11px] uppercase tracking-[0.35em]" :class="card.labelClass">{{ card.label }}</p>
            <p class="mt-3 text-3xl font-semibold" :class="card.valueClass">{{ card.value }}</p>
          </div>
        </TransitionGroup>
      </header>

      <div
        v-if="!canModerate"
        class="rounded-[46px] border border-rose-100 bg-white/80 p-10 text-center text-[#3b1414]/75 shadow-[0_35px_110px_-90px_rgba(137,32,32,0.6)] backdrop-blur"
      >
        You need admin permissions to manage news.
      </div>

      <div v-else>
        <div
          v-if="!newsEntries.length"
          class="rounded-[46px] border border-rose-100 bg-white/80 p-12 text-center text-[#3b1414]/75 shadow-[0_35px_110px_-90px_rgba(137,32,32,0.6)] backdrop-blur"
        >
          No news articles available yet.
        </div>

        <TransitionGroup
          v-else
          appear
          name="news-list"
          tag="div"
          class="space-y-6"
        >
          <article
            v-for="entry in newsEntries"
            :key="entry.item.id"
            class="group relative overflow-hidden rounded-[44px] border border-[#eadede]/80 bg-white/90 p-6 sm:p-8 backdrop-blur space-y-6 shadow-[0_45px_120px_-90px_rgba(137,32,32,0.32)] transition-transform duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1.5 hover:shadow-[0_28px_60px_-28px_rgba(49,29,29,0.35)] after:content-[''] after:absolute after:inset-0 after:bg-[linear-gradient(135deg,rgba(255,255,255,0)_30%,rgba(244,238,233,0.55)_100%)] after:pointer-events-none after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
          >
            <div class="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between text-[#3b1414]">
              <div class="space-y-3">
                <div class="flex flex-wrap items-center gap-3">
                  <h2 class="text-2xl font-semibold leading-tight">{{ entry.item.title }}</h2>
                  <span
                    class="inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold"
                    :class="entry.hidden ? 'border-rose-300 text-rose-700/90 bg-rose-50/80' : 'border-[#cfddd3] bg-[#eef4f0] text-[#4c6353]'"
                  >
                    <span
                      class="h-2 w-2 rounded-full"
                      :class="entry.hidden ? 'bg-rose-500' : 'bg-[#4c6353]'"
                    ></span>
                    {{ entry.hidden ? 'Hidden' : 'Visible' }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-3 text-xs text-[#3b1414]/70">
                  <span class="inline-flex items-center gap-1 rounded-full bg-[#3b1414]/5 px-2.5 py-1">
                    <span class="font-semibold uppercase tracking-[0.2em]">Reporter</span>
                    <span>{{ entry.item.reporter }}</span>
                  </span>
                  <span class="h-1 w-1 rounded-full bg-[#3b1414]/20"></span>
                  <span class="inline-flex items-center gap-1">
                    <span class="uppercase tracking-[0.25em] text-[11px]">Published</span>
                    <time :datetime="entry.item.reportedAt">{{ formatDateTime(entry.item.reportedAt) }}</time>
                  </span>
                  <span class="h-1 w-1 rounded-full bg-[#3b1414]/20"></span>
                  <span class="inline-flex items-center gap-1">
                    <span class="uppercase tracking-[0.25em] text-[11px]">Comments</span>
                    <span>{{ entry.comments.length }}</span>
                  </span>
                </div>
              </div>

              <!-- ใส่ z-10 ป้องกันโดนชั้นโปร่งใสทับ -->
              <div class="relative z-10 flex flex-wrap gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="goDetail(entry.item.id)"
                >
                  <span class="text-base leading-none">👁</span>
                  View Article
                </button>
                <button
                  v-if="entry.hidden"
                  class="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition bg-[#4c6353] hover:bg-[#394d3f] shadow-[0_18px_40px_-22px_rgba(76,99,83,0.45)]"
                  @click="toggleVisibility(entry.item.id, false)"
                >
                  <span class="text-base leading-none">▢</span>
                  Unhide Story
                </button>
                <button
                  v-else
                  class="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition bg-[#7e2d2d] hover:bg-[#6d2626] shadow-[0_18px_40px_-22px_rgba(190,18,60,0.55)]"
                  @click="toggleVisibility(entry.item.id, true)"
                >
                  <span class="text-base leading-none">✕</span>
                  Hide from users
                </button>
              </div>
            </div>

            <p class="relative text-sm text-[#3b1414]/75 leading-relaxed">
              {{ entry.item.summary || entry.item.body }}
            </p>

            <details class="relative rounded-[36px] border border-[#ead3d0] bg-white p-4 sm:p-5">
              <summary class="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-[#3b1414] transition-colors duration-300">
                <span class="text-base leading-none">💬</span>
                Comments ({{ entry.comments.length }})
              </summary>
              <div v-if="entry.comments.length" class="mt-5 space-y-3">
                <div
                  v-for="comment in entry.comments"
                  :key="comment.id"
                  class="rounded-[32px] border border-[#ede5e2] bg-white p-4 sm:p-5 flex flex-col gap-3 shadow-sm"
                >
                  <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div class="flex flex-wrap items-center gap-3 text-[#3b1414]">
                      <span class="inline-flex items-center gap-2 rounded-full bg-[#3b1414]/5 px-3 py-1 font-semibold">
                        <span>{{ comment.author || 'Anonymous' }}</span>
                      </span>
                      <span class="text-[#3b1414]/50 text-xs">
                        {{ formatDateTime(comment.commentedAt || comment.createdAt) }}
                      </span>
                    </div>
                    <button
                      class="inline-flex items-center gap-2 rounded-full border border-[#e4d7cc] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#3b1414] transition hover:border-[#b58a58] hover:bg-[#f7efe8]"
                      @click="removeComment(entry.item.id, String(comment.id))"
                    >
                      <span class="text-sm leading-none text-[#b58a58]">🗑</span>
                      Remove
                    </button>
                  </div>
                  <p class="text-sm text-[#3b1414]/80 whitespace-pre-line leading-relaxed">
                    {{ comment.text || comment.message }}
                  </p>
                </div>
              </div>
              <p v-else class="mt-5 text-xs text-[#3b1414]/50">No comments yet.</p>
            </details>
          </article>
        </TransitionGroup>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ===== Vue transition classes (ใช้ Tailwind ผ่าน @apply) ===== */
.metrics-enter-active,
.metrics-leave-active { @apply transition-all duration-[450ms] ease-[cubic-bezier(.22,.61,.36,1)]; }
.metrics-enter-from,
.metrics-leave-to { @apply opacity-0 translate-y-[18px] scale-95; }
.metrics-move { @apply transition-transform duration-[450ms] ease-[cubic-bezier(.22,.61,.36,1)]; }

.news-list-enter-active,
.news-list-leave-active { @apply transition-all duration-[450ms] ease-[cubic-bezier(.2,.65,.35,1)]; }
.news-list-enter-from,
.news-list-leave-to { @apply opacity-0 translate-y-[22px] scale-95; }
.news-list-move { @apply transition-transform duration-[450ms] ease-[cubic-bezier(.2,.65,.35,1)]; }

/* ซ่อน marker ของ summary (เฉพาะ webkit) */
details summary::-webkit-details-marker { display: none; }

/* สีตอน details เปิดอยู่ */
details[open] > summary { @apply text-[#a65a45]; }
</style>
