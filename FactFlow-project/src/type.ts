export type Status = 'FAKE' | 'NOT_FAKE' | 'UNDECIDED'

export interface NewsItem {
  id: string | number
  title: string
  summary: string
  body: string
  reporter: string
  reportedAt: string
  imageUrl: string
  votes: VotesItem
  comments: CommentItem[]
  hidden?: boolean
}

export interface VotesItem {
  fake: number
  real: number
}

export interface CommentItem {
  id?: string
  user: string
  author: string
  message: string
  text: string
  commentedAt: string // ISO datetime
  createdAt: string
  imageUrl?: string
  isFake?: boolean
  avatarUrl?: string
  userId?: string
  voteType?: 'FAKE' | 'REAL'
  username?: string
  _mine?: boolean
}

export interface User {
  id: number | string
  firstname: string
  lastname: string
  email: string
  roles: string[]
  username?: string
  role?: string
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
}

export interface MessageState {
  message: string
}

export type AdminAccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked'

export interface AdminAccessRequest {
  id: string
  userId: string
  name: string
  email: string
  requestedRole?: string
  status: AdminAccessRequestStatus
  requestedAt: string
  reviewedAt?: string
  reviewerId?: string
}

// export interface NewsState {
//   news: News | null
// }
export interface AuthResponse {
  accessToken: string
  user : User
}
export interface RegisterResponse {
  user: User
  message?: string
}
