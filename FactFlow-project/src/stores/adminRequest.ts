import { defineStore } from 'pinia'
import apiClient from '@/services/AxiosClient'
import { useAuthStore } from '@/stores/auth'
import type { AdminAccessRequest, AdminAccessRequestStatus } from '@/type'

type AnyId = string | number | null | undefined

interface RawRoleChangeRequest {
  id?: AnyId
  requester?: {
    id?: AnyId
    username?: string
    email?: string
    firstname?: string
    lastname?: string
  }
  requestedRole?: string
  status?: string
  requestDate?: string
  responseDate?: string
  reviewerId?: AnyId
}

const STATUS_MAP: Record<string, AdminAccessRequestStatus> = {
  approved: 'approved',
  APPROVED: 'approved',
  pending: 'pending',
  PENDING: 'pending',
  rejected: 'rejected',
  REJECTED: 'rejected',
  revoked: 'revoked',
  REVOKED: 'revoked',
}

function normalizeStatus(value: unknown): AdminAccessRequestStatus {
  if (typeof value === 'string') {
    const normalized = STATUS_MAP[value] ?? STATUS_MAP[value.toLowerCase()]
    if (normalized) return normalized
  }
  return 'pending'
}

function toRequestId(value: AnyId): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function composeDisplayName(raw: RawRoleChangeRequest): string {
  const requester = raw.requester ?? {}
  const firstName =
    requester.firstname ??
    requester['firstName' as keyof typeof requester] ??
    requester['first_name' as keyof typeof requester]

  if (typeof firstName === 'string' && firstName.trim()) {
    return firstName.trim()
  }
  if (typeof requester.username === 'string' && requester.username.trim()) {
    return requester.username
  }
  if (typeof requester.email === 'string' && requester.email.trim()) {
    return requester.email
  }
  return 'Unknown user'
}

function composeEmail(raw: RawRoleChangeRequest): string {
  const requester = raw.requester ?? {}
  if (typeof requester.email === 'string' && requester.email.trim()) {
    return requester.email
  }
  if (typeof requester.username === 'string' && requester.username.trim()) {
    return `${requester.username}@factflow.local`
  }
  return 'unknown@factflow.local'
}
function mapRoleChangeRequest(raw: RawRoleChangeRequest): AdminAccessRequest {
  const auth = useAuthStore()
  const id = toRequestId(raw.id)
  const requesterId = toRequestId(raw.requester?.id)
  const userId = requesterId || toRequestId(auth.user?.id) || id

  return {
    id,
    userId,
    name: composeDisplayName(raw),
    email: composeEmail(raw),
    requestedRole: raw.requestedRole,
    status: normalizeStatus(raw.status),
    requestedAt: raw.requestDate ?? new Date().toISOString(),
    reviewedAt: raw.responseDate,
    reviewerId: raw.reviewerId ? toRequestId(raw.reviewerId) : undefined,
  }
}

function sortByRequestedAtDesc(a: AdminAccessRequest, b: AdminAccessRequest) {
  const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0
  const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0
  return bTime - aTime
}

export const useAdminRequestStore = defineStore('adminRequest', {
  state: () => ({
    requests: [] as AdminAccessRequest[],
  }),

  getters: {
    pendingRequests: (state) => state.requests.filter((request) => request.status === 'pending'),
    approvedRequests: (state) => state.requests.filter((request) => request.status === 'approved'),
    latestRequestByUser: (state) => (userId: AnyId) => {
      if (userId === null || userId === undefined) return null
      const normalized = toRequestId(userId)
      return (
        state.requests
          .filter((request) => request.userId === normalized)
          .sort(sortByRequestedAtDesc)[0] ?? null
      )
    },
  },

  actions: {
    async fetchRequests() {
  try {
    const auth = useAuthStore()
    const endpoint = auth.isAdmin
      ? '/role-change-requests'          // admin เห็นทั้งหมด
      : '/role-change-requests/me'       // user เห็นของตัวเองเท่านั้น

    const response = await apiClient.get<RawRoleChangeRequest[]>(endpoint)
    const payload = Array.isArray(response.data) ? response.data : []
    const mapped = payload.map(mapRoleChangeRequest).sort(sortByRequestedAtDesc)
    this.requests = mapped
    return mapped
  } catch (error) {
    console.error('Failed to fetch role change requests:', error)
    // อย่าปล่อยให้ error ลอยออก ถ้าอยากให้หน้าไม่ล่ม
    return []
  }
},

    async submitRequest(requestedRole = 'ROLE_ADMIN') {
      const normalizedRole = typeof requestedRole === 'string' && requestedRole.trim()
        ? requestedRole.trim().toUpperCase()
        : 'ROLE_ADMIN'
      try {
        const response = await apiClient.post<RawRoleChangeRequest>(
          '/role-change-requests',
          null,
          { params: { requestedRole: normalizedRole } },
        )
        const created = mapRoleChangeRequest(response.data ?? {})
        this.upsertRequest(created)
        return created
      } catch (error) {
        console.error('Failed to submit role change request:', error)
        throw error
      }
    },
async updateRequestStatus(id: AnyId, status: 'APPROVED' | 'REJECTED' | 'REVOKED') {
  const normalizedId = toRequestId(id)
  const normalizedStatus = status?.toUpperCase?.() as 'APPROVED' | 'REJECTED' | 'REVOKED'
  try {
    const response = await apiClient.post<RawRoleChangeRequest>(
      `/role-change-requests/${normalizedId}/status`,
      null,
      { params: { status: normalizedStatus } },
    )

    const updated = mapRoleChangeRequest(response.data ?? {})
    this.upsertRequest(updated)

    await this.fetchRequests()

    return updated
  } catch (error) {
    console.error(`Failed to update request ${normalizedId} status to ${status}:`, error)
    throw error
  }
}
,

    upsertRequest(request: AdminAccessRequest) {
      const existingIndex = this.requests.findIndex((item) => item.id === request.id)
      if (existingIndex >= 0) {
        this.requests.splice(existingIndex, 1, request)
      } else {
        this.requests.unshift(request)
      }
      this.requests.sort(sortByRequestedAtDesc)
    },
  },
})
