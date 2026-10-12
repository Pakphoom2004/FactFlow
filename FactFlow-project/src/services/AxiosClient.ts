import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

function attachBearer(token: string | null): string | null {
  if (!token) return null
  const trimmed = token.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null
  return trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = attachBearer(
    localStorage.getItem('access_token') ||
      sessionStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      null,
  )
  if (!token) return config

  const headers = config.headers ?? new AxiosHeaders()
  if (headers instanceof AxiosHeaders) {
    headers.set('Authorization', token)
  } else {
    ;(headers as Record<string, string>).Authorization = token
  }
  config.headers = headers
  return config
})

export default apiClient
