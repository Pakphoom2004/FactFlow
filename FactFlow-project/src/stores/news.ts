import { defineStore } from 'pinia'
import type { NewsItem, CommentItem, Status, VotesItem } from '../type'
import NewsService from '../services/NewService'
import { isAxiosError } from 'axios'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import apiClient from '@/services/AxiosClient'
const MODERATION_STORAGE_KEY = 'factflow_news_moderation'

const MEDIA_BASE_URL =
  (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_UPLOAD_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() ||
  ''

interface ModerationSnapshot {
  hiddenNews: Record<string, boolean>
  removedComments: Record<string, string[]>
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}
function majorityStatus(fake: number, real: number): Status {
  if (fake === 0 && real === 0) return 'UNDECIDED'
  if (fake > real) return 'FAKE'
  if (real > fake) return 'NOT_FAKE'
  return 'UNDECIDED'
}

const FAKE_KEYWORDS = new Set(['FAKE', 'FALSE', 'FRAUD'])
const REAL_KEYWORDS = new Set(['REAL', 'NOT_FAKE', 'TRUE', 'VERIFIED', 'TRUSTED'])

function normalizeVoteType(value: unknown): 'FAKE' | 'REAL' {
  if (typeof value === 'boolean') {
    return value ? 'FAKE' : 'REAL'
  }
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
  if (REAL_KEYWORDS.has(normalized)) return 'REAL'
  if (FAKE_KEYWORDS.has(normalized)) return 'FAKE'
  return 'FAKE'
}

function resolveMediaUrl(raw?: string | null): string | undefined {
  if (raw === null || raw === undefined) return undefined
  const trimmed = String(raw).trim()
  if (!trimmed) return undefined
  if (/^(?:https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed
  const normalized = trimmed
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/\//, '/')
  if (!MEDIA_BASE_URL) return normalized
  const base = MEDIA_BASE_URL.replace(/\/+$/, '')
  const path = normalized.replace(/^\/+/, '')
  return `${base}/${path}`
}

function extractMediaCandidate(input: any): string | undefined {
  if (!input) return undefined
  if (typeof input === 'string') {
    const trimmed = input.trim()
    return trimmed ? trimmed : undefined
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const candidate = extractMediaCandidate(item)
      if (candidate) return candidate
    }
    return undefined
  }
  if (typeof input === 'object') {
    return (
      extractMediaCandidate(input.url) ||
      extractMediaCandidate(input.imageUrl) ||
      extractMediaCandidate(input.image_url) ||
      extractMediaCandidate(input.newsImageUrl) ||
      extractMediaCandidate(input.newsImageURL) ||
      extractMediaCandidate(input.news_image_url) ||
      extractMediaCandidate(input.newsImage) ||
      extractMediaCandidate(input.news_image) ||
      extractMediaCandidate(input.imagePath) ||
      extractMediaCandidate(input.image_path) ||
      extractMediaCandidate(input.coverImage) ||
      extractMediaCandidate(input.cover_image) ||
      extractMediaCandidate(input.secure_url) ||
      extractMediaCandidate(input.location) ||
      extractMediaCandidate(input.path) ||
      extractMediaCandidate(input.file) ||
      extractMediaCandidate(input.filename) ||
      extractMediaCandidate(input.fileName) ||
      extractMediaCandidate(input.previewUrl) ||
      extractMediaCandidate(input.preview_url) ||
      extractMediaCandidate(input.originalUrl) ||
      extractMediaCandidate(input.original_url)
    )
  }
  return undefined
}

export const useNewsStore = defineStore('news', {
  state: () => ({
    news: [] as NewsItem[],
    // runtime-only contributions from users (lost on reload as required)
    extraVotes: {} as Record<string, { fake: number; real: number }>,
    extraComments: {} as Record<string, CommentItem[]>,
    loaded: false,
    searchResults: [] as NewsItem[],
    searchLoading: false,
    searchTerm: '',
    hiddenNews: {} as Record<string, boolean>,
    removedComments: {} as Record<string, string[]>,
    moderationLoaded: false,
  }),
  getters: {
    all: (s) => s.news,
    visibleNews: (s) =>
      s.news.filter((n) => {
        const key = String(n.id)
        if (s.hiddenNews[key]) return false
        return !n.hidden
      }),
    byId: (s) => (id: string | number) => s.news.find((n) => String(n.id) === String(id)),
    combinedVotes: (s) => (id: string | number) => {
      const key = String(id)
      const base = s.news.find((n) => String(n.id) === key)?.votes || { fake: 0, real: 0 }
      const extra = s.extraVotes[key] || { fake: 0, real: 0 }
      return { fake: base.fake + extra.fake, real: base.real + extra.real }
    },
    statusOf(): (id: string | number) => Status {
      return (id: string | number) => {
        const v = (this as any).combinedVotes(id)
        return majorityStatus(v.fake, v.real)
      }
    },
    combinedComments: (s) => (id: string | number) => {
      const key = String(id)
      const base = s.news.find((n) => String(n.id) === key)?.comments || []
      const extra = s.extraComments[key] || []
      const removedSet = new Set((s.removedComments[key] || []).map(String))
      return [...base, ...extra]
        .filter((comment) => !removedSet.has(String(comment.id)))
        .sort((a, b) => {
          const left = b.createdAt || b.commentedAt || ''
          const right = a.createdAt || a.commentedAt || ''
          return left.localeCompare(right)
        })
    },
    isNewsHidden: (s) => (id: string | number | null | undefined) => {
      if (id === null || id === undefined) return false
      const key = String(id)
      if (s.hiddenNews[key]) return true
      const entry = s.news.find((n) => String(n.id) === key)
      return !!entry?.hidden
    },
  },

  actions: {
    initModeration() {
      if (this.moderationLoaded) return
      if (typeof localStorage === 'undefined') {
        this.hiddenNews = {}
        this.removedComments = {}
        this.moderationLoaded = true
        return
      }
      this.removedComments = {}
      try {
        const raw = localStorage.getItem(MODERATION_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as ModerationSnapshot
          this.hiddenNews = parsed.hiddenNews || {}
          this.removedComments = {}
        }
      } catch (error) {
        console.error('Failed to parse moderation data:', error)
        this.hiddenNews = {}
        this.removedComments = {}
      } finally {
        this.moderationLoaded = true
      }
    },
    persistModeration() {
      if (typeof localStorage === 'undefined') return
      const payload: ModerationSnapshot = {
        hiddenNews: this.hiddenNews,
        removedComments: this.removedComments,
      }
      localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify(payload))
    },
    async load() {
      this.initModeration()
      if (this.loaded) return
      try {
        const { data } = await NewsService.getNewsList()
        const base = Array.isArray(data) ? data : []
        const normalized = base
          .map((entry) => normalizeNewsEntry(entry))
          .filter((n): n is NewsItem => Boolean(n)) as unknown as NewsItem[]
        this.news = normalized.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
        this.loaded = true
      } catch (error) {
        console.error('Failed to load news from backend:', error)
        throw error
      }
    },
    async reload() {
      this.loaded = false
      await this.load()
    },
    async searchByQuery(rawQuery: string) {
      const normalized = rawQuery.trim()
      this.searchTerm = normalized
      if (!normalized) {
        this.searchResults = []
        return
      }
      this.searchLoading = true
      try {
        const { data } = await NewsService.searchNews({
          title: normalized,
          reporter: normalized,
          summary: normalized,
          body: normalized,
        })
        const base = Array.isArray(data) ? data : []
        const normalizedEntries = base
          .map((entry) => normalizeNewsEntry(entry))
          .filter((n): n is NewsItem => Boolean(n)) as unknown as NewsItem[]
        this.searchResults = normalizedEntries
          .filter((item) => !item.hidden)
          .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
      } catch (error) {
        console.error('Failed to search news:', error)
        this.searchResults = []
      } finally {
        this.searchLoading = false
      }
    },
    async addVote(
      newsId: string | number,
      voteTypeInput: string | boolean,
      comment?: {
        author: string
        text: string
        avatarUrl?: string
        userId?: string | number
      },
    ) {
      const key = String(newsId)
      const voteType = normalizeVoteType(voteTypeInput)
      const isFake = voteType === 'FAKE'

      // optimistic vote counts
      const previousExtra = this.extraVotes[key]
      const previousSnapshot = previousExtra ? { ...previousExtra } : null
      const optimisticVotes = {
        fake: (previousExtra?.fake ?? 0) + (isFake ? 1 : 0),
        real: (previousExtra?.real ?? 0) + (isFake ? 0 : 1),
      }
      this.extraVotes = { ...this.extraVotes, [key]: optimisticVotes }

      // optimistic comment for UI
      let optimisticCommentId: string | null = null
      let commentPayload:
        | {
            author: string
            message: string
            avatarUrl?: string
            userId?: string | number
            voteType: 'FAKE' | 'REAL'
          }
        | undefined

      if (comment && comment.text.trim()) {
        const author = comment.author?.trim() || 'Anonymous'
        const text = comment.text.trim()
        const createdAt = new Date().toISOString()
        const profileStore = useProfileStore()
        const rawUserId =
          comment.userId !== undefined && comment.userId !== null ? comment.userId : undefined
        const normalizedUserIdForAvatar = rawUserId !== undefined ? String(rawUserId) : undefined
        const avatarFromStore = normalizedUserIdForAvatar
          ? profileStore.avatarById(normalizedUserIdForAvatar)
          : null
        const item: CommentItem = {
          id: uid(),
          author,
          user: author,
          text,
          message: text,
          createdAt,
          commentedAt: createdAt,
          isFake,
          avatarUrl: comment.avatarUrl || avatarFromStore || undefined,
          userId: normalizedUserIdForAvatar,
          voteType,
          _mine: true,
        }
        const arr = this.extraComments[key] || []
        this.extraComments = { ...this.extraComments, [key]: [item, ...arr] }

        commentPayload = {
          author,
          message: text,
          avatarUrl: item.avatarUrl,
          userId: rawUserId,
          voteType,
        }
        try {
          //  เรียก backend เพื่อบันทึกจริง
          const res = await apiClient.post(`/comments/news/${newsId}/comment`, commentPayload)
          const saved = res.data

          //  แทนที่ id ปลอมใน state ด้วย id จริงจาก backend
          this.extraComments[key] = this.extraComments[key].map((c) =>
            c.id === item.id ? { ...c, id: saved.id } : c,
          )

          console.log(' Comment synced with backend ID:', saved.id)
          return saved
        } catch (error) {
          console.error('Vote submission failed:', error)
          // rollback optimistic votes ถ้า error
          if (previousSnapshot) {
            this.extraVotes = { ...this.extraVotes, [key]: previousSnapshot }
          } else {
            const next = { ...this.extraVotes }
            delete next[key]
            this.extraVotes = next
          }
          throw error
        }
      }

      const removeOptimisticVote = () => {
        if (this.extraVotes[key]) {
          const next = { ...this.extraVotes }
          delete next[key]
          this.extraVotes = next
        }
      }
      const restorePreviousVotes = () => {
        if (previousSnapshot) {
          this.extraVotes = { ...this.extraVotes, [key]: previousSnapshot }
        } else {
          removeOptimisticVote()
        }
      }
      const removeOptimisticComment = () => {
        if (!optimisticCommentId) return
        const existing = this.extraComments[key]
        if (!existing) return
        const filtered = existing.filter((c) => c.id !== optimisticCommentId)
        if (filtered.length) {
          this.extraComments = { ...this.extraComments, [key]: filtered }
        } else {
          const next = { ...this.extraComments }
          delete next[key]
          this.extraComments = next
        }
      }

      try {
        const response = await NewsService.submitVote(newsId, {
          voteType,
          message: commentPayload?.message,
          userId: commentPayload?.userId,
          author: commentPayload?.author,
          avatarUrl: commentPayload?.avatarUrl,
        })

        let syncedWithServer = false
        const voteSnapshot = extractVotesSnapshot(response?.data)
        if (voteSnapshot) {
          this.applyVotesSnapshot(key, voteSnapshot)
          syncedWithServer = true
        }

        if (!syncedWithServer) {
          syncedWithServer = await this.refreshNewsEntry(key)
        }

        if (syncedWithServer) {
          removeOptimisticVote()
        }
        removeOptimisticComment()
      } catch (error) {
        restorePreviousVotes()
        removeOptimisticComment()
        console.error('❌ Failed to submit vote:', error)
        if (isAxiosError(error)) {
          console.error(
            'Vote submission response payload:',
            error.response?.status,
            error.response?.data,
          )
        }
        throw error
      }
    },
    async setNewsHidden(newsId: string | number, hidden: boolean) {
      this.initModeration()
      const key = String(newsId)

      try {
        //  URL จาก .env
        const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
        const endpoint = hidden ? `${baseURL}/news/${key}/hide` : `${baseURL}/news/${key}/unhide`

        const authStore = useAuthStore()
        //  ดึง token จาก auth store หรือ localStorage
        const token =
          authStore.token ||
          localStorage.getItem('access_token') ||
          sessionStorage.getItem('access_token') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('token') ||
          undefined

        //  เรียก API พร้อมแนบ token
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (token) headers.Authorization = `Bearer ${token}`

        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers,
        })

        const bodyText = await response.text()
        if (!response.ok) {
          let detail = ''
          try {
            const parsed = JSON.parse(bodyText)
            detail = parsed?.message || parsed?.error || parsed?.details || ''
          } catch {
            detail = bodyText
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error(detail || 'AUTH_REQUIRED')
          }
          throw new Error(detail || `Backend returned ${response.status}`)
        }

        const updatedNews = bodyText ? JSON.parse(bodyText) : {}
        const serverHidden = resolveHiddenFlag(updatedNews)
        const finalHidden = serverHidden ?? hidden

        // อัปเดตใน store
        const index = this.news.findIndex((n) => String(n.id) === key)
        if (index !== -1) {
          this.news[index] = { ...this.news[index], ...updatedNews, hidden: finalHidden }
        }

        //  อัปเดต local state เพื่อให้ UI ทันที
      if (finalHidden) {
        this.hiddenNews = { ...this.hiddenNews, [key]: true }
      } else {
        const next = { ...this.hiddenNews }
        delete next[key]
        this.hiddenNews = next
        }

        this.persistModeration()

        console.log(` News ID ${newsId} is now ${finalHidden ? 'hidden' : 'visible'}`)
      } catch (error) {
        console.error('❌ Failed to toggle hidden status:', error)
        const message =
          error instanceof Error && error.message === 'AUTH_REQUIRED'
            ? 'Please log in again with admin privileges before changing visibility.'
            : error instanceof Error && error.message
              ? error.message
              : 'Failed to update news visibility. Please log in again or check your backend.'
        alert(message)
      }
    },
    async refreshNewsEntry(newsId: string | number) {
      try {
        const { data } = await NewsService.getNewsById(newsId)
        const normalized = normalizeNewsEntry(data)
        if (!normalized) return false
        const key = String(normalized.id)
        const index = this.news.findIndex((n) => String(n.id) === key)
        if (index !== -1) {
          this.news[index] = normalized
        } else {
          this.news = [normalized, ...this.news]
        }
        if (this.extraVotes[key]) {
          const nextVotes = { ...this.extraVotes }
          delete nextVotes[key]
          this.extraVotes = nextVotes
        }
        return true
      } catch (error) {
        console.error('❌ Failed to refresh news entry:', error)
        return false
      }
    },
    applyVotesSnapshot(newsKey: string, snapshot: VotesItem) {
      const idx = this.news.findIndex((n) => String(n.id) === newsKey)
      if (idx === -1) return
      this.news[idx] = {
        ...this.news[idx],
        votes: snapshot,
      }
      if (this.extraVotes[newsKey]) {
        const nextVotes = { ...this.extraVotes }
        delete nextVotes[newsKey]
        this.extraVotes = nextVotes
      }
    },
    async removeComment(newsId: string | number, commentId: string | number) {
      this.initModeration()
      const newsKey = String(newsId)
      const commentKey = String(commentId)
      const resolveCommentVote = (comment: any): 'FAKE' | 'REAL' | null => {
        if (!comment) return null
        if (typeof comment.isFake === 'boolean') {
          return comment.isFake ? 'FAKE' : 'REAL'
        }
        const rawVote =
          comment.voteType ??
          comment.vote_type ??
          comment.vote ??
          comment.result ??
          comment.status ??
          comment.verdict
        if (rawVote === undefined || rawVote === null) return null
        return normalizeVoteType(rawVote)
      }

      const newsIndex = this.news.findIndex((n) => String(n.id) === newsKey)
      const newsEntry = newsIndex !== -1 ? this.news[newsIndex] : undefined
      const extraArr = this.extraComments[newsKey] || []
      const extraMatchIndex = extraArr.findIndex((c) => String(c.id) === commentKey)
      const extraMatch = extraMatchIndex !== -1 ? extraArr[extraMatchIndex] : undefined
      const baseMatch = newsEntry?.comments?.find((c: any) => String(c.id) === commentKey)
      const existingComment = baseMatch || extraMatch
      const voteType = resolveCommentVote(existingComment)

      try {
        const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
        const endpoint = `${baseURL}/comments/${commentKey}`

        //  แนบ token (ถ้ามีระบบ auth)
        const authStore = useAuthStore()
        const token =
          authStore.token ||
          localStorage.getItem('access_token') ||
          sessionStorage.getItem('access_token')

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) {
          headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
        }
        //  เรียก DELETE ไป backend
        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers,
        })

        //  ตรวจ response
        if (!response.ok) {
          const message = `Backend returned ${response.status}`
          throw new Error(message)
        }

        //  ลบออกจาก state (frontend)
        const suppressed = new Set(this.removedComments[newsKey] || [])
        if (!suppressed.has(commentKey)) {
          suppressed.add(commentKey)
          this.removedComments = {
            ...this.removedComments,
            [newsKey]: Array.from(suppressed),
          }
        }

        //  ลบออกจาก extra comments
        if (extraArr.length) {
          const filtered = extraArr.filter((c) => String(c.id) !== commentKey)
          if (filtered.length) {
            this.extraComments = { ...this.extraComments, [newsKey]: filtered }
          } else {
            const nextExtras = { ...this.extraComments }
            delete nextExtras[newsKey]
            this.extraComments = nextExtras
          }
        }

        const applyVoteDecrement = (collection: NewsItem[]) => {
          const idx = collection.findIndex((n) => String(n.id) === newsKey)
          if (idx === -1) return
          const entry = collection[idx]
          const updatedComments = Array.isArray(entry.comments)
            ? entry.comments.filter((c: any) => String(c.id) !== commentKey)
            : entry.comments
          let updatedVotes = entry.votes
          if (voteType && entry.votes) {
            const fake = voteType === 'FAKE' ? Math.max(0, entry.votes.fake - 1) : entry.votes.fake
            const real = voteType === 'REAL' ? Math.max(0, entry.votes.real - 1) : entry.votes.real
            updatedVotes =
              fake !== entry.votes.fake || real !== entry.votes.real
                ? { fake, real }
                : entry.votes
          }
          collection[idx] = {
            ...entry,
            comments: updatedComments,
            votes: updatedVotes,
          }
        }

        applyVoteDecrement(this.news)
        this.news = [...this.news]
        if (Array.isArray(this.searchResults) && this.searchResults.length) {
          applyVoteDecrement(this.searchResults)
          this.searchResults = [...this.searchResults]
        }

        if (voteType && this.extraVotes[newsKey]) {
          const current = this.extraVotes[newsKey]
          const updated = {
            fake: voteType === 'FAKE' ? Math.max(0, current.fake - 1) : current.fake,
            real: voteType === 'REAL' ? Math.max(0, current.real - 1) : current.real,
          }
          if (updated.fake === 0 && updated.real === 0) {
            const nextVotes = { ...this.extraVotes }
            delete nextVotes[newsKey]
            this.extraVotes = nextVotes
          } else {
            this.extraVotes = { ...this.extraVotes, [newsKey]: updated }
          }
        }

        this.persistModeration()
        console.log(` Comment ${commentKey} deleted successfully.`)
      } catch (error) {
        console.error('❌ Failed to delete comment:', error)
        alert('Failed to delete comment. Please try again.')
      }
    },

  },
})

function normalizeNewsEntry(entry: any): NewsItem | null {
  if (!entry) return null
  const idRaw = entry.id ?? entry.newsId ?? entry.uuid ?? uid()
  const title = pickString(entry.title, entry.headline, entry.name) || 'Untitled news'
  const body = pickString(entry.body, entry.content, entry.description, '') || ''
  const summary = pickString(entry.summary, entry.subtitle, entry.abstract) || body.slice(0, 160)
  const reporter =
    pickString(entry.reporter, entry.author, entry.writer, entry.createdBy) || 'Unknown'
  const reportedAt = toIsoDate(
    pickString(entry.reportedAt, entry.reporterAt, entry.createdAt, entry.updatedAt),
  )
  const imageUrl = normalizeImage(
    entry.imageUrl ||
      entry.image_url ||
      entry.newsImageUrl ||
      entry.newsImageURL ||
      entry.news_image_url ||
      entry.newsImage ||
      entry.news_image ||
      entry.image ||
      entry.imagePath ||
      entry.image_path ||
      entry.coverImage ||
      entry.cover_image ||
      entry.thumbnail,
  )
  const votes = normalizeVotes(entry)
  const comments = normalizeComments(entry.comments, String(idRaw))
  const hidden = resolveHiddenFlag(entry) ?? false

  const normalized = {
    id: String(idRaw),
    title,
    summary,
    body,
    reporter,
    reportedAt,
    imageUrl,
    votes,
    comments,
    hidden,
  }

  // Cast so existing NewsItem shape keeps working with backend payload + UI expectations.
  return normalized as unknown as NewsItem
}

function normalizeVotes(entry: any): VotesItem {
  const containers = collectVoteContainers(entry)
  const fakeKeys = [
    'fake',
    'false',
    'fakeVotes',
    'fakeVote',
    'fakeCount',
    'fake_count',
    'fakeVotesCount',
    'fake_vote_count',
    'fakeTotal',
    'fakeTotals',
    'downVotes',
    'downvotes',
    'downvote',
    'negative',
    'fraud',
  ]
  const realKeys = [
    'real',
    'true',
    'realVotes',
    'realVote',
    'realCount',
    'real_count',
    'realVotesCount',
    'real_vote_count',
    'realTotal',
    'upVotes',
    'upvotes',
    'upvote',
    'verified',
    'notFake',
    'not_fake',
    'notFakeVotes',
    'notFakeVote',
    'trueVotes',
    'trueVote',
    'positive',
    'trusted',
  ]

  let fakeValue: number | undefined
  let realValue: number | undefined

  for (const container of containers) {
    if (fakeValue === undefined) fakeValue = readVoteField(container, fakeKeys)
    if (realValue === undefined) realValue = readVoteField(container, realKeys)
    if (fakeValue !== undefined && realValue !== undefined) break
  }

  return {
    fake: toCount(fakeValue),
    real: toCount(realValue),
  }
}

function collectVoteContainers(entry: any): any[] {
  const containers = [
    entry,
    entry?.votes,
    entry?.vote,
    entry?.voteCounts,
    entry?.vote_counts,
    entry?.voteSummary,
    entry?.vote_summary,
    entry?.voteResult,
    entry?.vote_result,
    entry?.results,
    entry?.stats,
    entry?.statistics,
  ]
  return containers.filter((c) => c && typeof c === 'object')
}

function readVoteField(container: any, keys: string[]): number | undefined {
  for (const key of keys) {
    if (key in container) {
      const value = container[key]
      const num = Number(value)
      if (Number.isFinite(num)) return num
    }
    const camelKey = camelize(key)
    if (camelKey in container) {
      const value = container[camelKey]
      const num = Number(value)
      if (Number.isFinite(num)) return num
    }
  }
  return undefined
}

function camelize(input: string): string {
  return input.replace(/[_-](\w)/g, (_, c: string) => c.toUpperCase())
}

function normalizeComments(raw: any, key: string): CommentItem[] {
  const profileStore = useProfileStore()
  if (!Array.isArray(raw)) return []
  const result = raw
    .map((item: any, index: number) => {
      const text = pickString(item?.text, item?.message, item?.comment, item?.body)
      if (!text) return null
      const userObj =
        item && typeof item?.user === 'object' && !Array.isArray(item?.user) ? item.user : null
      const combinedUserName =
        (userObj?.firstName && userObj?.lastName
          ? `${userObj.firstName} ${userObj.lastName}`
          : undefined) ||
        (userObj?.firstname && userObj?.lastname
          ? `${userObj.firstname} ${userObj.lastname}`
          : undefined)
      const userDisplayName =
        pickString(
          userObj?.username,
          userObj?.userName,
          userObj?.name,
          userObj?.displayName,
          userObj?.nickname,
          combinedUserName,
        ) || undefined
      const author =
        pickString(
          item?.author,
          typeof item?.user === 'string' ? item.user : undefined,
          item?.username,
          item?.userName,
          item?.user_name,
          item?.name,
          item?.nickname,
          userDisplayName,
        ) ||
        userDisplayName ||
        'Anonymous'
      const username = userDisplayName || author || 'Anonymous'
      const createdAt = toIsoDate(
        pickString(item?.createdAt, item?.commentedAt, item?.timestamp, item?.created_on),
      )
      const rawVoteString = pickString(
        item?.voteType,
        item?.vote_type,
        item?.verdict,
        item?.vote,
        item?.result,
        item?.status,
      )
      let voteType: 'FAKE' | 'REAL' | undefined
      let isFake: boolean | undefined
      if (typeof item?.isFake === 'boolean') {
        isFake = item.isFake
        voteType = normalizeVoteType(item.isFake)
      } else if (rawVoteString) {
        voteType = normalizeVoteType(rawVoteString)
        isFake = voteType === 'FAKE'
      }
      const rawUserId =
        item?.userId ?? item?.user_id ?? userObj?.id ?? userObj?.userId ?? userObj?.user_id ?? null
      const normalizedUserId =
        rawUserId !== null && rawUserId !== undefined ? String(rawUserId) : undefined
      const avatarFromUser = pickString(
        item?.avatarUrl,
        item?.avatar,
        item?.profileImage,
        item?.userImage,
        userObj?.avatarUrl,
        userObj?.avatar,
        userObj?.profileImage,
        userObj?.imageUrl,
        userObj?.photo,
      )
      const fallbackAvatar =
        normalizedUserId !== undefined
          ? profileStore.avatarById(String(normalizedUserId)) || null
          : null
      const resolvedSource = extractMediaCandidate([
        item?.imageUrl,
        item?.image_url,
        item?.image,
        item?.photo,
        item?.thumbnail,
        item?.evidenceImageUrl,
        item?.evidence_image_url,
        item?.commentImageUrl,
        item?.comment_image_url,
        item?.attachment,
        item?.attachmentUrl,
        item?.attachment_url,
      ])
      let resolvedImageUrl = resolveMediaUrl(resolvedSource)
      if (!resolvedImageUrl) {
        const commentId = item?.id ?? item?.commentId ?? item?.comment_id
        if (commentId) {
          resolvedImageUrl = resolveMediaUrl(`/comments/${commentId}/image`)
        }
      }
      const base = {
        id: String(item?.id ?? `${key}-${index}`),
        author,
        user: author,
        text,
        message: text,
        createdAt,
        commentedAt: createdAt,
        imageUrl: resolvedImageUrl,
        isFake,
        avatarUrl: avatarFromUser || fallbackAvatar || undefined,
        userId: normalizedUserId,
        voteType,
        username,
      }
      return base
    })
    .filter(Boolean) as CommentItem[]

  return result
}

function extractVotesSnapshot(payload: any): VotesItem | null {
  if (!payload || typeof payload !== 'object') return null
  const candidates = [payload, payload?.data, payload?.result, payload?.news, payload?.payload]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    if (!hasVoteIndicators(candidate)) continue
    return normalizeVotes(candidate)
  }
  return null
}

function hasVoteIndicators(entry: any): boolean {
  if (!entry || typeof entry !== 'object') return false
  const containers = [
    entry,
    entry.votes,
    entry.vote,
    entry.voteCounts,
    entry.vote_summary,
    entry.voteSummary,
  ]
  return containers.some((obj) => {
    if (!obj || typeof obj !== 'object') return false
    return (
      Object.prototype.hasOwnProperty.call(obj, 'fake') ||
      Object.prototype.hasOwnProperty.call(obj, 'real') ||
      Object.prototype.hasOwnProperty.call(obj, 'true') ||
      Object.prototype.hasOwnProperty.call(obj, 'false') ||
      Object.prototype.hasOwnProperty.call(obj, 'fakeVotes') ||
      Object.prototype.hasOwnProperty.call(obj, 'realVotes') ||
      Object.prototype.hasOwnProperty.call(obj, 'downVotes') ||
      Object.prototype.hasOwnProperty.call(obj, 'upVotes') ||
      Object.prototype.hasOwnProperty.call(obj, 'downvote') ||
      Object.prototype.hasOwnProperty.call(obj, 'upvote')
    )
  })
}

function resolveHiddenFlag(entry: any): boolean | undefined {
  if (!entry || typeof entry !== 'object') return undefined
  const candidates = [
    entry?.hidden,
    entry?.isHidden,
    entry?.is_hidden,
    entry?.hiddenFlag,
    entry?.hidden_flag,
    entry?.hiddenStatus,
    entry?.hidden_status,
    entry?.visibility,
  ]
  for (const candidate of candidates) {
    const coerced = coerceHiddenValue(candidate)
    if (typeof coerced === 'boolean') return coerced
  }
  return undefined
}

function coerceHiddenValue(value: any): boolean | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'hidden', 'hide', 'y'].includes(normalized)) return true
    if (['0', 'false', 'no', 'visible', 'show', 'n'].includes(normalized)) return false
  }
  return undefined
}

function normalizeImage(input: any): string {
  if (!input) return ''

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('data:image')) return trimmed
    const resolved = resolveMediaUrl(trimmed)
    return resolved ?? trimmed
  }


  const fallback =
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'

  if (!input) return fallback


  if (typeof input === 'string' && input.startsWith('data:image')) {
    return input
  }


  if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
    return input
  }


  if (Array.isArray(input) && input.length > 0) {
    for (const value of input) {
      const candidate = normalizeImage(value)
      if (candidate) return candidate
    }
    return ''
  }

  if (typeof input === 'object') {
    const candidate =
      extractMediaCandidate(input) ||
      extractMediaCandidate((input as Record<string, unknown>)?.data) ||
      extractMediaCandidate((input as Record<string, unknown>)?.result)
    if (candidate) {
      const resolved = resolveMediaUrl(candidate)
      return resolved ?? candidate
    }
  }

  return ''
}

function pickString(...values: any[]): string | undefined {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = pickString(...value)
      if (nested) return nested
      continue
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString()
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function toIsoDate(value?: string): string {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function toCount(value: any): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return 0
  return Math.trunc(num)
}
