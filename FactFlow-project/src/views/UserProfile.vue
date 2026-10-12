<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminRequestStore } from '@/stores/adminRequest'
import { useProfileStore } from '@/stores/profile'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminRequestStore()
const profileStore = useProfileStore()

const user = computed(() => authStore.user)

const initials = computed(() => {
  if (!user.value) return '?'
  const first =
    user.value.firstname?.[0] ??
    user.value.firstName?.[0] ??
    user.value.first_name?.[0] ??
    user.value.username?.[0] ??
    ''
  const last =
    user.value.lastname?.[0] ??
    user.value.lastName?.[0] ??
    user.value.last_name?.[0] ??
    user.value.email?.[0] ??
    ''
  return `${first}${last}`.toUpperCase() || '?'
})

const displayName = computed(() => {
  if (!user.value) return ''
  const first =
    user.value.firstname ??
    user.value.firstName ??
    user.value.first_name ??
    ''
  const last =
    user.value.lastname ??
    user.value.lastName ??
    user.value.last_name ??
    ''
  const full = `${first} ${last}`.trim()
  return full || user.value.username || 'User'
})

const displayEmail = computed(() => {
  if (!user.value) return ''
  return user.value.email || `${user.value.username ?? ''}@factflow.local`
})

const userIdentifier = computed(() => {
  if (!user.value) return null
  return (
    user.value.id ??
    (user.value as any).username ??
    user.value.email ??
    null
  )
})

const profileKey = computed(() =>
  userIdentifier.value !== null && userIdentifier.value !== undefined
    ? String(userIdentifier.value)
    : null,
)

const avatarUrl = computed(() => {
  if (!profileKey.value) return null
  return profileStore.avatarById(profileKey.value)
})

const latestRequest = computed(() => {
  if (!userIdentifier.value) return null
  return adminStore.latestRequestByUser(userIdentifier.value)
})

const hasApprovedRequest = computed(() => latestRequest.value?.status === 'approved')

const hasRoleAdmin = computed(() => {
  const currentUser = user.value
  if (!currentUser) return false
  const roles = currentUser.roles ?? []
  return roles.some((role: string) => role?.toUpperCase?.().includes('ADMIN'))
})

const isAdmin = computed(() => hasRoleAdmin.value || !!hasApprovedRequest.value)
const canManageMembers = computed(() => hasRoleAdmin.value)

const canRequestAdminAccess = computed(() => {
  if (!user.value) return false
  if (isAdmin.value) return false
  if (!latestRequest.value) return true
  return latestRequest.value.status === 'rejected' || latestRequest.value.status === 'revoked'
})

const isPendingRequest = computed(() => latestRequest.value?.status === 'pending')

const pendingRequests = computed(() => adminStore.pendingRequests)
const approvedAdmins = computed(() => adminStore.approvedRequests)

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const avatarError = ref<string | null>(null)
const isAvatarUploading = ref(false)
const isSubmitting = ref(false)

onMounted(async () => {
  if (!user.value) return
  try {
    await adminStore.fetchRequests()
  } catch (error) {
    console.warn('Unable to fetch admin requests:', error)
  }
})

watch(
  profileKey,
  async (newKey) => {
    if (!newKey) return
    try {
      await profileStore.fetchAvatar(newKey)
    } catch (error) {
      console.warn('Unable to fetch avatar:', error)
    }
  },
  { immediate: true },
)

function formatDate(isoDate?: string) {
  if (!isoDate) return '—'
  try {
    return dateFormatter.format(new Date(isoDate))
  } catch {
    return isoDate as string
  }
}

function goToLogin() {
  router.push({ name: 'login' })
}

async function requestAdminAccess() {
  if (!canRequestAdminAccess.value) return
  isSubmitting.value = true
  try {
    await adminStore.submitRequest('ROLE_ADMIN')
    if (hasRoleAdmin.value) {
      await adminStore.fetchRequests()
      await authStore.fetchUserProfile()
    }
    await adminStore.fetchRequests()
  } catch (error) {
    console.error('Error submitting admin request:', error)
  } finally {
    isSubmitting.value = false
  }
}

async function handleRequestReview(requestId: string | number, status: 'approved' | 'rejected') {
  if (!canManageMembers.value) return
  const normalizedStatus = status.toUpperCase() as 'APPROVED' | 'REJECTED'
  try {
    await adminStore.updateRequestStatus(requestId, normalizedStatus)
    if (hasRoleAdmin.value) {
      await adminStore.fetchRequests()
      await authStore.fetchUserProfile()
    }
  } catch (error) {
    console.error('Failed to update admin request status:', error)
  }
}

function triggerAvatarPick() {
  if (!profileKey.value) return
  fileInputRef.value?.click()
}

async function handleAvatarChange(event: Event) {
  avatarError.value = null
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!profileKey.value) {
    input.value = ''
    return
  }
  if (!file.type.startsWith('image/')) {
    avatarError.value = 'Please select an image file.'
    input.value = ''
    return
  }
  const maxSize = 3 * 1024 * 1024 // 3MB
  if (file.size > maxSize) {
    avatarError.value = 'Image is too large (max 3MB).'
    input.value = ''
    return
  }
  try {
    isAvatarUploading.value = true
    const newAvatarUrl = await profileStore.uploadAvatar(profileKey.value, file)
    if (!newAvatarUrl) {
      avatarError.value = 'Upload completed, but no avatar URL was returned.'
    } else {
      await authStore.fetchUserProfile()
    }
  } catch (error) {
    console.error('Failed to upload avatar:', error)
    avatarError.value = 'Failed to upload image. Please try again.'
  } finally {
    isAvatarUploading.value = false
    input.value = ''
  }
}

</script>


<template>
  <!-- ⭐ พื้นหลังภาพแบบ Manage News -->
  <div class="relative min-h-screen overflow-hidden">
    <div aria-hidden="true" class="profile-background"></div>

    <!-- เนื้อหาเดิมของหน้าโปรไฟล์ -->
    <section class="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center space-y-3">
        <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.35em] text-[#a02a2a]/70">Profile</p>
      </div>

      <!-- Card -->
      <div
        class="mt-8 relative rounded-3xl border border-rose-100/70 bg-white/75 p-6 sm:p-8 shadow-[0_30px_80px_-28px_rgba(137,32,32,.35)] backdrop-blur-md">
        <template v-if="user">
          <div class="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <!-- Avatar + Change -->
            <div class="flex items-center gap-5">
              <div class="flex flex-col items-start gap-2 mt-6">
                <button
                  type="button"
                  :class="[
                    'relative group flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-[#892020] to-[#a54747] text-3xl font-semibold text-white shadow-lg overflow-hidden ring-4 ring-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#892020]',
                    isAvatarUploading ? 'pointer-events-none opacity-60' : '',
                  ]"
                  @click.prevent="triggerAvatarPick"
                  :aria-label="avatarUrl ? 'Change profile photo' : 'Upload profile photo'"
                >
                  <img v-if="avatarUrl" :src="avatarUrl" alt="Profile photo"
                       class="h-full w-full object-cover transition group-hover:opacity-40" />
                  <span v-else class="transition group-hover:opacity-40">{{ initials }}</span>

                  <!-- Hover: icon only -->
                  <div
                    class="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                    <svg xmlns="http://www.w3.org/2000/svg"
                         class="h-8 w-8"
                         fill="none"
                         viewBox="0 0 24 24"
                         stroke="currentColor"
                         stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L7.5 21H3v-4.5L16.732 3.732z" />
                    </svg>
                  </div>
                </button>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  :disabled="isAvatarUploading"
                  @change="handleAvatarChange"
                />
                <div class="flex items-center gap-3 text-xs text-[#4a1b1b]/70 min-h-[1.25rem]">
                  <span v-if="isAvatarUploading" class="text-[#3b1414]/60">Updating photo…</span>
                  <span v-if="avatarError" class="text-rose-600">{{ avatarError }}</span>
                </div>
              </div>

              <div>
                <p class="text-[11px] uppercase tracking-[0.35em] text-[#a02a2a]/70">Signed in as</p>
                <p class="text-2xl sm:text-3xl font-semibold text-[#3b1414]">{{ displayName }}</p>
                <p class="text-sm text-[#3b1414]/70 break-all">{{ displayEmail }}</p>
                <div class="mt-3 flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border"
                        :class="isAdmin ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-amber-300 text-amber-700 bg-amber-50'">
                    <span class="h-1.5 w-1.5 rounded-full"
                          :class="isAdmin ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                    {{ isAdmin ? 'Admin' : 'Standard User' }}
                  </span>
                </div>
              </div>
            </div>

            <button
              class="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-[#892020]/40 bg-white/85 px-4 py-1.5 text-sm font-semibold text-[#892020] shadow-[0_12px_30px_-18px_rgba(137,32,32,0.45)] backdrop-blur-md transition hover:border-[#892020] hover:bg-[#892020]/10"
              @click="router.push({ name: 'home' })"
              aria-label="Back to home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l-7 7 7 7" />
              </svg>
              Home
            </button>
          </div>

          <!-- Content Grid -->
          <div class="mt-10 grid gap-6 md:grid-cols-2">
            <!-- Account -->
            <div class="rounded-2xl border border-rose-100 bg-white/85 p-6">
              <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.25em] text-[#a02a2a]/80">Account Details</p>
              <div class="mt-4 space-y-4 text-[#3b1414]">
                <div>
                  <p class="text-[11px] text-[#3b1414]/50">Full Name</p>
                  <p class="text-lg font-semibold">{{ displayName }}</p>
                </div>
                <div>
                  <p class="text-[11px] text-[#3b1414]/50">Email</p>
                  <p class="text-lg font-semibold break-words">{{ displayEmail }}</p>
                </div>
              </div>
            </div>

            <!-- Admin area (conditional) -->
            <div v-if="!isAdmin" class="rounded-2xl border border-rose-100 bg-white/85 p-6 space-y-4">
              <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.25em] text-[#a02a2a]/80">Admin Access</p>

              <div v-if="!latestRequest" class="space-y-3 text-[#3b1414]">
                <p class="text-base font-semibold">Standard permissions</p>
                <p class="text-sm text-[#3b1414]/70">
                  You currently have user-level access. Request admin rights to help review and publish news.
                </p>
              </div>

              <div v-else class="space-y-3 text-[#3b1414]">
                <div class="flex items-center gap-3">
                  <span class="text-xs uppercase tracking-[0.3em] text-[#a02a2a]/70">Status</span>
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="{
                      'bg-amber-100 text-amber-700': latestRequest.status === 'pending',
                      'bg-emerald-100 text-emerald-700': latestRequest.status === 'approved',
                      'bg-rose-100 text-rose-700': latestRequest.status === 'rejected',
                      'bg-slate-200 text-slate-700': latestRequest.status === 'revoked',
                    }"
                  >
                    {{ latestRequest.status }}
                  </span>
                </div>
                <p class="text-sm text-[#3b1414]/70">
                  <template v-if="latestRequest.status === 'pending'">
                    Waiting for admin review since {{ formatDate(latestRequest.requestedAt) }}.
                  </template>
                  <template v-else-if="latestRequest.status === 'approved'">
                    Approved on {{ formatDate(latestRequest.reviewedAt) }}. Use the Manage News page to publish and moderate stories.
                  </template>
                  <template v-else-if="latestRequest.status === 'rejected'">
                    Rejected on {{ formatDate(latestRequest.reviewedAt) }}. You can send a new request if needed.
                  </template>
                  <template v-else>
                    Admin access for approved members is permanent.
                  </template>
                </p>
              </div>

              <button
                v-if="canRequestAdminAccess"
                class="w-full rounded-full bg-[#892020] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#a02a2a]"
                @click="requestAdminAccess"
              >
                {{ latestRequest?.status === 'rejected' ? 'Request Again' : 'Request Admin Access' }}
              </button>

              <div v-else-if="isPendingRequest" class="flex items-center gap-2 text-sm text-[#3b1414]/70">
                <span class="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                Pending approval
              </div>
              <div v-else-if="hasApprovedRequest" class="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                Admin status granted
              </div>
              <div v-else-if="latestRequest?.status === 'revoked'" class="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                Admin status locked in
              </div>
            </div>

            <!-- Admin Panel -->
            <div v-else-if="canManageMembers" class="rounded-2xl border border-rose-100 bg-white/85 p-6 space-y-4">
              <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.25em] text-[#a02a2a]/80">Admin Requests</p>
              <div v-if="!pendingRequests.length" class="text-sm text-[#3b1414]/70">
                No pending admin requests right now.
              </div>
              <ul v-else class="space-y-3">
                <li v-for="request in pendingRequests" :key="request.id"
                    class="rounded-2xl border border-[#892020]/10 bg-white p-4 shadow-sm">
                  <div class="flex flex-col gap-1 text-[#3b1414]">
                    <p class="text-base font-semibold">{{ request.name }}</p>
                    <p class="text-sm text-[#3b1414]/70">{{ request.email }}</p>
                    <p class="text-xs text-[#3b1414]/50">Requested {{ formatDate(request.requestedAt) }}</p>
                  </div>
                  <div class="mt-4 flex flex-wrap gap-3">
                    <button
                      class="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      @click="handleRequestReview(request.id, 'approved')"
                    >
                      Approve
                    </button>
                    <button
                      class="flex-1 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                      @click="handleRequestReview(request.id, 'rejected')"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              </ul>

              <div class="pt-4 border-t border-rose-100 space-y-3">
                <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.25em] text-[#a02a2a]/80">Current Admins</p>
                <div v-if="!approvedAdmins.length" class="text-sm text-[#3b1414]/60">
                  No additional admins granted yet.
                </div>
                <ul v-else class="space-y-3">
                  <li
                    v-for="admin in approvedAdmins"
                    :key="admin.id"
                    class="rounded-2xl border border-[#892020]/10 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <p class="text-base font-semibold text-[#3b1414]">{{ admin.name }}</p>
                      <p class="text-sm text-[#3b1414]/70">{{ admin.email }}</p>
                      <p class="text-xs text-[#3b1414]/50">Approved {{ formatDate(admin.reviewedAt) }}</p>
                    </div>
                    <span
                      class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Active admin
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div v-else class="rounded-2xl border border-rose-100 bg-white/85 p-6 space-y-3 text-[#3b1414]">
              <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.25em] text-[#a02a2a]/80">Admin Access</p>
              <p class="text-sm text-[#3b1414]/70">
                You have content administration privileges. Member approvals are limited to primary admin accounts.
              </p>
              <button
                class="rounded-full border border-[#892020]/30 px-5 py-2 text-sm font-semibold text-[#892020] hover:border-[#892020] hover:bg-[#892020]/5 transition"
                @click="router.push({ name: 'admin-news' })"
              >
                Open News Management
              </button>
            </div>
          </div>
        </template>

        <!-- Logged out state -->
        <template v-else>
          <div class="text-center space-y-4 py-14">
            <p class="text-2xl font-semibold text-[#3b1414]">You are not signed in</p>
            <p class="text-[#3b1414]/70">Sign in to see your profile information.</p>
            <button
              class="rounded-full bg-[#892020] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#a02a2a]"
              @click="goToLogin"
            >
              Go to Login
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.profile-background {
  @apply fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat;
  background-image: url('@/assets/FACTFLOW-4.png');
}
</style>
