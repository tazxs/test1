/// <reference types="vite/client" />
import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { toast } from '@store/notificationStore'
import { cn } from '@utils/cn'
import { importStatementApi, connectMerchantApi } from '@api/banks.api'
import { parseBankPdf } from '@utils/pdfParser'
import { apiFetchTransactions } from '@api/transactions'
import { useTransactionStore } from '@store/transactionStore'
import { useAuthStore } from '@store/authStore'
import type { Transaction } from 'nalogai-shared/types/transaction.types'

// ── Types ──────────────────────────────────────────────────────────────────────
export type BankProvider = 'KASPI' | 'HALYK'

interface ParsedRow {
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // positive = income, negative = expense
}

interface Props {
  open: boolean
  provider: BankProvider
  onClose: () => void
  onConnected: (masked: string) => void
}

// ── Bank metadata ──────────────────────────────────────────────────────────────
interface BankMeta {
  name: string
  logo: string
  statementUrl: string
  acceptsPdf: boolean
  hasApiConnect: boolean  // Kaspi & Halyk support merchant API
  apiLabel: string
  formatHint: string
  formatExample: string
}

const BANK_META: Record<BankProvider, BankMeta> = {
  KASPI: {
    name: 'Kaspi Bank',
    logo: '🔴',
    statementUrl: 'https://kaspi.kz/bank/transfer/history/',
    acceptsPdf: true,
    hasApiConnect: true,
    apiLabel: 'Kaspi Pay (мерчант)',
    formatHint: 'Kaspi предоставляет выписки только в формате PDF',
    formatExample: 'Дата · Описание · Приход · Расход · Баланс',
  },
  HALYK: {
    name: 'Halyk Bank',
    logo: '🟢',
    statementUrl: 'https://homebank.kz/statements',
    acceptsPdf: true,
    hasApiConnect: true,
    apiLabel: 'Halyk ePay (мерчант)',
    formatHint: 'HomeBank предоставляет выписки только в формате PDF',
    formatExample: 'Дата · Операция · Дебет · Кредит · Баланс',
  },
}

// ── Step: mode selection (API vs PDF) ─────────────────────────────────────────
function ModeSelectStep({
  provider,
  onSelectApi,
  onSelectPdf,
}: {
  provider: BankProvider
  onSelectApi: () => void
  onSelectPdf: () => void
}) {
  const meta = BANK_META[provider]
  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-[14px] text-white-dim">
        Выберите способ подключения {meta.name}:
      </p>

      {/* API option */}
      <button
        type="button"
        onClick={onSelectApi}
        className="w-full rounded-xl border border-border bg-navy-4 hover:border-green/40 hover:bg-[rgba(0,232,122,0.04)] p-4 text-left transition-all duration-150 group"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[rgba(0,232,122,0.12)] flex items-center justify-center text-lg shrink-0">
            🔗
          </div>
          <div>
            <p className="font-body font-semibold text-[14px] text-white group-hover:text-green transition-colors">
              Merchant API — {meta.apiLabel}
            </p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">
              Автоматическая синхронизация платежей. Нужен Merchant ID и Client Secret.
            </p>
            <span className="inline-block mt-1.5 font-mono text-[11px] text-green bg-[rgba(0,232,122,0.08)] px-2 py-0.5 rounded">
              Рекомендуется · авто-обновление
            </span>
          </div>
        </div>
      </button>

      {/* PDF option */}
      <button
        type="button"
        onClick={onSelectPdf}
        className="w-full rounded-xl border border-border bg-navy-4 hover:border-white/20 p-4 text-left transition-all duration-150 group"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy-3 flex items-center justify-center text-lg shrink-0">
            📑
          </div>
          <div>
            <p className="font-body font-semibold text-[14px] text-white">
              PDF выписка — загрузить вручную
            </p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">
              Скачайте выписку из приложения банка и загрузите сюда.
            </p>
            <span className="inline-block mt-1.5 font-mono text-[11px] text-white-dim bg-navy-3 px-2 py-0.5 rounded">
              Без регистрации · одноразово
            </span>
          </div>
        </div>
      </button>
    </div>
  )
}

// ── Step: API credentials form ─────────────────────────────────────────────────
function ApiConnectStep({
  provider,
  onConnected,
}: {
  provider: 'KASPI' | 'HALYK'
  onConnected: (masked: string) => void
}) {
  const meta = BANK_META[provider]
  const [merchantId, setMerchantId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const docsUrl = provider === 'KASPI'
    ? 'https://guide.kaspi.kz/partner/ru/shop/api/general/q3192'
    : 'https://epayment.kz/en-US/docs/mobile_sdk_documentation'

  async function handleConnect() {
    if (!merchantId.trim() || !clientSecret.trim()) {
      setError('Заполните оба поля')
      return
    }
    setLoading(true)
    setError('')
    try {
      await connectMerchantApi(provider, merchantId.trim(), clientSecret.trim())
      toast.success(`${meta.name} подключён через API`)
      onConnected(merchantId.trim().slice(0, 20))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка подключения'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Info block */}
      <div
        className="rounded-xl px-4 py-4"
        style={{ background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.15)' }}
      >
        <p className="font-body font-semibold text-[14px] text-white mb-1.5">
          Как получить API-ключи {meta.apiLabel}
        </p>
        <ol className="flex flex-col gap-1.5">
          {provider === 'KASPI' ? (
            <>
              <li className="font-body text-[13px] text-white-dim">1. Зайдите в <span className="text-white">Kaspi Business</span> → Магазин → API</li>
              <li className="font-body text-[13px] text-white-dim">2. Скопируйте <span className="text-white">Client ID</span> (Merchant ID) и <span className="text-white">Client Secret</span></li>
              <li className="font-body text-[13px] text-white-dim">3. Вставьте их ниже</li>
            </>
          ) : (
            <>
              <li className="font-body text-[13px] text-white-dim">1. Зайдите в <span className="text-white">epayment.kz</span> → Личный кабинет → API настройки</li>
              <li className="font-body text-[13px] text-white-dim">2. Скопируйте <span className="text-white">Client ID</span> и <span className="text-white">Client Secret</span></li>
              <li className="font-body text-[13px] text-white-dim">3. Вставьте их ниже</li>
            </>
          )}
        </ol>
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 font-body text-[13px] text-green hover:text-green-dim transition-colors"
        >
          Документация {meta.apiLabel} →
        </a>
      </div>

      {/* Form */}
      <Input
        label="Client ID (Merchant ID)"
        value={merchantId}
        onChange={(e) => setMerchantId(e.target.value)}
        placeholder="Например: MERCHANT-12345"
        hint="Уникальный идентификатор вашего магазина"
      />
      <Input
        type="password"
        label="Client Secret"
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        placeholder="••••••••••••••••"
        hint="Секретный ключ — не передавайте его третьим лицам"
      />

      {error && (
        <p className="font-body text-[13px] text-red">{error}</p>
      )}

      <div
        className="rounded-xl px-4 py-3 flex items-start gap-2.5"
        style={{ background: 'rgba(240,244,255,0.04)', border: '1px solid rgba(240,244,255,0.08)' }}
      >
        <span className="text-[14px] mt-0.5">🔒</span>
        <p className="font-body text-[12px] text-white-dim">
          Ключи хранятся зашифрованно и используются только для получения ваших платежей.
          Импортируются только <span className="text-white">входящие платежи</span> (доходы).
        </p>
      </div>

      <Button
        variant="primary"
        size="md"
        loading={loading}
        disabled={!merchantId.trim() || !clientSecret.trim()}
        onClick={() => void handleConnect()}
      >
        Подключить и синхронизировать
      </Button>
    </div>
  )
}

// ── Step 1 — instructions ─────────────────────────────────────────────────────
function InstructionsStep({ provider, onNext }: { provider: BankProvider; onNext: () => void }) {
  const meta = BANK_META[provider]

  const steps = [
    `Зайдите в ${meta.name} (приложение или веб)`,
    'Откройте «История операций» / «Выписка»',
    'Выберите нужный период (квартал или месяц)',
    'Скачайте выписку в формате PDF',
  ]

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-xl px-4 py-4"
        style={{ background: 'rgba(0,178,255,0.06)', border: '1px solid rgba(0,178,255,0.15)' }}
      >
        <p className="font-body font-semibold text-[14px] text-white mb-2">
          Как скачать выписку из {meta.name}
        </p>
        <ol className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-navy-4 font-mono text-[11px] text-white-dim flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="font-body text-[13px] text-white-dim">{step}</span>
            </li>
          ))}
        </ol>
        <a
          href={meta.statementUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-3 font-body text-[13px] text-green hover:text-green-dim transition-colors"
        >
          Открыть {meta.name} →
        </a>
      </div>

      <div
        className="rounded-xl px-4 py-3"
        style={{ background: 'rgba(240,244,255,0.04)', border: '1px solid rgba(240,244,255,0.08)' }}
      >
        <p className="font-body text-[12px] text-white-dim mb-1">
          Формат PDF:
        </p>
        <p className="font-mono text-[11px] text-white-dim">{meta.formatHint}</p>
        <p className="font-mono text-[11px] text-white/40 mt-1">{meta.formatExample}</p>
      </div>

      <Button variant="primary" size="md" onClick={onNext}>
        Далее — загрузить выписку
      </Button>
    </div>
  )
}

// ── Step 2 — upload & parse ───────────────────────────────────────────────────
function UploadStep({ provider, onImported }: { provider: BankProvider; onImported: (masked: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const { addBulk, setTransactions } = useTransactionStore()
  const { user } = useAuthStore()

  async function handleFile(file: File) {
    setError('')
    setFileName(file.name)
    setRows([])
    setParsing(true)
    try {
      const parsed = await parseBankPdf(file, provider)
      if (parsed.length === 0) {
        setError(
          'Не удалось распознать транзакции. Убедитесь, что загружена корректная банковская выписка.',
        )
        return
      }
      setRows(parsed)
    } catch {
      setError('Ошибка чтения файла. Попробуйте ещё раз.')
    } finally {
      setParsing(false)
    }
  }

  function toTransactions(parsedRows: ParsedRow[]): Transaction[] {
    return parsedRows.map((r, i) => {
      const type = r.amount >= 0 ? 'INCOME' as const : 'EXPENSE' as const
      const amount = Math.abs(r.amount)
      const externalId = `${provider}|${r.date}|${r.description.slice(0, 50)}|${amount}`
      return {
        id: `imported_${Date.now()}_${i}`,
        userId: user?.id ?? '',
        amount,
        type,
        category: 'UNCATEGORIZED' as const,
        description: r.description,
        source: provider as Transaction['source'],
        externalId,
        aiConfidence: null,
        date: r.date,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  async function handleImport() {
    setImporting(true)
    setError('')
    try {
      // 1. Save to database — this is the critical step
      const result = await importStatementApi(provider, rows)

      // 2. Try to reload from backend to get real server IDs (best-effort)
      try {
        const fresh = await apiFetchTransactions()
        if (user?.id) setTransactions(fresh, user.id)
        else addBulk(toTransactions(rows))
      } catch {
        // Refresh failed but save succeeded — show data locally
        addBulk(toTransactions(rows))
      }

      if (result.imported === 0) {
        toast.success('Транзакции уже были импортированы ранее')
      } else {
        toast.success(`Сохранено ${result.imported} из ${rows.length} транзакций`)
      }
      const masked = '**** ' + String(Math.floor(1000 + Math.random() * 9000))
      onImported(masked)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения транзакций'
      setError(msg)
      toast.error('Не удалось сохранить транзакции. Проверьте подключение.')
    } finally {
      setImporting(false)
    }
  }

  const accept = '.pdf'
  const income = rows.filter((r) => r.amount > 0)
  const expense = rows.filter((r) => r.amount < 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className={cn(
          'rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 cursor-pointer transition-colors duration-150',
          rows.length > 0
            ? 'border-green/40 bg-[rgba(0,232,122,0.04)]'
            : 'border-border hover:border-white/30',
        )}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) void handleFile(f)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />
        {parsing ? (
          <>
            <span className="text-2xl mb-2 animate-spin">⚙️</span>
            <p className="font-body text-[14px] text-white">Распознаём транзакции из PDF…</p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">Это может занять несколько секунд</p>
          </>
        ) : rows.length > 0 ? (
          <>
            <span className="text-2xl mb-2">✅</span>
            <p className="font-body font-medium text-[14px] text-white">{fileName}</p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">{rows.length} транзакций распознано</p>
          </>
        ) : (
          <>
            <span className="text-2xl mb-2 text-white-dim">📑</span>
            <p className="font-body font-medium text-[14px] text-white">
              Перетащите PDF файл или нажмите
            </p>
            <p className="font-body text-[12px] text-white-dim mt-0.5">
              PDF-выписка из банка
            </p>
          </>
        )}
      </div>

      {error && <p className="font-body text-[13px] text-red">{error}</p>}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="flex gap-4 px-4 py-3 bg-navy-4 border-b border-border">
            <div>
              <p className="font-body text-[11px] text-white-dim">Доходы</p>
              <p className="font-mono text-[14px] text-green">
                +{income.reduce((s, r) => s + r.amount, 0).toLocaleString('ru-KZ')} ₸
              </p>
            </div>
            <div>
              <p className="font-body text-[11px] text-white-dim">Расходы</p>
              <p className="font-mono text-[14px] text-red">
                {expense.reduce((s, r) => s + r.amount, 0).toLocaleString('ru-KZ')} ₸
              </p>
            </div>
            <div>
              <p className="font-body text-[11px] text-white-dim">Транзакций</p>
              <p className="font-mono text-[14px] text-white">{rows.length}</p>
            </div>
          </div>

          <div className="max-h-[160px] overflow-y-auto">
            {rows.slice(0, 8).map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0"
              >
                <span className="font-mono text-[11px] text-white-dim w-[90px] shrink-0">{r.date}</span>
                <span className="font-body text-[12px] text-white flex-1 truncate">{r.description}</span>
                <span
                  className={cn(
                    'font-mono text-[12px] shrink-0',
                    r.amount > 0 ? 'text-green' : 'text-red',
                  )}
                >
                  {r.amount > 0 ? '+' : ''}
                  {r.amount.toLocaleString('ru-KZ')} ₸
                </span>
              </div>
            ))}
            {rows.length > 8 && (
              <p className="px-4 py-2 font-body text-[12px] text-white-dim">
                …и ещё {rows.length - 8} транзакций
              </p>
            )}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        disabled={rows.length === 0 || parsing}
        loading={importing}
        onClick={() => void handleImport()}
      >
        Импортировать {rows.length > 0 ? `${rows.length} транзакций` : ''}
      </Button>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────
type Step = 'mode-select' | 'api-connect' | 'instructions' | 'upload'

const STEP_LABELS: Record<Step, string> = {
  'mode-select':  'Способ',
  'api-connect':  'API',
  'instructions': 'Инструкция',
  'upload':       'Загрузка',
}

export function BankConnectModal({ open, provider, onClose, onConnected }: Props) {
  const meta = BANK_META[provider]
  // Banks with API connect start at mode-select; others go straight to instructions
  const initialStep: Step = meta.hasApiConnect ? 'mode-select' : 'instructions'
  const [step, setStep] = useState<Step>(initialStep)

  function handleClose() {
    setStep(initialStep)
    onClose()
  }

  // Determine which steps to show in the progress indicator
  const stepsForProvider: Step[] = meta.hasApiConnect
    ? step === 'api-connect' || step === 'mode-select'
      ? ['mode-select', 'api-connect']
      : ['mode-select', 'instructions', 'upload']
    : ['instructions', 'upload']

  const currentStepIdx = stepsForProvider.indexOf(step)

  return (
    <Modal open={open} onClose={handleClose} title={`Подключить ${meta.name}`}>
      <div className="mt-2">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {stepsForProvider.map((s, i) => {
            const done = i < currentStepIdx
            const active = s === step
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full font-mono text-[11px] flex items-center justify-center',
                    done
                      ? 'bg-green text-navy'
                      : active
                      ? 'bg-green text-navy'
                      : 'bg-navy-4 text-white-dim',
                  )}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span className={cn('font-body text-[12px]', active ? 'text-white' : 'text-white-dim')}>
                  {STEP_LABELS[s]}
                </span>
                {i < stepsForProvider.length - 1 && <span className="text-white-dim mx-1">→</span>}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 'mode-select' ? 0 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            {step === 'mode-select' && (
              <ModeSelectStep
                provider={provider}
                onSelectApi={() => setStep('api-connect')}
                onSelectPdf={() => setStep('instructions')}
              />
            )}

            {step === 'api-connect' && (provider === 'KASPI' || provider === 'HALYK') && (
              <ApiConnectStep
                provider={provider}
                onConnected={(masked) => {
                  onConnected(masked)
                  handleClose()
                }}
              />
            )}

            {step === 'instructions' && (
              <InstructionsStep provider={provider} onNext={() => setStep('upload')} />
            )}

            {step === 'upload' && (
              <UploadStep
                provider={provider}
                onImported={(masked) => {
                  onConnected(masked)
                  handleClose()
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  )
}
