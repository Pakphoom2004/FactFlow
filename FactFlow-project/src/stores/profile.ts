import { defineStore } from 'pinia'
import ProfileService from '@/services/ProfileService'

const STORAGE_KEY = 'factflow_profile_store'

type AvatarMap = Record<string, string>

export const useProfileStore = defineStore('profile', {
  state: () => ({
    avatars: {} as AvatarMap,
    initialized: false,
    loading: false,
  }),

  getters: {
    avatarById: (state) => (userId?: string | number | null) => {
      if (userId === null || userId === undefined) return null
      return state.avatars[String(userId)] || null
    },
  },

  actions: {
    init() {
      if (this.initialized) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') {
            this.avatars = parsed as AvatarMap
          }
        }
      } catch (error) {
        console.error('Failed to load profile store:', error)
        this.avatars = {}
      } finally {
        this.initialized = true
      }
    },

    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.avatars))
    },

    cacheAvatar(userId: string | number, avatarUrl: string) {
      if (!userId || !avatarUrl) return
      const key = String(userId)
      if (this.avatars[key] === avatarUrl) return
      this.avatars = {
        ...this.avatars,
        [key]: avatarUrl,
      }
      this.persist()
    },

    clearAvatar(userId: string | number) {
      if (!userId) return
      const key = String(userId)
      if (!(key in this.avatars)) return
      const next = { ...this.avatars }
      delete next[key]
      this.avatars = next
      this.persist()
    },

    async fetchAvatar(userId: string | number | null | undefined, options?: { force?: boolean }) {
      const key = userId !== null && userId !== undefined ? String(userId) : null
      if (!key) return null

      const shouldSkip = !options?.force && !!this.avatars[key]
      if (shouldSkip) {
        return this.avatars[key]
      }

      try {
        this.loading = true
        const response = await ProfileService.fetchCurrentAvatar()
        const url = response.data?.avatarUrl || response.data?.url || response.data?.avatar || null
        if (url) {
          this.cacheAvatar(key, url)
          return url
        }
        this.clearAvatar(key)
        return null
      } catch (error) {
        console.error(`Failed to fetch avatar for ${key}:`, error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async uploadAvatar(userId: string | number | null | undefined, file: File) {
      const key = userId !== null && userId !== undefined ? String(userId) : null
      if (!key || !file) return null

      try {
        this.loading = true
        const response = await ProfileService.uploadAvatar(file)
        const url = response.data?.avatarUrl || response.data?.url || response.data?.avatar || null
        if (url) {
          this.cacheAvatar(key, url)
        }
        return url
      } catch (error) {
        console.error('Failed to upload avatar:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async removeAvatar(userId: string | number | null | undefined) {
      const key = userId !== null && userId !== undefined ? String(userId) : null
      if (!key) return

      try {
        this.loading = true
        await ProfileService.deleteAvatar()
      } catch (error) {
        console.error('Failed to delete avatar:', error)
        throw error
      } finally {
        this.loading = false
      }

      this.clearAvatar(key)
    },
  },
})
