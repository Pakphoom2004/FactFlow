<script setup lang="ts">
import { ref, computed } from 'vue'

type Props = {
  preview: string | null
  uploading?: boolean
  error?: string
  hint?: string
  previewAspect?: string
  previewMaxHeight?: string
  previewContain?: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', file: File): void
  (e: 'clear'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const aspectRatio = computed(() => props.previewAspect || '16 / 9')
const maxHeight = computed(() => props.previewMaxHeight || '320px')
const objectFit = computed(() => (props.previewContain ? 'contain' : 'cover'))

function openPicker() {
  if (props.uploading) return
  inputRef.value?.click()
}

function handleFiles(files: FileList | null) {
  if (!files || !files[0] || props.uploading) return
  emit('select', files[0])
  // สำคัญ: รีเซ็ตค่า input เพื่อให้เลือกไฟล์เดิมซ้ำได้
  if (inputRef.value) inputRef.value.value = ''
}

function onChange(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function clearFile() {
  if (props.uploading) return
  emit('clear')
  // รีเซ็ต input จริง ๆ
  if (inputRef.value) inputRef.value.value = ''
}
</script>

<template>
  <div class="relative z-[5] select-none">
    <div
      class="relative rounded-2xl bg-white/80 backdrop-blur-xl p-5
             ring-1 ring-[#892020]/15 shadow-[0_12px_30px_-16px_rgba(0,0,0,.35)]
             transition"
      :class="[ error ? 'ring-[#892020]/40' : '' ]"
    >
      <!-- Upload surface -->
      <button
        type="button"
        :disabled="uploading"
        @click="openPicker"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop="onDrop"
        class="group w-full relative rounded-2xl transition
               border border-dashed px-5 py-5 text-left
               focus:outline-none
               hover:bg-white/70
               disabled:opacity-70 disabled:cursor-not-allowed"
        :class="[ isDragging ? 'border-[#892020]/50 bg-[#fff3f3]' : 'border-[#892020]/25' ]"
        aria-label="Upload cover image"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div
              class="h-12 w-12 rounded-2xl grid place-items-center
                     ring-1 ring-[#892020]/15 bg-[#892020]/10
                     transition group-hover:scale-105"
            >
              <svg class="h-5 w-5 text-[#892020]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <p class="text-base font-semibold text-[#2d1515]">
                {{ uploading ? 'Uploading…' : (isDragging ? 'Drop image to upload' : 'Choose file') }}
              </p>
              <p class="text-sm text-gray-600/95">
                {{ hint || 'JPG/PNG • 1280×720 (16:9) recommended • Drag & drop supported' }}
              </p>
            </div>
          </div>

          <span
            class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold
                   bg-[#892020] text-white shadow-sm transition
                   group-hover:shadow-[0_10px_20px_-10px_rgba(137,32,32,.6)]
                   active:scale-[.98]"
          >
            {{ uploading ? 'Uploading…' : 'Browse' }}
          </span>
        </div>

        <!-- Soft focus ring -->
        <span
          class="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-transparent
                 group-focus-visible:ring-[#892020]/40"
        />
      </button>

      <!-- Hidden input -->
      <input
        ref="inputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        @change="onChange"
      />

      <!-- Preview -->
      <div v-if="preview" class="mt-4">
        <div class="relative overflow-hidden rounded-2xl ring-1 ring-black/10">
          <div
            class="w-full bg-black/5"
            :style="{ aspectRatio: aspectRatio, maxHeight: maxHeight }"
          >
            <img
              :src="preview"
              alt="preview"
              class="w-full h-full"
              :style="{ objectFit: objectFit }"
            />
          </div>

          <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent"></div>

          <div class="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              class="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium
                     ring-1 ring-black/10 hover:bg-white transition active:scale-95"
              :disabled="uploading"
              @click="openPicker"
            >
              Change
            </button>
            <button
              type="button"
              class="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-semibold
                     ring-1 ring-black/10 hover:bg-white transition active:scale-95 text-[#892020]"
              :disabled="uploading"
              @click="clearFile"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="mt-3 text-sm font-medium text-[#892020]">
        {{ error }}
      </p>
    </div>
  </div>
</template>
