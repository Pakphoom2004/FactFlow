import apiClient from './AxiosClient'
import type { NewsItem } from '@/type'

const rawNewsEndpoint = import.meta.env.VITE_NEWS_ENDPOINT || '/news'

function buildNewsEndpoint(pathSuffix = ''): string {
  const base = rawNewsEndpoint.trim() || '/news'
  const isAbsolute = /^https?:\/\//i.test(base)
  const normalizedBase = isAbsolute
    ? base.replace(/\/+$/, '')
    : `/${base.replace(/^\/+/, '').replace(/\/+$/, '')}`

  return `${normalizedBase}${pathSuffix}`
}

function resolveAuthToken(): string | null {
  const raw =
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    null
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null
  return trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`
}

export default {
  async getNewsList() {
    const response = await apiClient.get<NewsItem[]>(buildNewsEndpoint())
    return response
  },

  async getNewsById(id: string | number) {
    const response = await apiClient.get<NewsItem>(buildNewsEndpoint(`/${id}`))
    return response
  },

  async createNews(payload: Partial<NewsItem>) {
    const preparedPayload = prepareNewsPayload(payload)
    const token = resolveAuthToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await apiClient.post<NewsItem>(buildNewsEndpoint(), preparedPayload, {
      headers,
    })
    return response
  },

  async searchNews(params: {
    title?: string
    reporter?: string
    summary?: string
    body?: string
  }) {
    const query = new URLSearchParams()
    ;(['title', 'reporter', 'summary', 'body'] as const).forEach((key) => {
      const raw = params[key]
      if (raw && raw.trim()) {
        query.append(key, raw.trim())
      }
    })
    const suffix = query.toString()
    const path = suffix ? `/search?${suffix}` : '/search'
    const response = await apiClient.get<NewsItem[]>(buildNewsEndpoint(path))
    return response
  },

  // ✅ เพิ่มการแนบ token สำหรับโหวต (ต้อง login)
  async submitVote(newsId: string | number, payload: VotePayload) {
    // ดึง token จาก localStorage หรือ sessionStorage
    const token = resolveAuthToken()

    // ถ้าไม่มี token → ป้องกันไว้
    if (!token) {
      alert('Please log in before voting.')
      throw new Error('Unauthorized: no token found.')
    }

    const body: Record<string, unknown> = {
      voteType: payload.voteType,
      vote_type: payload.voteType,
      newsId,
      news_id: newsId,
    }
    const comment: Record<string, unknown> = {
      voteType: payload.voteType,
      vote_type: payload.voteType,
    }
    if (payload.message !== undefined) {
      body.message = payload.message
      body.text = payload.message
      comment.message = payload.message
    }
  if (payload.imageUrl) {
    body.imageUrl = payload.imageUrl
    body.image_url = payload.imageUrl
    body.evidenceImageUrl = payload.imageUrl
    body.evidence_image_url = payload.imageUrl
    body.commentImageUrl = payload.imageUrl
    body.comment_image_url = payload.imageUrl
    body.attachmentUrl = payload.imageUrl
    body.attachment_url = payload.imageUrl
    comment.imageUrl = payload.imageUrl
    comment.image_url = payload.imageUrl
    comment.evidenceImageUrl = payload.imageUrl
    comment.evidence_image_url = payload.imageUrl
    comment.commentImageUrl = payload.imageUrl
    comment.comment_image_url = payload.imageUrl
    comment.attachmentUrl = payload.imageUrl
    comment.attachment_url = payload.imageUrl
  }
    if (payload.userId !== undefined) {
      body.userId = payload.userId
      body.user_id = payload.userId
      comment.userId = payload.userId
      comment.user_id = payload.userId
    }
    if (payload.author) {
      body.author = payload.author
      comment.author = payload.author
    }
    if (payload.avatarUrl) {
      body.avatarUrl = payload.avatarUrl
      body.avatar_url = payload.avatarUrl
      comment.avatarUrl = payload.avatarUrl
      comment.avatar_url = payload.avatarUrl
    }
    if (Object.keys(comment).length > 0) {
      body.comment = comment
    }

    // แนบ Authorization header
    return apiClient.post(buildNewsEndpoint(`/${newsId}/comment`), body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  },
}

interface VotePayload {
  voteType: 'FAKE' | 'REAL'
  message?: string
  imageUrl?: string
  userId?: string | number
  author?: string
  avatarUrl?: string
}

function prepareNewsPayload(payload: Partial<NewsItem>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  const title = pickString(payload.title)
  const summary = pickString(payload.summary)
  const body = pickString(payload.body)
  const reporter = pickString(payload.reporter)
  const imageUrl = pickString(payload.imageUrl)
  const reportedAt = resolveTimestamp(payload.reportedAt)

  if (title) sanitized.title = title
  if (summary) sanitized.summary = summary
  if (body) sanitized.body = body
  if (reporter) sanitized.reporter = reporter
  if (imageUrl) sanitized.imageUrl = imageUrl
  sanitized.reportedAt = reportedAt

  if (payload.id !== undefined) sanitized.id = payload.id

  if (imageUrl) {
    sanitized.image = sanitized.image ?? imageUrl
    sanitized.image_url = sanitized.image_url ?? imageUrl
    sanitized.newsImageUrl = imageUrl
    sanitized.newsImageURL = imageUrl
    sanitized.news_image_url = imageUrl
    sanitized.newsImage = imageUrl
    sanitized.news_image = imageUrl
    sanitized.imagePath = imageUrl
    sanitized.image_path = imageUrl
    sanitized.coverImage = imageUrl
    sanitized.cover_image = imageUrl
    sanitized.thumbnail = sanitized.thumbnail ?? imageUrl
  }

  return sanitized
}

function pickString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }
  if (value === null || value === undefined) return undefined
  const str = String(value).trim()
  return str ? str : undefined
}

function resolveTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return new Date().toISOString()
    const parsed = Date.parse(trimmed)
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString()
    }
    return trimmed
  }
  return new Date().toISOString()
}
