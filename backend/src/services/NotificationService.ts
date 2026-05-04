/**
 * NotificationService — multichannel delivery for NalogAI.
 *
 * Channels:
 *   Telegram — Bot API (sendMessage with MarkdownV2)
 *   Email    — Nodemailer SMTP (HTML + plain-text fallback)
 *
 * Request and cron callers enqueue compact BullMQ jobs. Workers perform actual
 * delivery with BullMQ retries/backoff.
 *
 * PII policy: email addresses, chatIds, and any other user PII are NEVER
 * written to logs. Only userId and notification channel type are logged.
 */

import nodemailer from 'nodemailer'
import { logger } from '@utils/logger'
import { DEFAULT_LANGUAGE, detectLanguageFromParts, type SupportedLanguage } from '@utils/language'
import { taxTerm } from '@utils/taxTerminology'
import {
  enqueueNotificationJob,
  type NotificationChannel,
  type NotificationJobData,
} from '@jobs/notificationQueue'

// ── Config ────────────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TELEGRAM_API_BASE  = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Escape special characters for Telegram MarkdownV2 format.
 */
function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

// ── Nodemailer transport (lazy-initialised) ───────────────────────────────────

let _transport: nodemailer.Transporter | null = null

function getTransport(): nodemailer.Transporter {
  if (_transport) return _transport
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
  })
  return _transport
}

// ── Payload types ─────────────────────────────────────────────────────────────

export interface DeadlineReminderPayload {
  userId:      string
  fullName:    string
  email:       string
  telegramChatId: string | null
  emailNotifications: boolean
  telegramNotifications: boolean

  /** Отображаемое название дедлайна, напр. «Форма 910.00 за 1 квартал 2026» */
  deadlineName: string
  /** Тип формы, напр. 'FORM_910' */
  formType: string
  /** Дата дедлайна в формате «15 мая 2026» */
  dueDateFormatted: string
  /** Количество оставшихся дней */
  daysLeft: number
  /** Сумма налога, если рассчитана */
  taxAmount?: number
  language?: SupportedLanguage
}

interface NotificationCopy {
  deadlineReminderTitle: string
  deadlineAlertTitle: string
  urgent: string
  soon: string
  ok: string
  daysLeftIntro: (deadlineName: string, daysLeft: number) => string
  dueDate: string
  estimatedTax: string
  openAppReminder: string
  declaration: string
  deadline: string
  goToDeclarations: string
  submitDeclaration: string
  greeting: (fullName: string) => string
  emailReminderSubject: (deadlineName: string, daysLeft: number, dueDate: string) => string
  emailAlertSubject: (formType: string, period: string) => string
  alertForm: (formType: string, period: string) => string
  alertDeadline: (days: number) => string
  footer: string
  settingsHint: string
  testTelegram: string
  testTelegramBody: string
  testEmailSubject: string
  testEmailHeading: string
  testEmailBody: (fullName: string) => string
  teamSignoff: string
}

const COPY: Record<SupportedLanguage, NotificationCopy> = {
  kk: {
    deadlineReminderTitle: 'Салық мерзімі туралы еске салу',
    deadlineAlertTitle: 'Салық декларациясы туралы еске салу',
    urgent: 'ШҰҒЫЛ',
    soon: 'Жақында',
    ok: 'Қалыпты',
    daysLeftIntro: (deadlineName, daysLeft) => `${deadlineName} тапсыруға ${daysLeftPhrase(daysLeft, 'kk')}.`,
    dueDate: 'Тапсыру мерзімі',
    estimatedTax: 'Шамамен салық сомасы',
    openAppReminder: 'Декларацияны уақтылы қалыптастырып тапсыру үшін NalogAI ашыңыз.',
    declaration: taxTerm('tax_declaration', 'kk'),
    deadline: 'Мерзімі',
    goToDeclarations: 'Декларацияларға өту',
    submitDeclaration: 'Декларация тапсыру',
    greeting: (fullName) => `Құрметті ${fullName},`,
    emailReminderSubject: (deadlineName, daysLeft, dueDate) => `Еске салу: ${deadlineName} - ${daysLeftPhrase(daysLeft, 'kk')} (${dueDate} дейін)`,
    emailAlertSubject: (formType, period) => `NalogAI: ${formType} ${period} бойынша салық декларациясы туралы еске салу`,
    alertForm: (formType, period) => `Нысан: ${formType}, кезең: ${period}`,
    alertDeadline: (days) => `Тапсыру мерзімі: ${daysLeftPhrase(days, 'kk')}`,
    footer: 'Қазақстандағы бизнеске арналған салық есебін автоматтандыру',
    settingsHint: 'Хабарландыруларды басқару: Баптаулар -> Хабарландырулар.',
    testTelegram: 'NalogAI тесті',
    testTelegramBody: 'Telegram хабарландырулары жұмыс істейді. Салық мерзімдері туралы еске салуларды уақытында аласыз.',
    testEmailSubject: 'Хабарландыру тесті - NalogAI',
    testEmailHeading: 'Email хабарландырулары жұмыс істейді!',
    testEmailBody: (fullName) => `Құрметті ${fullName}, бұл тест хаты NalogAI email хабарландырулары дұрыс бапталғанын растайды.`,
    teamSignoff: 'Құрметпен, NalogAI командасы',
  },
  ru: {
    deadlineReminderTitle: 'Напоминание о налоговом дедлайне',
    deadlineAlertTitle: 'Напоминание о декларации',
    urgent: 'СРОЧНО',
    soon: 'Скоро',
    ok: 'Обычно',
    daysLeftIntro: (deadlineName, daysLeft) => `До подачи ${deadlineName} ${daysLeftPhrase(daysLeft, 'ru')}.`,
    dueDate: 'Срок подачи',
    estimatedTax: 'Примерная сумма налога',
    openAppReminder: 'Откройте NalogAI, чтобы сформировать и подать декларацию своевременно.',
    declaration: taxTerm('tax_declaration', 'ru'),
    deadline: 'Срок',
    goToDeclarations: 'Перейти к декларациям',
    submitDeclaration: 'Подать декларацию',
    greeting: (fullName) => `Уважаемый(-ая) ${fullName},`,
    emailReminderSubject: (deadlineName, daysLeft, dueDate) => `Напоминание: ${deadlineName} - ${daysLeftPhrase(daysLeft, 'ru')} (до ${dueDate})`,
    emailAlertSubject: (formType, period) => `NalogAI: Напоминание о декларации ${formType} за ${period}`,
    alertForm: (formType, period) => `Форма: ${formType} за ${period}`,
    alertDeadline: (days) => `Срок подачи: ${daysLeftPhrase(days, 'ru')}`,
    footer: 'автоматизация налогового учёта для бизнеса в Казахстане',
    settingsHint: 'Управление уведомлениями: Настройки -> Уведомления.',
    testTelegram: 'Тест NalogAI',
    testTelegramBody: 'Уведомления через Telegram работают! Вы будете получать напоминания о налоговых дедлайнах своевременно.',
    testEmailSubject: 'Тест уведомлений - NalogAI',
    testEmailHeading: 'Email-уведомления работают!',
    testEmailBody: (fullName) => `Уважаемый(-ая) ${fullName}, это тестовое письмо подтверждает, что email-уведомления от NalogAI настроены корректно.`,
    teamSignoff: 'С уважением, команда NalogAI',
  },
  en: {
    deadlineReminderTitle: 'Tax deadline reminder',
    deadlineAlertTitle: 'Declaration reminder',
    urgent: 'URGENT',
    soon: 'Soon',
    ok: 'Normal',
    daysLeftIntro: (deadlineName, daysLeft) => `${deadlineName}: ${daysLeftPhrase(daysLeft, 'en')}.`,
    dueDate: 'Due date',
    estimatedTax: 'Estimated tax amount',
    openAppReminder: 'Open NalogAI to prepare and submit the declaration on time.',
    declaration: taxTerm('tax_declaration', 'en'),
    deadline: 'Deadline',
    goToDeclarations: 'Go to declarations',
    submitDeclaration: 'Submit declaration',
    greeting: (fullName) => `Dear ${fullName},`,
    emailReminderSubject: (deadlineName, daysLeft, dueDate) => `Reminder: ${deadlineName} - ${daysLeftPhrase(daysLeft, 'en')} (${dueDate})`,
    emailAlertSubject: (formType, period) => `NalogAI: Declaration reminder for ${formType}, ${period}`,
    alertForm: (formType, period) => `Form: ${formType} for ${period}`,
    alertDeadline: (days) => `Deadline: ${daysLeftPhrase(days, 'en')}`,
    footer: 'tax accounting automation for businesses in Kazakhstan',
    settingsHint: 'Manage notifications: Settings -> Notifications.',
    testTelegram: 'NalogAI test',
    testTelegramBody: 'Telegram notifications are working. You will receive tax deadline reminders on time.',
    testEmailSubject: 'Notification test - NalogAI',
    testEmailHeading: 'Email notifications are working!',
    testEmailBody: (fullName) => `Dear ${fullName}, this test email confirms that NalogAI email notifications are configured correctly.`,
    teamSignoff: 'Regards, the NalogAI team',
  },
}

function copyFor(language: SupportedLanguage | undefined): NotificationCopy {
  return COPY[language ?? DEFAULT_LANGUAGE] ?? COPY[DEFAULT_LANGUAGE]
}

function languageForPayload(p: Pick<DeadlineReminderPayload, 'language' | 'fullName' | 'deadlineName' | 'dueDateFormatted'>): SupportedLanguage {
  return p.language ?? detectLanguageFromParts([p.fullName, p.deadlineName, p.dueDateFormatted], DEFAULT_LANGUAGE)
}

// ── Template builders ─────────────────────────────────────────────────────────

function buildTelegramText(p: DeadlineReminderPayload): string {
  const lang = languageForPayload(p)
  const copy = copyFor(lang)
  const urgency = p.daysLeft < 7 ? `🔴 ${copy.urgent}` : p.daysLeft <= 30 ? `🟡 ${copy.soon}` : '🟢'
  const lines: string[] = [
    `🔔 *${escapeMd(copy.deadlineReminderTitle)}* ${escapeMd(urgency)}`,
    '',
    escapeMd(copy.daysLeftIntro(p.deadlineName, p.daysLeft)),
    '',
    `📅 ${escapeMd(copy.dueDate)}: *${escapeMd(p.dueDateFormatted)}*`,
  ]
  if (p.taxAmount != null) {
    lines.push(`💰 ${escapeMd(copy.estimatedTax)}: *${escapeMd(p.taxAmount.toLocaleString('ru-KZ'))} ₸*`)
  }
  lines.push('')
  lines.push(escapeMd(copy.openAppReminder))
  return lines.join('\n')
}

/**
 * Build Telegram message for sendDeadlineAlert (simpler format per spec).
 */
function buildDeadlineAlertTelegramText(opts: {
  formType: string
  declarationPeriod: string
  daysUntilDeadline: number
  language?: SupportedLanguage
}): string {
  const copy = copyFor(opts.language)
  return [
    `🔔 ${escapeMd(`NalogAI: ${copy.deadlineAlertTitle}`)}`,
    escapeMd(copy.alertForm(opts.formType, opts.declarationPeriod)),
    escapeMd(copy.alertDeadline(opts.daysUntilDeadline)),
    escapeMd(copy.openAppReminder),
  ].join('\n')
}

function buildEmailSubject(p: DeadlineReminderPayload): string {
  return copyFor(languageForPayload(p)).emailReminderSubject(p.deadlineName, p.daysLeft, p.dueDateFormatted)
}

function buildEmailHtml(p: DeadlineReminderPayload): string {
  const lang = languageForPayload(p)
  const copy = copyFor(lang)
  const urgencyColor = p.daysLeft < 7 ? '#FF4D4D' : p.daysLeft <= 30 ? '#FFB800' : '#00E87A'
  const urgencyLabel = p.daysLeft < 7 ? copy.urgent : p.daysLeft <= 30 ? copy.soon : copy.ok
  const amountRow = p.taxAmount != null
    ? `<tr><td style="padding:6px 0;color:#8a9ab8;font-size:13px;">${copy.estimatedTax}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#F0F4FF;">${p.taxAmount.toLocaleString('ru-KZ')} ₸</td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060C1A;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">

  <!-- Logo / header -->
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-size:28px;font-weight:900;color:#F0F4FF;letter-spacing:-1px;">Nalog<span style="color:#00E87A;">AI</span></span>
  </div>

  <!-- Card -->
  <div style="background:#0D1526;border-radius:16px;padding:28px 32px;border:1px solid rgba(240,244,255,0.08);">

    <!-- Urgency badge -->
    <div style="display:inline-block;background:${urgencyColor}1A;border:1px solid ${urgencyColor}40;border-radius:6px;padding:4px 12px;margin-bottom:20px;">
      <span style="color:${urgencyColor};font-size:12px;font-weight:700;letter-spacing:1px;">${urgencyLabel}</span>
    </div>

    <h2 style="margin:0 0 8px;color:#F0F4FF;font-size:20px;font-weight:700;line-height:1.3;">
      ${copy.deadlineReminderTitle}
    </h2>
    <p style="margin:0 0 24px;color:rgba(240,244,255,0.6);font-size:14px;line-height:1.5;">
      ${copy.greeting(p.fullName)} ${copy.daysLeftIntro(p.deadlineName, p.daysLeft)}
    </p>

    <!-- Info table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="border-bottom:1px solid rgba(240,244,255,0.08);">
        <td style="padding:10px 0;color:rgba(240,244,255,0.6);font-size:13px;">${copy.declaration}</td>
        <td style="padding:10px 0;text-align:right;font-weight:600;color:#F0F4FF;font-size:13px;">${p.deadlineName}</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(240,244,255,0.08);">
        <td style="padding:10px 0;color:rgba(240,244,255,0.6);font-size:13px;">${copy.dueDate}</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;color:${urgencyColor};font-size:13px;">${p.dueDateFormatted}</td>
      </tr>
      ${amountRow}
    </table>

    <!-- CTA -->
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL ?? 'https://nalogai.kz'}/declarations"
         style="display:inline-block;background:#00E87A;color:#060C1A;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
        ${copy.goToDeclarations}
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;text-align:center;">
    <p style="color:rgba(240,244,255,0.3);font-size:12px;line-height:1.6;margin:0;">
      ${copy.settingsHint}<br>
      © 2026 NalogAI - ${copy.footer}
    </p>
  </div>
</div>
</body>
</html>`
}

function buildDeadlineAlertEmailHtml(opts: {
  formType: string
  declarationPeriod: string
  daysUntilDeadline: number
  language?: SupportedLanguage
}): string {
  const lang = opts.language ?? DEFAULT_LANGUAGE
  const copy = copyFor(lang)
  const urgencyColor = opts.daysUntilDeadline <= 2 ? '#FF4D4D' : opts.daysUntilDeadline <= 7 ? '#FFB800' : '#00E87A'
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060C1A;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-size:28px;font-weight:900;color:#F0F4FF;letter-spacing:-1px;">Nalog<span style="color:#00E87A;">AI</span></span>
  </div>
  <div style="background:#0D1526;border-radius:16px;padding:28px 32px;border:1px solid rgba(240,244,255,0.08);">
    <h2 style="margin:0 0 16px;color:#F0F4FF;font-size:20px;font-weight:700;">
      🔔 ${copy.deadlineAlertTitle}
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="border-bottom:1px solid rgba(240,244,255,0.08);">
        <td style="padding:10px 0;color:rgba(240,244,255,0.6);font-size:13px;">${copy.declaration}</td>
        <td style="padding:10px 0;text-align:right;font-weight:600;color:#F0F4FF;font-size:13px;">${copy.alertForm(opts.formType, opts.declarationPeriod)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:rgba(240,244,255,0.6);font-size:13px;">${copy.deadline}</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;color:${urgencyColor};font-size:13px;">${copy.alertDeadline(opts.daysUntilDeadline)}</td>
      </tr>
    </table>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL ?? 'https://nalogai.kz'}/declarations"
         style="display:inline-block;background:#00E87A;color:#060C1A;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        ${copy.submitDeclaration}
      </a>
    </div>
  </div>
  <div style="margin-top:24px;text-align:center;">
    <p style="color:rgba(240,244,255,0.3);font-size:12px;margin:0;">
      © 2026 NalogAI - ${copy.footer}
    </p>
  </div>
</div>
</body>
</html>`
}

function buildEmailPlainText(p: DeadlineReminderPayload): string {
  const copy = copyFor(languageForPayload(p))
  const lines = [
    `${copy.deadlineReminderTitle} - NalogAI`,
    ``,
    copy.greeting(p.fullName),
    ``,
    copy.daysLeftIntro(p.deadlineName, p.daysLeft),
    ``,
    `${copy.dueDate}: ${p.dueDateFormatted}`,
  ]
  if (p.taxAmount != null) {
    lines.push(`${copy.estimatedTax}: ${p.taxAmount.toLocaleString('ru-KZ')} ₸`)
  }
  lines.push(``, copy.openAppReminder, ``, copy.teamSignoff)
  return lines.join('\n')
}

// ── Low-level channel senders ─────────────────────────────────────────────────

async function sendTelegramRaw(chatId: string, text: string, parseMode?: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn('NotificationService/Telegram: TELEGRAM_BOT_TOKEN not set — skipping')
    return
  }
  const url = `${TELEGRAM_API_BASE}/sendMessage`
  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: parseMode ?? 'MarkdownV2',
    }),
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Telegram API ${resp.status}: ${body}`)
  }
}

async function sendEmailRaw(to: string, subject: string, html: string, text: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@nalogai.kz'
  if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
    logger.warn('NotificationService/Email: SMTP not configured — skipping')
    return
  }
  await getTransport().sendMail({ from, to, subject, html, text })
}

// ── Public API — named object (spec-required shape) ───────────────────────────

export interface DeadlineAlertOpts {
  userId:                string
  userEmail:             string
  telegramChatId:        string | null
  emailNotifications:    boolean
  telegramNotifications: boolean
  declarationPeriod:     string
  formType:              string
  daysUntilDeadline:     number
  language?:             SupportedLanguage
}

export interface TestNotificationParams {
  userId: string
  fullName: string
  email: string
  telegramChatId: string | null
  emailNotifications: boolean
  telegramNotifications: boolean
  language?: SupportedLanguage
}

export type QueuedChannelStatus = 'queued' | 'skipped'

/**
 * NotificationService — the canonical named export.
 *
 * sendTelegramMessage: low-level Telegram send (plain text, no MarkdownV2).
 * sendEmail:           low-level SMTP send.
 * sendDeadlineAlert:   high-level alert that respects user channel prefs.
 *                      Logs only userId and channel type — never PII.
 */
export const NotificationService = {
  /**
   * Send a plain-text message to a Telegram chat.
   * Skips gracefully if TELEGRAM_BOT_TOKEN env var is not set.
   */
  async sendTelegramMessage(chatId: string, message: string): Promise<void> {
    await enqueueNotificationJob({ kind: 'telegram-message', chatId, message })
  },

  /**
   * Send an HTML email via Nodemailer SMTP.
   * Skips gracefully if SMTP_HOST env var is not set.
   * Never logs the recipient address.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
    await enqueueNotificationJob({ kind: 'email', to, subject, html, text })
  },

  /**
   * Send a deadline alert to all enabled channels for a user.
   * Catches per-channel errors so one failure doesn't block others.
   * Logs only userId and channel — never email address or chatId.
   */
  async sendDeadlineAlert(opts: DeadlineAlertOpts): Promise<void> {
    const { userId } = opts

    if (opts.telegramNotifications && opts.telegramChatId) {
      await enqueueNotificationJob({
        kind:                'deadline-alert-telegram',
        userId,
        declarationPeriod:   opts.declarationPeriod,
        formType:            opts.formType,
        daysUntilDeadline:   opts.daysUntilDeadline,
        language:            opts.language,
      })
    }

    if (opts.emailNotifications) {
      await enqueueNotificationJob({
        kind:                'deadline-alert-email',
        userId,
        declarationPeriod:   opts.declarationPeriod,
        formType:            opts.formType,
        daysUntilDeadline:   opts.daysUntilDeadline,
        language:            opts.language,
      })
    }
  },
}

// ── sendDeadlineReminder — used by deadlineReminders cron job ─────────────────

/**
 * Send a deadline reminder via all enabled channels for a user.
 * Errors are caught and logged — does NOT throw.
 * Logs only userId (via label prefix) and channel — never email or chatId.
 */
export async function sendDeadlineReminder(p: DeadlineReminderPayload): Promise<void> {
  if (p.telegramNotifications && p.telegramChatId) {
    await enqueueNotificationJob({
      kind:             'deadline-reminder-telegram',
      userId:           p.userId,
      deadlineName:     p.deadlineName,
      formType:         p.formType,
      dueDateFormatted: p.dueDateFormatted,
      daysLeft:         p.daysLeft,
      taxAmount:        p.taxAmount,
      language:         p.language,
    })
  }

  if (p.emailNotifications) {
    await enqueueNotificationJob({
      kind:             'deadline-reminder-email',
      userId:           p.userId,
      deadlineName:     p.deadlineName,
      formType:         p.formType,
      dueDateFormatted: p.dueDateFormatted,
      daysLeft:         p.daysLeft,
      taxAmount:        p.taxAmount,
      language:         p.language,
    })
  }
}

/**
 * Send a test notification to verify channel connectivity.
 * Returns per-channel results so the Settings UI can show success/failure.
 */
export async function sendTestNotification(params: TestNotificationParams): Promise<{ telegram: QueuedChannelStatus; email: QueuedChannelStatus }> {
  const out: { telegram: QueuedChannelStatus; email: QueuedChannelStatus } = {
    telegram: 'skipped',
    email:    'skipped',
  }

  if (params.telegramNotifications && params.telegramChatId) {
    await enqueueNotificationJob({ kind: 'test-telegram', userId: params.userId, language: params.language })
    out.telegram = 'queued'
  }

  if (params.emailNotifications) {
    await enqueueNotificationJob({ kind: 'test-email', userId: params.userId, language: params.language })
    out.email = 'queued'
  }

  return out
}

export async function deliverTelegramMessageJob(data: Extract<NotificationJobData, { kind: 'telegram-message' }>): Promise<void> {
  await sendTelegramRaw(data.chatId, data.message, data.parseMode)
  logger.info('NotificationService: Telegram message sent', { userId: data.userId, channel: 'telegram' })
}

export async function deliverEmailJob(data: Extract<NotificationJobData, { kind: 'email' }>): Promise<void> {
  const text = data.text ?? data.html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
  await sendEmailRaw(data.to, data.subject, data.html, text)
  logger.info('NotificationService: Email sent', { userId: data.userId, channel: 'email' })
}

export async function deliverDeadlineReminderChannel(channel: NotificationChannel, p: DeadlineReminderPayload): Promise<void> {
  if (channel === 'telegram') {
    if (!p.telegramNotifications || !p.telegramChatId) return
    await sendTelegramRaw(p.telegramChatId, buildTelegramText(p))
    logger.info('NotificationService/deadline: Telegram sent', { userId: p.userId, channel })
    return
  }

  if (!p.emailNotifications) return
  await sendEmailRaw(p.email, buildEmailSubject(p), buildEmailHtml(p), buildEmailPlainText(p))
  logger.info('NotificationService/deadline: Email sent', { userId: p.userId, channel })
}

export async function deliverDeadlineAlertChannel(channel: NotificationChannel, opts: DeadlineAlertOpts): Promise<void> {
  if (channel === 'telegram') {
    if (!opts.telegramNotifications || !opts.telegramChatId) return
    const message = buildDeadlineAlertTelegramText({
      formType:          opts.formType,
      declarationPeriod: opts.declarationPeriod,
      daysUntilDeadline: opts.daysUntilDeadline,
      language:          opts.language,
    })
    await sendTelegramRaw(opts.telegramChatId, message, undefined)
    logger.info('NotificationService: Telegram deadline alert sent', { userId: opts.userId, channel })
    return
  }

  if (!opts.emailNotifications) return
  const copy = copyFor(opts.language)
  const subject = copy.emailAlertSubject(opts.formType, opts.declarationPeriod)
  const html = buildDeadlineAlertEmailHtml({
    formType:          opts.formType,
    declarationPeriod: opts.declarationPeriod,
    daysUntilDeadline: opts.daysUntilDeadline,
    language:          opts.language,
  })
  const plainText = [
    `NalogAI: ${copy.deadlineAlertTitle}`,
    copy.alertForm(opts.formType, opts.declarationPeriod),
    copy.alertDeadline(opts.daysUntilDeadline),
    copy.openAppReminder,
  ].join('\n')
  await sendEmailRaw(opts.userEmail, subject, html, plainText)
  logger.info('NotificationService: Email deadline alert sent', { userId: opts.userId, channel })
}

export async function deliverTestNotificationChannel(channel: NotificationChannel, params: TestNotificationParams): Promise<void> {
  const copy = copyFor(params.language)
  if (channel === 'telegram') {
    if (!params.telegramNotifications || !params.telegramChatId) return
    const text = [
      `✅ ${copy.testTelegram}`,
      ``,
      copy.testTelegramBody,
    ].join('\n')
    await sendTelegramRaw(params.telegramChatId, text, undefined)
    logger.info('NotificationService/test: Telegram sent', { userId: params.userId, channel })
    return
  }

  if (!params.emailNotifications) return
  const subject = copy.testEmailSubject
  const html = `<!DOCTYPE html><html lang="${params.language ?? DEFAULT_LANGUAGE}"><body style="background:#060C1A;font-family:Arial,sans-serif;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#0D1526;border-radius:16px;padding:28px;border:1px solid rgba(240,244,255,0.08);">
<h2 style="color:#00E87A;margin-top:0;">✅ ${copy.testEmailHeading}</h2>
<p style="color:rgba(240,244,255,0.7);">${copy.testEmailBody(params.fullName)}</p>
<p style="color:rgba(240,244,255,0.5);font-size:12px;">© 2026 NalogAI</p></div></body></html>`
  const plain = `${copy.testEmailSubject}\n\n${copy.testEmailHeading} ${copy.testTelegramBody}`
  await sendEmailRaw(params.email, subject, html, plain)
  logger.info('NotificationService/test: Email sent', { userId: params.userId, channel })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayWord(n: number, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  if (language === 'kk') return 'күн'
  if (language === 'en') return n === 1 ? 'day' : 'days'

  const mod10  = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

function daysLeftPhrase(n: number, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  if (n <= 0) {
    if (language === 'kk') return 'бүгін аяқталады'
    if (language === 'en') return 'due today'
    return 'срок сегодня'
  }

  if (language === 'kk') return `${n} ${dayWord(n, language)} қалды`
  if (language === 'en') return `${n} ${dayWord(n, language)} left`
  return `${n === 1 ? 'остался' : 'осталось'} ${n} ${dayWord(n, language)}`
}
