import { api } from './axios'
import type { UserProfile, UpdateProfilePayload } from 'nalogai-shared/types/user.types'
import type { ApiSuccess } from 'nalogai-shared/types/api.types'

export async function getMyProfileApi(): Promise<UserProfile> {
  const { data } = await api.get<ApiSuccess<UserProfile>>('/users/me')
  return data.data
}

export async function updateProfileApi(payload: UpdateProfilePayload): Promise<UserProfile> {
  const { data } = await api.patch<ApiSuccess<UserProfile>>('/users/profile', payload)
  return data.data
}
