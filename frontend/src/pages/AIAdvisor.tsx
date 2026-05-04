import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { AIAdviceTip, AIChatMessage } from 'nalogai-shared/types/ai.types'
import { useAuthStore, getEffectivePlan } from '@store/authStore'
import { getAdviceApi, chatStreamApi } from '@api/ai.api'
import { cn } from '@utils/cn'
import { toast } from '@store/notificationStore'

const FALLBACK_DISCLAIMER = 'Информационный совет, не юридическая гарантия. Проконсультируйтесь с аудитором.'

const FALLBACK_TIPS: AIAdviceTip[] = [
  {
    id: 'tip1',
    type: 'DEDUCTION_OPPORTUNITY',
    title: 'Вычет за оборудование',
    description:
      'Вы можете списать покупку ноутбука и наушников как производственные расходы (ст. 242 НК РК)',
    disclaimer: FALLBACK_DISCLAIMER,
    potentialSaving: 12400,
    actionLabel: 'Применить',
    isApplicable: true,
  },
  {
    id: 'tip2',
    type: 'DEDUCTION_OPPORTUNITY',
    title: 'Офисная аренда',
    description:
      'Расходы на коворкинг полностью вычитаются из налогооблагаемой базы (ст. 242 НК РК)',
    disclaimer: FALLBACK_DISCLAIMER,
    potentialSaving: 13500,
    actionLabel: 'Применить',
    isApplicable: true,
  },
  {
    id: 'tip3',
    type: 'REGIME_OPTIMIZATION',
    title: 'Оптимальный режим',
    description:
      'При вашем доходе упрощённая декларация (3%) остаётся выгоднее ЕСП (ст. 686, ст. 774 НК РК)',
    disclaimer: FALLBACK_DISCLAIMER,
    potentialSaving: 8300,
    actionLabel: 'Сменить режим',
    isApplicable: true,
  },
]

const SUGGESTED_QUESTIONS = [
  'Как уменьшить налог на ИП?',
  'Какой режим мне подходит?',
  'Можно ли списать аренду?',
  'Когда следующий дедлайн?',
]

const TIP_ICONS: Record<string, { icon: string; bg: string }> = {
  DEDUCTION_OPPORTUNITY: { icon: '💰', bg: 'rgba(0,232,122,0.12)' },
  REGIME_OPTIMIZATION: { icon: '⚖️', bg: 'rgba(0,178,255,0.12)' },
  EXPENSE_CATEGORIZATION: { icon: '⏰', bg: 'rgba(255,184,0,0.12)' },
  DEADLINE_ALERT: { icon: '⏰', bg: 'rgba(255,184,0,0.12)' },
  GENERAL_TIP: { icon: '📈', bg: 'rgba(165,120,255,0.12)' },
}

// ── Upgrade prompt ─────────────────────────────────────────────────────────────
function UpgradePrompt() {
  const navigate = useNavigate()
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div
        className="w-20 h-20 rounded-[20px] flex items-center justify-center mb-6 text-4xl"
        style={{ background: 'rgba(0,232,122,0.1)' }}
      >
        🤖
      </div>
      <h2 className="font-display text-[28px] text-white mb-3">AI-советник</h2>
      <p className="font-body text-[16px] text-white-dim max-w-[400px] mb-8">
        Получите персональные рекомендации по оптимизации налогов с помощью AI
      </p>
      <div className="flex flex-col gap-3 mb-8 text-left w-full max-w-[320px]">
        {[
          'Персональные советы по вашим транзакциям',
          'Поиск упущенных налоговых вычетов',
          'Чат-консультант 24/7 по налогам РК',
        ].map((f) => (
          <div key={f} className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-green/10 text-green text-[11px] flex items-center justify-center shrink-0">
              ✓
            </span>
            <span className="font-body text-[14px] text-white">{f}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/settings?tab=plan')}
        className="bg-green hover:bg-green-dim text-navy font-body font-semibold text-[15px] px-8 py-3 rounded-xl transition-colors duration-150 mb-3"
      >
        Обновить до Pro+AI
      </button>
      <p className="font-body text-[14px] text-white-dim">от $19.99/мес</p>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-6">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
        style={{ background: 'rgba(0,232,122,0.1)' }}
      >
        🤖
      </div>
      <div className="bg-navy-3 border border-border px-5 py-4 rounded-[4px_14px_14px_14px]">
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white-dim"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Chat message ───────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: AIChatMessage }) {
  const isAI = msg.role === 'assistant'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 mb-6', !isAI && 'flex-row-reverse')}
    >
      {isAI && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
          style={{ background: 'rgba(0,232,122,0.1)' }}
        >
          🤖
        </div>
      )}
      <div
        className={cn(
          'font-body text-[15px] text-white px-4 py-4 max-w-[80%]',
          isAI
            ? 'bg-navy-3 border border-border rounded-[4px_14px_14px_14px]'
            : 'bg-navy-4 border border-border rounded-[14px_14px_4px_14px] max-w-[70%]'
        )}
        style={isAI ? { borderLeft: '3px solid #00E87A' } : undefined}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function AIAdvisor() {
  const authState = useAuthStore()
  const isPROAI = getEffectivePlan(authState) === 'PRO_AI'

  const [tips, setTips] = useState<AIAdviceTip[]>(FALLBACK_TIPS)
  const [tipsLoading, setTipsLoading] = useState(false)
  const [selectedTip, setSelectedTip] = useState<string>(
    FALLBACK_TIPS[0]?.id ?? ''
  )

  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load AI advice from real API
  const loadAdvice = useCallback(async () => {
    setTipsLoading(true)
    try {
      const loaded = await getAdviceApi()
      if (loaded.length > 0) {
        setTips(loaded)
        setSelectedTip(loaded[0]?.id ?? '')
        // Update welcome message with real savings figure
        const totalSaving = loaded.reduce((s, t) => s + t.potentialSaving, 0)
        setMessages([
          {
            id: 'init',
            role: 'assistant',
            content: `Привет! Я ваш AI-советник по налогам. Проанализировал ваши данные и нашёл ${loaded.length} оптимизации на сумму ${totalSaving.toLocaleString('ru-KZ')} ₸. Задайте любой вопрос или выберите рекомендацию слева.`,
            createdAt: new Date().toISOString(),
          },
        ])
      }
    } catch {
      // Keep fallback tips, set default welcome
      const totalSaving = FALLBACK_TIPS.reduce(
        (s, t) => s + t.potentialSaving,
        0
      )
      setMessages([
        {
          id: 'init',
          role: 'assistant',
          content: `Привет! Я ваш AI-советник по налогам. Нашёл ${FALLBACK_TIPS.length} оптимизации на сумму ${totalSaving.toLocaleString('ru-KZ')} ₸. Задайте любой вопрос или выберите рекомендацию слева.`,
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setTipsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAdvice()
  }, [loadAdvice])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  async function sendMessage(text: string) {
    if (!text.trim() || isTyping) return

    // Capture history before state update (messages state is stale inside async)
    const history = messages
      .filter((m) => m.id !== 'init')
      .map((m) => ({ role: m.role, content: m.content }))

    const userMsg: AIChatMessage = {
      id: `u${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    const aiMsgId = `ai_${Date.now()}`

    try {
      let started = false
      for await (const token of chatStreamApi({ message: text, history })) {
        if (!started) {
          // Add the AI bubble on first token so the typing indicator disappears
          started = true
          setMessages((prev) => [
            ...prev,
            {
              id:        aiMsgId,
              role:      'assistant' as const,
              content:   token,
              createdAt: new Date().toISOString(),
            },
          ])
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: m.content + token } : m
            )
          )
        }
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        toast.error('Чат доступен только на тарифе Pro AI')
      } else if (status === 429) {
        toast.error('Лимит запросов к AI исчерпан — попробуйте позже')
      } else {
        toast.error('Ошибка AI — попробуйте ещё раз')
      }
    } finally {
      setIsTyping(false)
    }
  }

  function applyTip(tip: AIAdviceTip) {
    setSelectedTip(tip.id)
    if (!isPROAI) {
      toast.error('Чат доступен только на тарифе Pro AI')
      return
    }
    void sendMessage(
      `Помоги применить рекомендацию «${tip.title}». ${tip.description} Расскажи пошагово, что именно мне нужно сделать, чтобы сэкономить ${tip.potentialSaving.toLocaleString('ru-KZ')} ₸.`
    )
  }

  const totalSaving = tips.reduce((s, t) => s + t.potentialSaving, 0)

  return (
    <div className="flex h-screen overflow-hidden bg-navy">
      {/* Left panel — advice cards */}
      <div className="w-[360px] shrink-0 bg-navy-2 border-r border-border flex flex-col overflow-hidden max-lg:hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-body font-semibold text-[18px] text-white">
            Рекомендации
          </h2>
          <p className="font-mono text-[14px] text-green mt-1">
            Потенциальная экономия: {totalSaving.toLocaleString('ru-KZ')} ₸
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {tipsLoading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-navy-3 border border-border rounded-[14px] p-5 animate-pulse"
                >
                  <div className="w-10 h-10 rounded-xl bg-navy-4 mb-3" />
                  <div className="h-4 bg-navy-4 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-navy-4 rounded w-full mb-1" />
                  <div className="h-3 bg-navy-4 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}
          {!tipsLoading &&
            tips.map((tip) => {
              const icon = TIP_ICONS[tip.type] ?? TIP_ICONS['GENERAL_TIP']!
              const isSelected = selectedTip === tip.id
              return (
                <motion.button
                  key={tip.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedTip(tip.id)}
                  className={cn(
                    'w-full text-left bg-navy-3 border rounded-[14px] p-5 transition-all duration-200',
                    isSelected
                      ? 'border-green'
                      : 'border-border hover:border-green/20'
                  )}
                  style={
                    isSelected
                      ? { background: 'rgba(0,232,122,0.03)' }
                      : undefined
                  }
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
                    style={{ background: icon.bg }}
                  >
                    {icon.icon}
                  </div>
                  <p className="font-body font-semibold text-[15px] text-white">
                    {tip.title}
                  </p>
                  <p className="font-body text-[13px] text-white-dim mt-1 line-clamp-2">
                    {tip.description}
                  </p>
                  {/* Saving + primary action */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono font-medium text-[14px] text-green">
                      {tip.potentialSaving > 0 ? `−${tip.potentialSaving.toLocaleString('ru-KZ')} ₸` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        applyTip(tip)
                      }}
                      className="font-body text-[13px] font-medium text-navy bg-green hover:bg-green-dim px-3.5 py-1.5 rounded-lg transition-colors duration-150"
                    >
                      {tip.actionLabel}
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Link
                      to="/declarations?form=FORM_910"
                      onClick={(e) => e.stopPropagation()}
                      className="font-body text-[11px] font-medium text-white-dim bg-navy-4 hover:text-white hover:bg-navy px-2.5 py-1 rounded-lg transition-colors duration-150 border border-border"
                    >
                      Посчитать выгоду
                    </Link>
                    {tip.type === 'REGIME_OPTIMIZATION' && (
                      <Link
                        to="/settings?tab=tax"
                        onClick={(e) => e.stopPropagation()}
                        className="font-body text-[11px] font-medium text-amber hover:text-white bg-navy-4 hover:bg-navy px-2.5 py-1 rounded-lg transition-colors duration-150 border border-border"
                      >
                        Сменить режим
                      </Link>
                    )}
                    {tip.sources && tip.sources.length > 0 && (
                      <span className="font-mono text-[10px] text-white-dim/60 px-2 py-1 rounded bg-navy-4 border border-border">
                        {tip.sources[0]!.articleNumber}
                      </span>
                    )}
                  </div>

                  {/* Legal disclaimer */}
                  {tip.disclaimer && (
                    <p className="font-body text-[10px] text-white-dim/50 mt-2 leading-relaxed">
                      {tip.disclaimer}
                    </p>
                  )}
                </motion.button>
              )
            })}
        </div>
      </div>

      {/* Right panel — chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isPROAI ? (
          <UpgradePrompt />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} />
                ))}
              </AnimatePresence>
              {isTyping && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested questions */}
            <div className="px-8 py-3 flex gap-2 overflow-x-auto scrollbar-none border-t border-border/50">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  className="shrink-0 bg-navy-3 border border-border rounded-full px-4 py-2 font-body text-[13px] text-white-dim hover:border-green hover:text-white transition-all duration-150 whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 px-8 py-4 border-t border-border bg-navy-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendMessage(input)
                  }
                }}
                placeholder="Задайте вопрос о налогах..."
                className="flex-1 bg-navy-4 border border-border rounded-xl px-4 py-3.5 font-body text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-green/50 transition-colors duration-150"
              />
              <button
                type="button"
                disabled={!input.trim() || isTyping}
                onClick={() => void sendMessage(input)}
                className="w-12 h-12 rounded-xl bg-green hover:bg-green-dim disabled:opacity-30 flex items-center justify-center transition-all duration-150 shrink-0"
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#060C1A"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
