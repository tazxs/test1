/**
 * Standard API response envelope used by ALL backend endpoints.
 * Frontend consumers should always check `success` before accessing `data`.
 */

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    details?: ApiErrorDetail[]
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  meta: PaginationMeta
}

export interface ApiErrorDetail {
  field: string
  message: string
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'UPGRADE_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'INTERNAL_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'BANK_CONNECTION_ERROR'
  | 'PDF_GENERATION_ERROR'

export interface PaginationParams {
  page?: number
  limit?: number
}
