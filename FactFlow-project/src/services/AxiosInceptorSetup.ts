import { AxiosHeaders } from 'axios'
import apiClient from './AxiosClient'

function attachBearer(token: string | null): string | null {
  if (!token) return null
  const trimmed = token.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null
  return trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`
}

apiClient.interceptors.request.use(
  (request) => {
    const token = attachBearer(
      localStorage.getItem('access_token') ||
        sessionStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        null,
    )
    if (!token) {
      return request
    }

    const headers = request.headers ?? new AxiosHeaders()
    if (headers instanceof AxiosHeaders) {
      headers.set('Authorization', token)
    } else {
      ;(headers as Record<string, string>).Authorization = token
    }
    request.headers = headers
    return request
  },
  (error) => Promise.reject(error)
)
