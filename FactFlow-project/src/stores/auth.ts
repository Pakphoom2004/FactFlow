import { defineStore } from 'pinia'
import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { RegisterResponse } from '@/type'
import type { User } from '@/type'

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as User | null,
  }),

  getters: {
    currentUserName: (state): string => {
      if (!state.user) return ''

      return `${state.user.firstname} ${state.user.lastname}`
    },

    isAdmin: (state): boolean => {
      const roles = state.user?.roles ?? []
      return roles.some((role: string) => role?.toUpperCase?.() === 'ROLE_ADMIN')
    },

    authorizationHeader: (state): string => {
      return state.token ? `Bearer ${state.token}` : ''
    },
  },
  actions: {
    async login(username: string, password: string) {
      try {
        const response = await apiClient.post('/api/v1/auth/authenticate', {
          username: username,
          password,
        })

        const token =
          response.data?.accessToken ??
          response.data?.access_token ??
          response.data?.token

        if (!token) {
          throw new Error('Missing access token in authentication response.')
        }

        this.token = token
        this.user = response.data.user
        localStorage.setItem('access_token', token)
        localStorage.setItem('user', JSON.stringify(this.user))
        return response.data
      } catch (error: any) {
        console.error('Login error:', error)
        throw new Error(error?.response?.data?.message || 'Login failed')
      }
    },
    async fetchUserProfile() {
      try {
        const response = await apiClient.get('/profile')
        this.user = response.data
        // เก็บ role ไว้ใน localStorage เผื่อ reload หน้า
        if (this.user?.role) {
          localStorage.setItem('user_role', this.user.role)
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
      }
    },


    logout() {
      console.log('Logging out')
      this.token = null
      this.user = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
    },
    init() {
  const token = localStorage.getItem('access_token')
  const user = localStorage.getItem('user')
  if (token && user) {
    this.token = token
    this.user = JSON.parse(user)
  }
},
    reload(token: string, user: User) {
      this.token = token
      this.user = user
    },

   async register(payload: {
  username?: string
  firstname: string
  lastname: string
  email: string
  password: string
}) {
  try {
    const response = await apiClient.post<RegisterResponse>('/api/v1/auth/register', payload)
    console.log('✅ Registration response:', response.data)
    return response.data
  } catch (error: any) {
    console.error('❌ Register error:', error)
    throw new Error(error?.response?.data?.message || 'Registration failed')
  }
},
  },

})
