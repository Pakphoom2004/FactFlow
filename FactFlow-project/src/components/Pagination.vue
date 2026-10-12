<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{ page: number; totalPages: number }>(),
  { page: 1, totalPages: 1 }
)
const emit = defineEmits<{ change: [page: number] }>()
const go = (p: number) => {
  emit('change', Math.min(Math.max(1, p), props.totalPages))
  // Scroll to top when changing page
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}
</script>

<template>
  <nav class="flex items-center justify-center gap-4">
    <!-- Prev -->
    <button class="inline-flex items-center gap-2 rounded-full px-4 py-2
             bg-[#892020] text-white font-medium shadow-sm
             transition-transform transition-shadow duration-150
             hover:scale-105 hover:shadow-lg active:scale-95
             focus:outline-none focus:ring-2 focus:ring-[#892020]/40
             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
      :disabled="props.page <= 1" @click="go(props.page - 1)" aria-label="Previous page" title="Previous">
      <!-- icon ‹ -->
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd"
          d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z"
          clip-rule="evenodd" />
      </svg>
      Prev
    </button>

    <!-- Page indicator -->
    <span class="rounded-full bg-white ring-1 ring-gray-200 px-4 py-2 text-sm text-gray-700">
      Page <strong>{{ props.page }}</strong> of {{ props.totalPages }}
    </span>

    <!-- Next -->
    <button class="inline-flex items-center gap-2 rounded-full px-4 py-2
             bg-[#892020] text-white font-medium shadow-sm
             transition-transform transition-shadow duration-150
             hover:scale-105 hover:shadow-lg active:scale-95
             focus:outline-none focus:ring-2 focus:ring-[#892020]/40
             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
      :disabled="props.page >= props.totalPages" @click="go(props.page + 1)" aria-label="Next page" title="Next">
      Next
      <!-- icon › -->
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd"
          d="M7.22 4.47a.75.75 0 011.06 0l5 5a.75.75 0 010 1.06l-5 5a.75.75 0 11-1.06-1.06L11.69 10 7.22 5.53a.75.75 0 010-1.06z"
          clip-rule="evenodd" />
      </svg>
    </button>
  </nav>
  <div></div>
</template>
