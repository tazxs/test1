/**
 * HalykPayService — fetches merchant payment history via Halyk ePay API.
 *
 * API base: https://epay.homebank.kz
 * Docs: https://epayment.kz/en-US/docs/mobile_sdk_documentation
 *
 * NOTE: PCI DSS certification required for production ePay integration.
 * Verify exact field names + endpoint paths against current official docs.
 */
import { logger } from '@utils/logger'
import { InternalError } from '@utils/errors'

const BASE_URL = 'https://epay.homebank.kz'
const REQUEST_TIMEOUT = 15_000

// ── Halyk API response types ────────────────────────────────────────────────────

interface HalykTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

interface HalykTransaction {
  id?: string
  invoiceId?: string
  amount?: number
  currency?: string
  dateTime?: string      // ISO string e.g. "2025-03-15T10:22:00"
  description?: string
  status?: string
  merchant?: { name?: string }
}

interface HalykTransactionsResponse {
  data?: HalykTransaction[]
  total?: number
  page?: number
  pageSize?: number
}

// ── Helper ──────────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, opts: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(tid))
}

// ── Service ─────────────────────────────────────────────────────────────────────

export class HalykPayService {
  /** OAuth2 client_credentials flow → bearer token. */
  async getAccessToken(clientId: string, clientSecret: string): Promise<{ token: string; expiresAt: Date }> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    let resp: Response
    try {
      resp = await fetchWithTimeout(`${BASE_URL}/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'webapi usermanagement payment statement',
        }).toString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('HalykPay auth: network error', { error: msg })
      throw new InternalError('Не удалось подключиться к Halyk ePay API')
    }

    if (!resp.ok) {
      logger.error('HalykPay auth: non-2xx', { status: resp.status })
      if (resp.status === 401 || resp.status === 400) {
        throw new InternalError('Неверный Client ID или Client Secret Halyk ePay')
      }
      throw new InternalError(`Halyk ePay авторизация: ошибка ${resp.status}`)
    }

    const json = await resp.json() as HalykTokenResponse
    if (!json.access_token) {
      throw new InternalError('Halyk ePay вернул пустой токен')
    }

    const ttl = json.expires_in ?? 86_400
    const expiresAt = new Date(Date.now() + ttl * 1000)

    return { token: json.access_token, expiresAt }
  }

  /** Fetch completed transactions in date range — single page (up to 500). */
  private async fetchTransactionsPage(
    token: string,
    from: Date,
    to: Date,
    page: number,
  ): Promise<HalykTransactionsResponse> {
    const params = new URLSearchParams({
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
      status: 'SUCCESS',
      page: String(page),
      size: '500',
    })

    let resp: Response
    try {
      resp = await fetchWithTimeout(`${BASE_URL}/api/v1/transactions?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('HalykPay transactions: network error', { error: msg })
      throw new InternalError('Ошибка сети при получении платежей Halyk ePay')
    }

    if (!resp.ok) {
      logger.error('HalykPay transactions: non-2xx', { status: resp.status })
      throw new InternalError(`Halyk ePay: ошибка при загрузке платежей (${resp.status})`)
    }

    return resp.json() as Promise<HalykTransactionsResponse>
  }

  /**
   * Authenticate + pull all successful transactions since `since`.
   * Returns rows compatible with BankService.importStatement.
   */
  async syncTransactions(
    clientId: string,
    clientSecret: string,
    since: Date,
  ): Promise<{ rows: Array<{ date: string; description: string; amount: number }>; token: string; expiresAt: Date }> {
    const { token, expiresAt } = await this.getAccessToken(clientId, clientSecret)

    const to = new Date()
    const allTxs: HalykTransaction[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const resp = await this.fetchTransactionsPage(token, since, to, page)
      const items = resp.data ?? []
      allTxs.push(...items)

      const pageSize = resp.pageSize ?? 500
      hasMore = items.length >= pageSize && page < 9 // safety: max 5000 txs
      page++
    }

    const rows = allTxs.map((tx): { date: string; description: string; amount: number } => {
      const dateStr = tx.dateTime
        ? tx.dateTime.slice(0, 10)
        : new Date().toISOString().slice(0, 10)

      const amount = tx.amount ?? 0
      const invoiceId = tx.invoiceId ?? tx.id ?? '?'
      const desc = tx.description ?? tx.merchant?.name
      const description = desc
        ? `Halyk ePay: ${desc} (${invoiceId})`
        : `Halyk ePay: платёж ${invoiceId}`

      return { date: dateStr, description, amount }
    })

    logger.info('HalykPay sync complete', { clientId, count: rows.length })
    return { rows, token, expiresAt }
  }
}

export const halykPayService = new HalykPayService()
