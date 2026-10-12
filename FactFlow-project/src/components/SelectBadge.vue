<script setup lang="ts">
import type { Status } from '@/type'
const props = defineProps<{ status: Status }>()
</script>

<template>
  <span v-if="props.status === 'FAKE'"
    class="inline-flex items-center rounded-full bg-rose-600/90 text-white px-2.5 py-1 text-xs font-semibold shadow">
    <svg class="mr-1 h-3 w-3" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 2L1 21h22L12 2m0 4.84L19.53 19H4.47L12 6.84z" />
    </svg>
    Fake
  </span>
  <span v-else-if="props.status === 'NOT_FAKE'"
    class="inline-flex items-center rounded-full bg-emerald-600/90 text-white px-2.5 py-1 text-xs font-semibold shadow">
    <svg class="mr-1 h-3 w-3" viewBox="0 0 24 24">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
    Not Fake
  </span>
  <span v-else
    class="inline-flex items-center rounded-full bg-gray-600/80 text-white px-2.5 py-1 text-xs font-semibold shadow">
    <svg class="mr-1 h-3 w-3" viewBox="0 0 24 24">
      <path fill="currentColor" d="M10 17h4v-2h-4v2m-6 4h16V3H4v18z" />
    </svg>
    Undecided
  </span>
</template>
