<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  rows?: number
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
}>(), {
  rows: 4,
  placeholder: '',
  disabled: false,
  required: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'blur'): void
}>()

const hasError = computed(() => !!props.error)
</script>

<template>
  <div
    class="group rounded-2xl bg-white/95 p-3 ring-1 ring-neutral-200/80 border border-neutral-100/60 shadow-sm focus-within:ring-[#892020]/30 focus-within:shadow-md transition"
    :class="[{ 'ring-red-300 border-red-200': hasError }]"
  >
    <div class="relative">
      <textarea
        :rows="rows"
        :placeholder="placeholder || ' '"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        class="peer w-full px-5 pt-6 pb-2 rounded-xl bg-transparent border border-transparent focus:outline-none placeholder:text-neutral-400 disabled:opacity-50"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @blur="emit('blur')"
      />
      <label
        class="pointer-events-none absolute left-4 top-2 px-1 text-xs font-semibold bg-white/95 rounded-full
               text-[#892020]
               peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-gray-500 peer-placeholder-shown:bg-transparent
               peer-focus:top-2 peer-focus:text-[#892020]"
      >
        {{ label }}
      </label>
    </div>
    <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
  </div>
</template>
