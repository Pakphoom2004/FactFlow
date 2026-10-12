<script setup lang="ts">
import { computed } from 'vue'
import NProgress from 'nprogress'

type FilterKey = 'ALL' | 'FAKE' | 'NOT_FAKE'

const model = defineModel<FilterKey>({ default: 'ALL' })

const filters = [
  { key: 'ALL', label: 'All' },
  { key: 'FAKE', label: 'Fake' },
  { key: 'NOT_FAKE', label: 'Not Fake' },
] as const

const activeIndex = computed(() =>
  filters.findIndex(f => f.key === model.value)
)

function selectFilter(key: FilterKey) {
  if (model.value === key) return
  NProgress.start()
  model.value = key
  requestAnimationFrame(() => setTimeout(() => NProgress.done(), 220))
}
</script>

<template>
  <div
    role="tablist"
    aria-label="Fact filters"
    class="relative inline-flex w-[340px] select-none items-center rounded-full
           bg-white/70 backdrop-blur-md ring-1 ring-[#892020]/20
           shadow-[inset_0_1px_1px_rgba(255,255,255,.8)]
           p-1"
  >
    <span
      aria-hidden="true"
      class="absolute top-1 bottom-1 left-1 rounded-full
             transition-transform duration-300 ease-[cubic-bezier(.2,.8,.3,1)]
             bg-gradient-to-b from-[#943030] to-[#6f1717]
             ring-1 ring-black/10
             shadow-[inset_0_1px_0_rgba(255,255,255,.45)]"
      :style="{
        width: `calc((100% - 8px) / ${filters.length})`,
        transform: `translateX(${activeIndex * 100}%)`
      }"
    ></span>

    <button
      v-for="f in filters"
      :key="f.key"
      role="tab"
      :aria-selected="model === f.key"
      class="relative z-10 flex-1 h-9 text-[13.5px] font-semibold rounded-full
             transition-colors duration-200
             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#892020]/40"
      :class="model === f.key ? 'text-white' : 'text-[#7a2e2e] hover:text-[#5e2020]'"
      @click="selectFilter(f.key)"
    >
      {{ f.label }}
    </button>
  </div>
</template>
