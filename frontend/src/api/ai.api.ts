/// <reference types="vite/client" />
import { api, getAcceptLanguage } from './axios'
import { useAuthStore } from '@store/authStore'
import type {
  AIAdviceTip,
  AIChatResponse,
  AICategorizationResult,
  AICategorizeBulkResult,
} from 'nalogai-shared/types/ai.types'
import type { ApiSuccess } from 'nalogai-shared/types/api.types'
import type { TransactionType } from 'nalogai-shared/types/transaction.types'

// ── Categorize a single transaction ───────────────────────────────────────────
export async function categorizeApi(payload: {
  description: string
  amount: number
  type: TransactionType
}): Promise<AICategorizationResult> {
  const { data } = await api.post<ApiSuccess<AICategorizationResult>>(
    '/ai/categorize',
    payload,
  )
  return data.data
}

// ── Bulk categorization ────────────────────────────────────────────────────────
export async function categorizeBulkApi(payload: {
  transactions: Array<{ id: string; description: string; amount: number; type: TransactionType }>
}): Promise<AICategorizeBulkResult> {
  const { data } = await api.post<ApiSuccess<AICategorizeBulkResult>>(
    '/ai/categorize-bulk',
    payload,
  )
  return data.data
}

// ── Get AI advice tips (server auto-fetches user's real financial data) ────────
export async function getAdviceApi(): Promise<AIAdviceTip[]> {
  const { data } = await api.get<ApiSuccess<{ tips: AIAdviceTip[] }>>('/ai/advice')
  return data.data.tips
}

// ── Chat with AI ───────────────────────────────────────────────────────────────
export async function chatApi(payload: {
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<AIChatResponse> {
  const { data } = await api.post<ApiSuccess<AIChatResponse>>(
    '/ai/chat',
    payload,
  )
  return data.data
}

// ── Streaming chat — yields tokens as they arrive via SSE ─────────────────────
export async function* chatStreamApi(payload: {
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}): AsyncGenerator<string> {
  const baseURL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api'
  const token = useAuthStore.getState().accessToken

  const response = await fetch(`${baseURL}/ai/chat/stream`, {
    method:      'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': getAcceptLanguage(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = new Error('AI stream request failed') as Error & { response: { status: number } }
    err.response = { status: response.status }
    throw err
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue
        const parsed = JSON.parse(jsonStr) as { token?: string; done?: boolean; error?: string }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.done)  return
        if (parsed.token) yield parsed.token
      }
    }
  } finally {
    reader.releaseLock()
  }
}
