import { api } from './axios'
import type { UserProfile } from 'nalogai-shared/types/user.types'
import type {
  LoginPayload,
  RegisterPayload,
  OnboardingPayload,
} from 'nalogai-shared/types/user.types'

interface AuthResponseData {
  user: UserProfile
  accessToken: string
}

export async function loginApi(payload: LoginPayload): Promise<AuthResponseData> {
  const { data } = await api.post<{ data: AuthResponseData }>('/auth/login', payload)
  return data.data
}

export async function registerApi(payload: RegisterPayload): Promise<AuthResponseData> {
  const { data } = await api.post<{ data: AuthResponseData }>('/auth/register', payload)
  return data.data
}

export async function logoutApi(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getMeApi(): Promise<UserProfile> {
  const { data } = await api.get<{ data: { user: UserProfile } }>('/auth/me')
  return data.data.user
}

export async function onboardingApi(payload: OnboardingPayload): Promise<UserProfile> {
  const { data } = await api.post<{ data: { user: UserProfile } }>('/auth/onboarding', payload)
  return data.data.user
}
