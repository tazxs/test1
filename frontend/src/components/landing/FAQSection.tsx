import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FADE_UP, STAGGER_CONTAINER } from '@lib/motion'
import { cn } from '@utils/cn'

const FAQ_ITEMS = [
  {
    q: 'Безопасно ли подключать банковский счёт?',
    a: 'Да. Мы используем Open Banking API — официальный стандарт, одобренный Нацбанком РК. NalogAI получает доступ только на чтение транзакций. Мы не можем совершать платежи или переводы с вашего счёта.',
  },
  {
    q: 'Насколько точны расчёты AI?',
    a: 'Точность категоризации транзакций — 98.2%. Налоговые расчёты основаны на актуальном Налоговом кодексе РК и проверяются профессиональными бухгалтерами. Мы обновляем ставки и формулы в течение 48 часов после изменений.',
  },
  {
    q: 'Можно ли подать декларацию напрямую в eGov?',
    a: 'Да, через интеграцию с eGov.kz. На тарифе Pro+AI вы можете отправить декларацию в один клик. Система подготовит документ в формате 910.00 или 911.00 и отправит через API.',
  },
  {
    q: 'Какие банки поддерживаются?',
    a: 'Сейчас поддерживаются Kaspi Business и Halyk Bank. Forte Bank в разработке. Также можно вводить транзакции вручную или сканировать чеки через камеру.',
  },
  {
    q: 'Могу ли я отменить подписку?',
    a: 'Да, в любой момент. Отмена моментальная, без скрытых платежей. Ваши данные сохранятся на бесплатном тарифе — вы не потеряете историю транзакций.',
  },
  {
    q: 'Подходит ли NalogAI для ТОО?',
    a: 'Сейчас платформа оптимизирована для самозанятых и ИП на упрощённой декларации. Поддержка ТОО (общеустановленный режим) появится в Q3 2025.',
  },
] as const

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="bg-navy py-15 px-5 md:py-20 md:px-15" id="faq">
      <div className="max-w-[800px] mx-auto">
        <h2
          className="font-display text-[32px] md:text-[48px] text-white text-center"
          style={{ letterSpacing: '-1px' }}
        >
          Частые вопросы
        </h2>

        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-12"
        >
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem
              key={i}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function FAQItem({
  item,
  isOpen,
  onToggle,
}: {
  item: (typeof FAQ_ITEMS)[number]
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      variants={FADE_UP}
      transition={{ duration: 0.4 }}
      className="border-b border-border"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-6 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-body font-semibold text-[17px] text-white">{item.q}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('shrink-0', isOpen ? 'text-green' : 'text-white-dim')}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p
              className="font-body text-[15px] text-white-dim pb-6"
              style={{ lineHeight: 1.6 }}
            >
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
