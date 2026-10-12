<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from './SelectBadge.vue'
import { useNewsStore } from '@/stores/news'
import { formatDateTime } from '@/utils/time'
import type { NewsItem } from '../type'

const props = defineProps<{ item: NewsItem }>()
const store = useNewsStore()
const status = computed(() => store.statusOf(props.item.id))

const imageSrc = computed(() => {
  const raw = props.item.imageUrl
  if (!raw || typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  return trimmed
})
const hasImage = computed(() => imageSrc.value.length > 0)
</script>

<template>
  <RouterLink :to="{ name: 'news-detail', params: { id: props.item.id } }" class="group block h-full overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white hover:shadow-md transition-all duration-200
           flex flex-col">
    <!-- news img -->
    <div class="relative h-48 md:h-56 shrink-0">
      <img v-if="hasImage" :src="imageSrc" :alt="props.item.title" loading="lazy" decoding="async"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
      <div
        v-if="hasImage"
        class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
      ></div>
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f7e7e7] via-white to-[#fbeeed]"
      >
        <span class="text-xs font-semibold uppercase tracking-[0.28em] text-[#9d5c5c]/80">
          No Cover Image
        </span>
      </div>

      <!-- status -->
      <div class="absolute left-3 top-3">
        <StatusBadge :status="status" />
      </div>

    </div>

    <!-- news content -->
    <div class="flex flex-1 flex-col p-4">
      <h3 class="line-clamp-2 text-lg font-semibold leading-snug text-gray-900 group-hover:text-[#892020]">
        {{ props.item.title }}
      </h3>
      <p class="mt-2 line-clamp-2 text-sm text-gray-600">
        {{ props.item.summary }}
      </p>


      <div class="mt-auto pt-3 flex items-center justify-between text-xs text-gray-500">
        <span
          class="inline-flex items-center rounded-full bg-[#f7eaea] text-[#892020] px-2.5 py-0.5 ring-1 ring-[#892020]/20">
          {{ props.item.reporter }}
        </span>
        <time :datetime="props.item.reportedAt">
          {{ formatDateTime(props.item.reportedAt) }}
        </time>
      </div>
    </div>
  </RouterLink>
</template>
