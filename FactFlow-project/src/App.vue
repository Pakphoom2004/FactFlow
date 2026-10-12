<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import HeaderBar from '@/components/HeadBar.vue'

const route = useRoute()
const hideChrome = computed(() => route.meta.hideChrome === true)
const fullBleed = computed(() => route.meta.fullBleed === true)
</script>

<template>
  <div>
    <!-- ซ่อน HeaderBar ถ้า meta.hideChrome เป็น true -->
    <HeaderBar v-if="!hideChrome" />

    <main
      :class="[
        fullBleed ? 'w-full' : 'mx-auto max-w-6xl',
        fullBleed ? '' : 'p-4 sm:p-6',
      ]"
    >
      <RouterView v-slot="{ Component }">
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-2"
        >
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>
