import apiClient from '@/services/AxiosClient'

const rawProfileEndpoint = import.meta.env.VITE_PROFILE_ENDPOINT || '/profile'

function buildProfileEndpoint(pathSuffix = ''): string {
  const base = rawProfileEndpoint.trim() || '/profile'
  const isAbsolute = /^https?:\/\//i.test(base)
  const normalizedBase = isAbsolute
    ? base.replace(/\/+$/, '')
    : `/${base.replace(/^\/+/, '').replace(/\/+$/, '')}`

  const suffix =
    pathSuffix && pathSuffix.trim()
      ? pathSuffix.startsWith('/')
        ? pathSuffix
        : `/${pathSuffix}`
      : ''

  return `${normalizedBase}${suffix}`
}

type AvatarResponse = {
  avatarUrl?: string
  url?: string
  avatar?: string
}

export default {
  fetchCurrentAvatar() {
    return apiClient.get<AvatarResponse>(buildProfileEndpoint('/avatar'))
  },

  fetchAvatarByUserId(userId: string | number) {
    return apiClient.get<AvatarResponse>(buildProfileEndpoint(`/users/${userId}/avatar`))
  },

  uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append('avatar', file)

    return apiClient.put<AvatarResponse>(buildProfileEndpoint('/avatar'), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  deleteAvatar() {
    return apiClient.delete(buildProfileEndpoint('/avatar'))
  },
}
