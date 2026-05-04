import { api } from './axios'
import type { ApiSuccess } from 'nalogai-shared/types/api.types'
import type { SubscriptionPlan } from 'nalogai-shared/types/user.types'

export interface SubscribeResult {
  plan: SubscriptionPlan
  transactionId: string
  accessToken: string
}

// POST /api/payments/subscribe
export async function subscribePlanApi(
  plan: SubscriptionPlan,
  paymentToken: string,
): Promise<SubscribeResult> {
  const { data } = await api.post<ApiSuccess<SubscribeResult>>('/payments/subscribe', {
    plan,
    paymentToken,
  })
  return data.data
}
