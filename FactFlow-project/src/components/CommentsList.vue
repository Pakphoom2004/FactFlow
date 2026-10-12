<script setup lang="ts">
import { ref, computed } from 'vue'  // ⬅️ เพิ่ม computed

const props = defineProps<{
  mergedEntries: any[]
  perPage: number
  perOptions: number[]
  paged: any[]
  initials: (name?: string) => string
  formatDateTime: (date: string) => string

  currentPage: number
  totalPages: number
  canPrev: boolean
  canNext: boolean
}>()

const emits = defineEmits<{
  (e: 'setPer', value: number): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

const perOpen = ref(false)
function setPer(v: number) {
  emits('setPer', v)
  perOpen.value = false
}

/* ---------- ตัดซ้ำแบบทนต่อเวลาเคลื่อนเล็กน้อย + รักษา _mine ---------- */
const TWO_MIN = 2 * 60 * 1000
const norm = (s: any) => String(s ?? '').trim().replace(/\s+/g, ' ')
const normName = (s: any) => norm(s).toLowerCase()

const FAKE_BADGES = ['FAKE', 'FALSE', 'FRAUD']
const REAL_BADGES = ['REAL', 'NOT_FAKE', 'TRUE', 'VERIFIED', 'TRUSTED']

function voteState(entry: any): 'FAKE' | 'REAL' | null {
  if (!entry) return null
  if (typeof entry.isFake === 'boolean') {
    return entry.isFake ? 'FAKE' : 'REAL'
  }
  const raw = entry.voteType ?? entry.verdict ?? entry.status ?? entry.vote
  if (typeof raw === 'string') {
    const normalized = raw.trim().toUpperCase()
    if (FAKE_BADGES.includes(normalized)) return 'FAKE'
    if (REAL_BADGES.includes(normalized)) return 'REAL'
  }
  return null
}

function keyFor(e: any) {
  const a = normName(e.author)
  const t = norm(e.text)
  const ms = Date.parse(e.createdAt || '')
  const bucket = Number.isFinite(ms) ? Math.floor(ms / TWO_MIN) : 0
  const vote = voteState(e) || ''
  return `${a}|${vote}|${t}|${bucket}`
}

/** รายการที่จะโชว์จริง: ตัดอันที่ซ้ำออก และถ้ารายการไหนมีอันที่เป็น _mine ด้วย ให้คงอันนั้นไว้ */
const visible = computed(() => {
  const map = new Map<string, any>()
  for (const e of props.paged) {
    const k = keyFor(e)
    const exist = map.get(k)
    if (!exist) {
      map.set(k, { ...e })
    } else if (e._mine && !exist._mine) {
      // ถ้ามีของเรา (_mine) ให้ย้ายธงไปที่รายการที่คงไว้
      map.set(k, { ...exist, _mine: true })
    }
  }
  return Array.from(map.values())
})
</script>

<template>
  <section class="rounded-2xl bg-white/95 backdrop-blur ring-1 ring-[#892020]/15 shadow-sm p-4 sm:p-6 space-y-4">
    <!-- header + per/page dropdown (เดิม) -->
    <div class="flex items-center justify-between gap-3 pb-3 border-b border-[#892020]/10">
      <div class="flex items-center gap-2">
        <h2 class="text-lg sm:text-xl font-semibold font-sans text-[#892020]">Comments & Votes</h2>
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-[#892020]/10 text-[#892020] ring-1 ring-[#892020]/20">
          {{ mergedEntries.length }}
        </span>
      </div>

      <div class="relative">
        <button @click.stop="perOpen = !perOpen" :aria-expanded="perOpen"
          class="flex items-center justify-center gap-2 rounded-full bg-[#892020] text-white
                 px-4 py-2 text-xs sm:text-sm shadow-sm hover:bg-[#a83232]
                 ring-1 ring-[#892020]/40 transition w-28 sm:w-32 tabular-nums">
          {{ perPage }} / page
        </button>
        <div v-show="perOpen" class="absolute right-0 mt-2 w-40 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-10">
          <button v-for="v in perOptions" :key="v" @click.stop="setPer(v)"
            class="w-full text-left rounded-xl px-3 py-2 text-slate-800 hover:bg-slate-50"
            :class="perPage === v ? 'bg-[#fff1f1] text-[#892020] font-semibold' : ''">
            {{ v }} / page
          </button>
        </div>
      </div>
    </div>

    <!-- list -->
    <div v-if="visible.length" class="space-y-3">
      <article
        v-for="(e, i) in visible"
        :key="keyFor(e)"
        class="group relative rounded-2xl backdrop-blur ring-1 ring-[#892020]/10 hover:ring-[#892020]/20 shadow-sm hover:shadow-md transition p-4 sm:p-5"
        :class="i % 2 === 1 ? 'bg-rose-50/70' : 'bg-white/95'">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex items-center gap-3">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-full bg-[#892020]/10 ring-1 ring-[#892020]/20 text-[#892020] font-semibold text-sm overflow-hidden">
              <img v-if="e.avatarUrl" :src="e.avatarUrl" alt="avatar" class="h-full w-full object-cover" />
              <span v-else class="text-[11px]">{{ initials(e.author) }}</span>
            </span>
            <span
              class="inline-flex items-center rounded-full bg-[#892020] text-white px-4 py-1 text-xs sm:text-sm font-medium truncate max-w-[50vw]">
              {{ e.author || 'Anonymous' }}
            </span>
          </div>
          <div class="flex flex-col items-end shrink-0">
            <time class="text-xs text-slate-500 whitespace-nowrap">
              {{ e.createdAt ? formatDateTime(e.createdAt) : '' }}
            </time>
            <template v-if="e._mine">
              <span v-if="voteState(e) === 'FAKE'"
                class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                You voted: Fake
              </span>
              <span v-else-if="voteState(e) === 'REAL'"
                class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#E6F0EB] text-[#3D7A5E] ring-1 ring-[#3D7A5E]/20">
                You voted: Not Fake
              </span>
            </template>
            <template v-else>
              <span v-if="voteState(e) === 'FAKE'"
                class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200">Fake</span>
              <span v-else-if="voteState(e) === 'REAL'"
                class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#E6F0EB] text-[#3D7A5E] ring-1 ring-[#3D7A5E]/20">Not Fake</span>
            </template>
          </div>
        </div>

        <p class="mt-3 pl-3 md:pl-1.5 text-[15px] leading-relaxed text-slate-800 whitespace-pre-line">
          {{ e.text || '' }}
        </p>
      </article>
    </div>

    <div v-else class="rounded-2xl bg-white/90 ring-1 ring-[#892020]/10 p-8 text-center text-slate-500">
      No comments yet.
    </div>

    <!-- Pagination bar: Prev | Page X of Y | Next -->
    <div v-if="mergedEntries.length" class="flex items-center justify-between gap-3 pt-2">
      <button
        @click="$emit('prev')"
        :disabled="!canPrev"
        class="rounded-full px-5 py-2 text-sm font-semibold ring-1 ring-rose-300/70 text-rose-900/80 bg-rose-300/50
               hover:bg-rose-300/70 disabled:opacity-50 disabled:cursor-not-allowed">
        ‹ Prev
      </button>

      <div class="px-4 py-2 rounded-full ring-1 ring-slate-300 bg-white text-slate-700 text-sm tabular-nums">
        Page {{ currentPage }} of {{ totalPages }}
      </div>

      <button
        @click="$emit('next')"
        :disabled="!canNext"
        class="rounded-full px-5 py-2 text-sm font-semibold bg-[#892020] text-white
               hover:bg-[#a83232] disabled:opacity-50 disabled:cursor-not-allowed">
        Next ›
      </button>
    </div>
  </section>
</template>
