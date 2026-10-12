<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const model = defineModel<number>({ default: 10 })
const options = [5, 10, 20, 30]

const open = ref(false)
const btnRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

function toggle() { open.value = !open.value }
function close() { open.value = false }
function selectVal(n: number) { model.value = n; close() }

function onClickOutside(e: MouseEvent) {
  const t = e.target as Node
  if (!btnRef.value?.contains(t) && !menuRef.value?.contains(t)) close()
}
onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="relative inline-block">
    <button
      ref="btnRef"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
      class="inline-flex items-center gap-1.5 h-9 px-3 rounded-full
             bg-gradient-to-b from-[#892020] to-[#761717] text-white
             text-sm font-semibold ring-1 ring-white/20 backdrop-blur-sm
             shadow-[inset_0_1px_0_rgba(255,255,255,.45)]
             hover:brightness-[1.08] active:scale-[0.99] transition"
    >
      <span>{{ model }} / page</span>
      <svg class="h-3.5 w-3.5 transition-transform" :class="open ? 'rotate-180' : 'rotate-0'" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clip-rule="evenodd"/>
      </svg>
    </button>

    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-[.98]"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-[.98]"
    >
      <div
        v-show="open"
        ref="menuRef"
        role="menu"
        class="absolute left-0 mt-1.5 w-48 rounded-2xl p-2 z-10
               bg-white/90 backdrop-blur-xl ring-1 ring-black/10
               shadow-[inset_0_1px_0_rgba(255,255,255,.6)]
               space-y-1"
      >
        <button
          v-for="n in options"
          :key="n"
          role="menuitem"
          @click="selectVal(n)"
          class="group w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14px]
                 transition-colors
                 hover:bg-[#f7eaea] hover:text-[#6e1919]
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#892020]/20"
          :class="n === model
            ? 'bg-[#f7eaea] text-[#892020] font-semibold ring-1 ring-[#892020]/15'
            : 'text-[#3a2a2a]'"
        >
          <span>{{ n }} / page</span>
          <svg v-if="n === model" class="h-4 w-4 text-[#892020]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>

        <!-- เส้นแบ่งจาง ๆ ระหว่างบล็อค (ทางเลือก) -->
        <!-- <div class="h-px bg-[#892020]/10 mx-1"></div> -->
      </div>
    </transition>
  </div>
</template>
