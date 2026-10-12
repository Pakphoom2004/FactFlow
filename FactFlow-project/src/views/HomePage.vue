<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useNewsStore } from '@/stores/news'
import NewsCard from '@/components/NewsCard.vue'
import FilterBar from '@/components/FilterBar.vue'
import PerPageSelect from '@/components/PerPageSelect.vue'
import Pagination from '@/components/Pagination.vue'
import StatusBadge from '@/components/SelectBadge.vue'
import { formatDateTime } from '@/utils/time'
import bgImage from '@/assets/FACTFLOW-4.png'

const store = useNewsStore()
store.load()

const route = useRoute()
const router = useRouter()

const filter = ref<'ALL' | 'FAKE' | 'NOT_FAKE'>('ALL')

function coerceInt(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

const perPage = ref(coerceInt(route.query.size ?? (route.query as any).perPage, 10))
const page = ref(coerceInt(route.query.page, 1))

const searchText = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')

const searchQuery = computed(() => (route.query.q ? String(route.query.q).trim() : ''))

watch(
  () => route.query.q,
  (value) => {
    searchText.value = typeof value === 'string' ? value : ''
  },
  { immediate: true }
)

watch(
  searchQuery,
  (value) => {
    store.searchByQuery(value).catch((error: unknown) => {
      console.warn('Search request failed:', error)
    })
    page.value = 1
  },
  { immediate: true }
)

const filtered = computed(() => {
  const baseList = searchQuery.value ? store.searchResults : store.visibleNews
  return baseList.filter(n => {
    if (store.isNewsHidden(n.id)) return false
    const s = store.statusOf(n.id)
    const statusOK = filter.value === 'ALL' ? true : filter.value === 'FAKE' ? s === 'FAKE' : s === 'NOT_FAKE'
    if (!statusOK) return false
    return true
  })
})

const FEATURED_POOL_SIZE = 5
const featuredPool = computed(() => filtered.value.slice(0, FEATURED_POOL_SIZE))

const featuredIndex = ref(0)
const ROT_MS = 10000
let rotId: number | undefined
const pauseOnHover = ref(false)



function nextFeatured(step = 1) {
  const len = featuredPool.value.length
  if (!len) return
  featuredIndex.value = (featuredIndex.value + step + len) % len
}
function restartRotate() {
  if (rotId) window.clearInterval(rotId)
  featuredIndex.value = 0
  rotId = window.setInterval(() => {
    if (!pauseOnHover.value) nextFeatured(1)
  }, ROT_MS)
}
watch([featuredPool, filter], restartRotate, { immediate: true })

const sliderEl = ref<HTMLElement | null>(null)
const containerW = ref(0)
let ro: ResizeObserver | null = null

onMounted(() => {
  restartRotate()
  const el = sliderEl.value
  if (!el) return
  const update = () => { containerW.value = el.clientWidth }
  update()
  ro = new ResizeObserver(update)
  ro.observe(el)
})

onMounted(() => {
  const q = route.query
  if (!q.page || !q.size) {
    router.replace({
      query: {
        ...q,
        page: String(page.value),
        size: String(perPage.value),
      },
    })
  }
})
watch([page, perPage], () => {
  router.replace({
    query: {
      ...route.query,
      page: String(page.value),
      size: String(perPage.value),
    },
  })
})

onUnmounted(() => {
  if (rotId) window.clearInterval(rotId)
  if (ro && sliderEl.value) ro.unobserve(sliderEl.value)
})


const rest = computed(() => filtered.value.slice(1))
watch([filter, perPage], () => { page.value = 1 })
const totalPages = computed(() => Math.max(1, Math.ceil(rest.value.length / perPage.value)))
const slice = computed(() => rest.value.slice((page.value - 1) * perPage.value, page.value * perPage.value))

const resultCount = computed(() => filtered.value.length)
const prettyQuery = computed(() => searchQuery.value)
const isSearching = computed(() => prettyQuery.value.length > 0)
const isLoadingSearch = computed(() => store.searchLoading)

const mostDebated = computed(() => {
  return filtered.value
    .map(n => {
      const v = store.combinedVotes(n.id)
      const total = v.fake + v.real
      const diff = Math.abs(v.fake - v.real)
      return { item: n, fake: v.fake, real: v.real, total, diff }
    })
    .filter(x => x.total >= 2)
    .sort((a, b) => a.diff - b.diff || b.total - a.total)
    .slice(0, 5)
})

function readMinutes(n: any) {
  const words = `${n?.body ?? n?.summary ?? n?.title ?? ''}`.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

function updateSearch(value: string) {
  const typed = value.trim()
  const nextQuery: Record<string, any> = { ...route.query, page: String(1), size: String(perPage.value) }
  if (typed) {
    nextQuery.q = typed
  } else {
    delete nextQuery.q
  }
  router.replace({ query: nextQuery })
}

function clearSearch() {
  searchText.value = ''
  updateSearch('')
}
</script>

<template>
  <div class="relative min-h-screen">
    <div aria-hidden="true" class="fixed inset-0 -z-10 bg-cover bg-center"
      :style="{ backgroundImage: `url(${bgImage})` }"></div>

    <section class="space-y-6">
      <header class="py-2">
        <div class="w-full flex items-center justify-center gap-4 flex-wrap">
          <div class="scale-[0.98] sm:scale-100">
            <FilterBar v-model="filter" />
          </div>
          <div class="mt-[-2px]">
            <PerPageSelect v-model="perPage" />
          </div>
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-4 px-1">
        <div
          class="flex w-full items-center gap-4 rounded-full border border-[#892020]/25 bg-white/95 px-6 py-3 shadow-[0_18px_48px_-28px_rgba(137,32,32,0.45)] transition-all duration-300 ease-out focus-within:border-[#892020]/55 focus-within:shadow-[0_24px_58px_-28px_rgba(137,32,32,0.55)]">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-[#892020]/20 bg-white/80 px-4 py-1.5 text-sm font-semibold text-[#6f1f1f] transition-all duration-300">
            <span class="h-2 w-2 rounded-full bg-[#892020]/65 shadow-[0_0_12px_rgba(137,32,32,0.4)] transition-transform duration-300"></span>
            {{ resultCount }} result{{ resultCount === 1 ? '' : 's' }}
          </span>
          <div
            class="group relative flex-1 flex items-center gap-3 rounded-full border border-[#892020]/15 bg-white px-4 py-2 text-sm text-[#3b1414] transition-all duration-300 focus-within:border-[#892020]/55 focus-within:shadow-[0_0_0_4px_rgba(137,32,32,0.15)]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              class="h-5 w-5 text-[#a75858] transition-transform duration-300 group-focus-within:scale-110 group-focus-within:text-[#892020]" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input v-model="searchText" type="text" placeholder="Search by title or reporter"
              class="flex-1 bg-transparent outline-none text-[#892020] placeholder:text-[#a55b5b]/65 font-medium tracking-wide transition-colors duration-300"
              @input="updateSearch(searchText)" />
            <svg v-if="isSearching && isLoadingSearch" class="h-4 w-4 animate-spin text-[#892020]" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <button v-if="isSearching" type="button"
              class="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-[#892020]/25 bg-white/85 px-3 py-1 text-xs font-medium text-[#892020] transition-all duration-200 hover:border-[#892020]/60 hover:bg-white active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#892020]/50"
              @click="clearSearch">
              <span>Clear</span>
              <span
                class="pointer-events-none absolute inset-0 rounded-full border-2 border-transparent transition-all duration-200 group-hover:border-[#892020]/60 group-focus-visible:border-[#892020]">
              </span>
            </button>
            <span class="pointer-events-none absolute inset-0 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-[#892020]/12 to-transparent"></span>
          </div>
        </div>
      </div>

      <div v-if="featuredPool.length" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div ref="sliderEl"
          class="relative overflow-hidden rounded-[28px] ring-1 ring-gray-200 bg-white lg:col-span-2 group hover:shadow-xl transition-all duration-300 h-72 md:h-[24rem] [contain:paint]"
          @mouseenter="pauseOnHover = true" @mouseleave="pauseOnHover = false">
          <div
            class="absolute top-3 left-1/2 -translate-x-1/2 z-[2] flex items-center gap-2 rounded-full bg-black/35 backdrop-blur px-2 py-1 ring-1 ring-white/20">
            <button class="h-6 w-6 grid place-items-center rounded-full text-white/90 hover:bg-white/20 active:scale-95"
              @click="nextFeatured(-1)" aria-label="Previous slide">‹</button>
            <div class="flex items-center gap-1.5">
              <button v-for="(_, i) in featuredPool" :key="i" class="h-1.5 rounded-full transition-all"
                :class="i === featuredIndex ? 'w-5 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'"
                @click="featuredIndex = i" aria-label="Go to slide" />
            </div>
            <button class="h-6 w-6 grid place-items-center rounded-full text-white/90 hover:bg-white/20 active:scale-95"
              @click="nextFeatured(1)" aria-label="Next slide">›</button>
          </div>

          <div
            class="absolute inset-0 flex h-full transition-transform duration-700 ease-out transform-gpu [will-change:transform]"
            :style="{ transform: `translate3d(-${featuredIndex * containerW}px,0,0)` }">
            <div v-for="n in featuredPool" :key="n.id" class="relative h-full flex-none basis-full transform-gpu">
              <img :src="n.imageUrl" :alt="n.title" class="absolute inset-0 h-full w-full object-cover transform-gpu" />
              <div
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
              </div>

              <div class="absolute top-4 left-4 z-[1]">
                <StatusBadge :status="store.statusOf(n.id)" />
              </div>

              <div class="absolute bottom-4 left-4 right-4 z-[1] pointer-events-none">
                <div class="w-full rounded-2xl bg-black/25 backdrop-blur-sm ring-1 ring-white/20 p-3 sm:p-4">
                  <p class="text-[11px] uppercase tracking-wider text-white/80 font-semibold flex items-center gap-2">
                    Featured
                    <span class="hidden sm:inline-block h-1 w-1 rounded-full bg-white/60"></span>
                    <span class="hidden sm:inline text-white/75">{{ formatDateTime(n.reportedAt) }}</span>
                  </p>

                  <h2 class="mt-1 text-white text-2xl md:text-[2rem] font-extrabold leading-tight drop-shadow-sm">
                    {{ n.title }}
                  </h2>

                  <p class="mt-1 text-white/90 line-clamp-2">{{ n.summary }}</p>

                  <div class="mt-3 flex items-center justify-between gap-3">
                    <span
                      class="inline-flex items-center rounded-full bg-white/15 text-white px-3 py-1 text-xs ring-1 ring-white/20">
                      by {{ n.reporter }}
                    </span>

                    <div class="flex items-center gap-2 flex-wrap justify-end">
                      <span
                        class="inline-flex items-center gap-1.5 rounded-full bg-white/15 text-white px-2.5 py-1 text-xs ring-1 ring-white/20">
                        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                        {{ readMinutes(n) }} min read
                      </span>

                      <RouterLink :to="{ name: 'news-detail', params: { id: n.id } }"
                        class="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-[#892020] text-white text-xs px-3 py-1 ring-1 ring-white/20 hover:brightness-110 active:scale-95 transition"
                        aria-label="Read analysis">
                        Read analysis
                        <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                          <path fill-rule="evenodd"
                            d="M12.293 4.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 11-1.414-1.414L14.586 10H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                      </RouterLink>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside class="relative overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white/95 backdrop-blur p-4">
          <div class="-mx-4 -mt-4 mb-3 rounded-t-2xl bg-[#892020] px-4 py-2">
            <h3 class="text-white font-semibold">Most debated</h3>
          </div>
          <ul class="space-y-4">
            <li v-for="x in mostDebated" :key="x.item.id" class="space-y-1.5">
              <div class="flex items-start gap-3">
                <span class="mt-1 h-2 w-2 rounded-full"
                  :class="x.fake === x.real ? 'bg-amber-500' : (x.fake > x.real ? 'bg-[#892020]' : 'bg-emerald-600')"></span>
                <RouterLink :to="{ name: 'news-detail', params: { id: x.item.id } }"
                  :class="['line-clamp-2 text-sm leading-snug', x.fake > x.real ? 'text-[#892020] font-medium' : 'text-gray-900 hover:text-[#892020]']">
                  {{ x.item.title }}
                </RouterLink>
              </div>
              <div class="pl-5">
                <div class="h-2 rounded-full ring-1 ring-[#892020]/25 bg-white overflow-hidden flex">
                  <div class="h-full bg-[#892020]" :style="{ width: (x.total ? (x.fake / x.total) * 100 : 0) + '%' }">
                  </div>
                  <div class="h-full bg-emerald-600" :style="{ width: (x.total ? (x.real / x.total) * 100 : 0) + '%' }">
                  </div>
                </div>
                <div class="mt-1 text-[11px] text-gray-500">
                  Votes:
                  <span class="font-medium text-[#892020]">{{ x.fake }}</span>
                  –
                  <span class="font-medium text-emerald-600">{{ x.real }}</span>
                  <span class="ml-1 text-gray-400">({{ x.total }})</span>
                </div>
              </div>
            </li>
          </ul>
        </aside>
      </div>

      <TransitionGroup tag="div" enter-active-class="transition-all duration-200 ease-in-out"
        leave-active-class="transition-all duration-200 ease-in-out" enter-from-class="opacity-0 translate-y-1.5"
        leave-to-class="opacity-0 -translate-y-1.5"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <NewsCard v-for="n in slice" :key="n.id" :item="n" />
      </TransitionGroup>


      <div v-if="resultCount === 0"
        class="flex flex-col items-center justify-center text-center py-16 rounded-2xl ring-1 ring-gray-200 bg-white">
        <img src="../assets/search.png" alt="No data" class="h-10 w-10 opacity-70 mb-3" />
        <h3 class="text-lg font-semibold">No news to show</h3>
        <p v-if="isSearching" class="text-gray-600 text-sm mt-1">
          We couldn’t find results for
          <span class="font-medium text-[#892020]">“{{ prettyQuery }}”</span>. Try another keyword.
        </p>
        <p v-else class="text-gray-600 text-sm mt-1">New posts will appear here once available.</p>
      </div>

      <Pagination :page="page" :totalPages="totalPages" @change="(p: number) => (page = p)" />
    </section>
  </div>
</template>
