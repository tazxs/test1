/**
 * KaspiPayService — fetches merchant payment history via Kaspi Pay merchant API.
 *
 * API base: https://kaspi.kz/online
 * Docs: https://guide.kaspi.kz/partner/ru/shop/api/general/q3192
 *
 * NOTE: Kaspi uses IPSec VPN for production. For development/staging, sandbox endpoints
 * may differ. Verify exact field names against the current official documentation before
 * going live.
 */
import { logger } from '@utils/logger'
import { InternalError } from '@utils/errors'

const BASE_URL = 'https://kaspi.kz/online'
const REQUEST_TIMEOUT = 15_000 // ms

// ── Kaspi API response types ────────────────────────────────────────────────────

interface KaspiTokenResponse {
  accessToken: string  // "Bearer xxxx"
  expiresIn?: number   // seconds
}

interface KaspiOrder {
  id: string
  code?: string
  totalPrice?: number
  status?: string
  attributes?: {
    creationDate?: number   // epoch ms
    totalPrice?: number
    customer?: { name?: string }
  }
}

interface KaspiOrdersResponse {
  data?: KaspiOrder[]
  meta?: {
    pageCount?: number
    total?: number
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, opts: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(tid))
}

// ── Service ────────────────────────────────────────────────────────────────────

export class KaspiPayService {
  /** Authenticate with client credentials → return bearer token string. */
  async getAccessToken(merchantId: string, clientSecret: string): Promise<{ token: string; expiresAt: Date }> {
    let resp: Response
    try {
      resp = await fetchWithTimeout(`${BASE_URL}/api/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          grantType: 'CLIENT_CREDENTIALS',
          clientId: merchantId,
          clientSecret,
        }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('KaspiPay auth: network error', { error: msg })
      throw new InternalError('Не удалось подключиться к Kaspi Pay API')
    }

    if (!resp.ok) {
      logger.error('KaspiPay auth: non-2xx', { status: resp.status })
      if (resp.status === 401 || resp.status === 403) {
        throw new InternalError('Неверный Merchant ID или Client Secret Kaspi Pay')
      }
      throw new InternalError(`Kaspi Pay авторизация: ошибка ${resp.status}`)
    }

    const json = await resp.json() as KaspiTokenResponse
    if (!json.accessToken) {
      throw new InternalError('Kaspi Pay вернул пустой токен')
    }

    // Strip "Bearer " prefix if present
    const token = json.accessToken.startsWith('Bearer ')
      ? json.accessToken.slice(7)
      : json.accessToken

    const ttl = json.expiresIn ?? 86_400 // default 24h
    const expiresAt = new Date(Date.now() + ttl * 1000)

    return { token, expiresAt }
  }

  /** Fetch completed orders in [from, to] date range — handles single page (up to 500). */
  private async fetchOrdersPage(
    token: string,
    from: Date,
    to: Date,
    page: number,
  ): Promise<KaspiOrdersResponse> {
    const params = new URLSearchParams({
      status: 'COMPLETED',
      startDate: String(from.getTime()),
      endDate: String(to.getTime()),
      'page[number]': String(page),
      'page[size]': '500',
    })

    let resp: Response
    try {
      resp = await fetchWithTimeout(`${BASE_URL}/api/v2/orders?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('KaspiPay orders: network error', { error: msg })
      throw new InternalError('Ошибка сети при получении платежей Kaspi Pay')
    }

    if (!resp.ok) {
      logger.error('KaspiPay orders: non-2xx', { status: resp.status })
      throw new InternalError(`Kaspi Pay: ошибка при загрузке платежей (${resp.status})`)
    }

    return resp.json() as Promise<KaspiOrdersResponse>
  }

  /**
   * Authenticate + pull all completed orders since `since`.
   * Returns rows compatible with BankService.importStatement.
   */
  async syncTransactions(
    merchantId: string,
    clientSecret: string,
    since: Date,
  ): Promise<{ rows: Array<{ date: string; description: string; amount: number }>; token: string; expiresAt: Date }> {
    const { token, expiresAt } = await this.getAccessToken(merchantId, clientSecret)

    const to = new Date()
    const allOrders: KaspiOrder[] = []
    let page = 0
    let totalPages = 1

    while (page < totalPages) {
      const resp = await this.fetchOrdersPage(token, since, to, page)
      if (resp.data) allOrders.push(...resp.data)
      totalPages = resp.meta?.pageCount ?? 1
      page++
      if (page >= 10) break // safety limit: max 5000 orders
    }

    const rows = allOrders.map((order): { date: string; description: string; amount: number } => {
      // creationDate may live at top-level or in attributes
      const epochMs = order.attributes?.creationDate ?? 0
      const date = epochMs
        ? new Date(epochMs).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)

      const amount = order.totalPrice ?? order.attributes?.totalPrice ?? 0
      const code = order.code ?? order.id
      const customer = order.attributes?.customer?.name
      const description = customer
        ? `Kaspi Pay: ${customer} (${code})`
        : `Kaspi Pay: заказ ${code}`

      return { date, description, amount }
    })

    logger.info('KaspiPay sync complete', { merchantId, count: rows.length })
    return { rows, token, expiresAt }
  }
}

export const kaspiPayService = new KaspiPayService()
