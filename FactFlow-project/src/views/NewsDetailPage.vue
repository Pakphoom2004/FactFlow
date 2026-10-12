<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNewsStore } from '@/stores/news'
import StatusBadge from '@/components/SelectBadge.vue'
import { formatDateTime } from '@/utils/time'
import VotePage from '@/views/VotePage.vue'
import CommentsPanel from '@/components/CommentsList.vue'
import bgImage from '@/assets/FACTFLOW-4.png'
import { useAuthStore } from '@/stores/auth'
import { useAdminRequestStore } from '@/stores/adminRequest'


const route = useRoute()
const router = useRouter()
const store = useNewsStore()
const authStore = useAuthStore()
const adminRequestStore = useAdminRequestStore()
store.load()

const isLoggedIn = computed(() => !!authStore.user)
const latestAdminRequest = computed(() => {
  const user = authStore.user
  if (!user) return null
  const identifier = user.id ?? (user as any).username ?? user.email
  if (identifier === null || identifier === undefined) return null
  return adminRequestStore.latestRequestByUser(String(identifier))
})
const isAdmin = computed(() => {
  const user = authStore.user
  if (!user) return false
  const primaryRole = typeof user.role === 'string' ? user.role.toUpperCase() : ''
  if (primaryRole === 'ROLE_ADMIN') return true
  if (Array.isArray(user.roles)) {
    const hasRole = user.roles.some((role: string) => role?.toUpperCase?.() === 'ROLE_ADMIN')
    if (hasRole) return true
  }
  return latestAdminRequest.value?.status === 'approved'
})

const item = computed(() => store.byId(String(route.params.id)))
const status = computed(() => (item.value ? store.statusOf(item.value.id) : 'UNDECIDED'))
const votes = computed(() => (item.value ? store.combinedVotes(item.value.id) : { fake: 0, real: 0 }))
const isHiddenForPublic = computed(() => {
  const current = item.value
  if (!current) return false
  return store.isNewsHidden(current.id)
})
const blockedFromView = computed(() => isHiddenForPublic.value && !isAdmin.value)

const showVotePage = ref(false)
function openModal() {
  if (blockedFromView.value) return
  if (!isLoggedIn.value) {
    alert('Please log in to vote.')
    router.push({ name: 'login' })
    return
  }
  showVotePage.value = true
  document.documentElement.classList.add('overflow-hidden')
}
function closeModal() {
  showVotePage.value = false
  document.documentElement.classList.remove('overflow-hidden')
}

const perPage = ref(10)
const perOptions = [5, 10, 20, 30]

// ===== pagination state required by CommentsPanel =====
const currentPage = ref(1)
const totalPages = computed(() =>
  Math.max(1, Math.ceil((mergedEntries.value.length || 0) / perPage.value)),
)
const canPrev = computed(() => currentPage.value > 1)
const canNext = computed(() => currentPage.value < totalPages.value)

// pending buffer per news id (for optimistic comment display)
const pendingByNews = ref<Record<string, any[]>>({})

const entries = computed<any[]>(() => {
  const id = item.value?.id
  if (!id) return []
  return store.combinedComments(id) ?? []
})

/** unique key for a comment */
const TWO_MIN = 2 * 60 * 1000
function normalizeVote(input: any): 'FAKE' | 'REAL' | '' {
  if (typeof input === 'boolean') return input ? 'FAKE' : 'REAL'
  const normalized = String(input ?? '')
    .trim()
    .toUpperCase()
  if (['FAKE', 'FALSE', 'FRAUD'].includes(normalized)) return 'FAKE'
  if (['REAL', 'NOT_FAKE', 'TRUE', 'VERIFIED', 'TRUSTED'].includes(normalized)) return 'REAL'
  return ''
}
function entryKey(c: any) {
  const a = (c.author || '').trim().replace(/\s+/g, ' ').toLowerCase()
  const t = (c.text || '').trim().replace(/\s+/g, ' ')
  const ms = Date.parse(c.createdAt || c.commentedAt || '')
  const bucket = Number.isFinite(ms) ? Math.floor(ms / TWO_MIN) : 0
  const vote = normalizeVote(c.voteType ?? c.isFake)
  return `${a}|${vote}|${t}|${bucket}`
}

/** merge existing+pending; tag _mine on existing if matches pending */
const mergedEntries = computed<any[]>(() => {
  const id = item.value?.id
  if (!id) return []

  const pending = pendingByNews.value[id] || []
  const existing = entries.value

  const existingKeys = new Set(existing.map(entryKey))
  const filteredPending = pending.filter(p => !existingKeys.has(entryKey(p)))

  const mineKeys = new Set(pending.filter(p => p._mine).map(entryKey))
  const existingWithMine = existing.map(e => (mineKeys.has(entryKey(e)) ? { ...e, _mine: true } : e))

  return [...filteredPending, ...existingWithMine]
})

/** clear pending if store has loaded same items */
watch(entries, (now) => {
  const id = item.value?.id
  if (!id) return
  const nowKeys = new Set(now.map(entryKey))
  pendingByNews.value[id] = (pendingByNews.value[id] || []).filter(p => !nowKeys.has(entryKey(p)))
})

// ===== paged slice (uses currentPage + perPage) =====
const paged = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return mergedEntries.value.slice(start, start + perPage.value)
})

function initials(name?: string) {
  const n = (name || 'Anonymous').trim()
  const p = n.split(/\s+/).filter(Boolean)
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

// === handlers expected by CommentsPanel ===
function onSetPer(v: number) {
  perPage.value = v
  currentPage.value = 1
}
function onPrev() {
  if (canPrev.value) currentPage.value--
}
function onNext() {
  if (canNext.value) currentPage.value++
}
function onGo(page: number) {
  const p = Math.min(Math.max(1, Math.trunc(page || 1)), totalPages.value)
  currentPage.value = p
}

function handleSubmitted() {
  const id = item.value?.id
  if (!id) return
  store.load()
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'

function onHeroError(e: Event) {
  const el = e.target as HTMLImageElement
  if (el && el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG
}
</script>

<template>
  <div class="relative min-h-screen">
    <!-- background -->
    <div
      aria-hidden="true"
      class="fixed inset-0 -z-10 bg-cover bg-center"
      :style="{ backgroundImage: `url(${bgImage})` }"
    ></div>

    <div v-if="item && !blockedFromView" class="space-y-6">
      <!-- Header -->
      <header class="bg-white/95 backdrop-blur rounded-2xl p-4 sm:p-6 ring-1 ring-[#892020]/20 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <button
            @click="router.push({ name: 'home' })"
            class="order-1 shrink-0 rounded-full px-3 py-1.5 text-sm bg-[#892020] text-white hover:bg-[#a83232] shadow-sm"
          >
            ← Back
          </button>

          <h1
            class="order-3 sm:order-2 basis-full sm:basis-auto min-w-0
                   font-semibold text-slate-900 leading-snug break-words
                   text-[clamp(1.125rem,2.5vw,1.875rem)]"
          >
            {{ item.title }}
          </h1>

          <div class="order-2 sm:order-3 ml-auto shrink-0">
            <StatusBadge :status="status" />
          </div>
        </div>

        <div class="mt-2 text-xs sm:text-sm flex flex-wrap items-center gap-2 sm:gap-3 text-gray-700">
          <span class="flex items-baseline">
            <span class="text-gray-500">Reporter</span>
            <span class="mx-1 text-gray-400">:</span>
            <b class="text-[#892020] font-semibold">{{ item.reporter }}</b>
          </span>
          <span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
          <time :datetime="item.reportedAt" class="text-gray-500">{{ formatDateTime(item.reportedAt) }}</time>
        </div>
      </header>

      <figure v-if="item.imageUrl" class="overflow-hidden rounded-2xl ring-1 ring-[#892020]/15 bg-white shadow-sm">
        <img
          :src="item.imageUrl"
          alt="event image"
          @error="onHeroError"
          loading="eager"
          decoding="async"
          class="w-full max-h-[520px] object-cover"
        />
      </figure>

      <article class="prose max-w-none bg-white/95 backdrop-blur rounded-2xl p-4 sm:p-6 ring-1 ring-[#892020]/20 shadow-sm">
        <p class="text-gray-800 whitespace-pre-line text-[15px] sm:text-base md:text-lg leading-relaxed">
          {{ item.body }}
        </p>
      </article>

      <section
        class="rounded-2xl bg-white/95 backdrop-blur p-4 sm:p-6 ring-1 ring-[#892020]/20 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div class="text-sm flex items-center gap-3">
          <span class="text-gray-500">Votes</span>
          <span class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700">Fake</span>
            <span class="font-medium text-gray-800">{{ votes.fake }}</span>
          </span>
          <span class="w-1.5 h-1.5 rounded-full bg-gray-300 hidden sm:inline-block"></span>
          <span class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#E6F0EB] text-[#3D7A5E]">Not Fake</span>
            <span class="font-medium text-gray-800">{{ votes.real }}</span>
          </span>
        </div>

        <div class="w-full sm:w-auto">
          <button
            @click="openModal"
            class="w-full sm:w-auto rounded-full px-4 py-2 text-sm bg-[#892020] text-white hover:bg-[#a83232] text-center"
          >
            Vote on this News
          </button>
        </div>
      </section>

      <!-- Comments -->
      <CommentsPanel
        :mergedEntries="mergedEntries"
        :perPage="perPage"
        :perOptions="perOptions"
        :paged="paged"
        :currentPage="currentPage"
        :totalPages="totalPages"
        :canPrev="canPrev"
        :canNext="canNext"
        :initials="initials"
        :formatDateTime="formatDateTime"
        @setPer="onSetPer"
        @prev="onPrev"
        @next="onNext"
        @go="onGo"
      />

      <!-- Vote modal -->
      <VotePage
        v-if="showVotePage && item"
        :show="showVotePage"
        :newsId="item.id"
        @close="closeModal"
        @submitted="handleSubmitted"
      />
    </div>

    <div
      v-else-if="blockedFromView"
      class="rounded-2xl bg-white/95 backdrop-blur p-8 text-center text-gray-600 ring-1 ring-[#892020]/15 shadow-sm"
    >
      This news article is no longer available to the public.
    </div>

    <p v-else class="text-gray-600">News not found.</p>
  </div>
</template>
