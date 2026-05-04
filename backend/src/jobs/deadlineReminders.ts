/**
 * Deadline Reminder Cron Job
 *
 * Fires every morning at 09:00 Asia/Almaty (UTC+5, no DST).
 * For each user with notifications enabled, calculates upcoming tax deadlines
 * based on their tax regime, then sends reminders on the days they configured
 * (notifyDaysBefore: default [14, 7, 2, 1]).
 *
 * ─── Tax deadlines by regime ─────────────────────────────────────────────────
 *  SIMPLIFIED_DECLARATION (Form 910):
 *    1st half (Jan–Jun) → 15 August of same year
 *    2nd half (Jul–Dec) → 15 February of following year
 *
 *  GENERAL_REGIME (Form 200):
 *    Annual → 31 March of following year
 *
 *  PATENT (Form 912):
 *    Annual → 31 March of following year (patent renewal / OPV)
 *
 *  ESP:
 *    Monthly → 25th of the following month
 *
 * ─── Per-declaration deadline helper ─────────────────────────────────────────
 *  getDeclarationDeadline(period, formType) computes the statutory due date
 *  for a specific declaration record from the Declaration model.
 *
 *  period format:
 *    Quarter-style IDs: "2025-Q1" … "2025-Q4"
 *    Monthly:    "2025-01" … "2025-12"
 *    Annual:     "2025"
 *
 *  formType values (DeclarationFormType enum):
 *    FORM_910  — Simplified Declaration (semi-annual: Q1/Q2 -> H1, Q3/Q4 -> H2)
 *    FORM_912  — Patent (quarterly: 15th of month after quarter end)
 *    FORM_200  — General Regime (monthly: 25th of next month; annual: 31 March next year)
 *    ESP       — ESP (quarterly: 25th of month after quarter end)
 *
 * ─── Timezone note ───────────────────────────────────────────────────────────
 *  Kazakhstan is UTC+5 year-round (no DST). The cron timezone option delegates
 *  scheduling to node-cron. Day arithmetic is done with explicit UTC+5 offset
 *  math to avoid any system-tz dependency.
 */

import cron from 'node-cron'
import { prisma } from '@utils/prisma'
import { logger } from '@utils/logger'
import { sendDeadlineReminder } from '@services/NotificationService'
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from '@utils/language'

const JOB_NAME = 'deadline-reminders'

// Kazakhstan: UTC+5, no DST
const ALMATY_OFFSET_MS = 5 * 3_600_000
const MS_PER_DAY       = 86_400_000

// ── Timezone helpers ──────────────────────────────────────────────────────────

/** Returns today's calendar day number in Asia/Almaty time (days since Unix epoch). */
function todayAlmatyDayNumber(): number {
  return Math.floor((Date.now() + ALMATY_OFFSET_MS) / MS_PER_DAY)
}

/** Returns the day number (days since Unix epoch) for a given UTC calendar date. */
function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)
}

/** Current year in Almaty time. */
function almatyYear(): number {
  const almatyMs = Date.now() + ALMATY_OFFSET_MS
  return new Date(almatyMs).getUTCFullYear()
}

/** Current month (1–12) in Almaty time. */
function almatyMonth(): number {
  const almatyMs = Date.now() + ALMATY_OFFSET_MS
  return new Date(almatyMs).getUTCMonth() + 1
}

// ── Per-declaration deadline calculation ──────────────────────────────────────

/**
 * Compute the statutory due date for a specific declaration.
 *
 * @param period   Declaration period string: "2025-Q1", "2025-01", or "2025"
 * @param formType DeclarationFormType enum value: "FORM_910", "FORM_912", "FORM_200", "ESP"
 * @returns        The deadline as a UTC Date (midnight UTC of the due calendar day)
 * @throws         Error if the period or formType is unrecognised
 *
 * Kazakhstan tax deadlines:
 *   FORM_910 (Simplified Declaration) — semi-annual:
 *     H1 (Jan–Jun) → August 15     H2 (Jul–Dec) → February 15 next year
 *   FORM_912 (Patent) — quarterly, 15th of the month after quarter end
 *   FORM_200 (General Regime):
 *     Monthly → 25th of the next month
 *     Annual  → 31 March of the following year
 *   ESP — quarterly, 25th of the month after quarter end (same quarter mapping as FORM_910)
 */
export function getDeclarationDeadline(period: string, formType: string): Date {
  // Quarter period: "YYYY-Q{1-4}"
  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarterMatch) {
    const year    = parseInt(quarterMatch[1]!, 10)
    const quarter = parseInt(quarterMatch[2]!, 10)

    if (formType === 'FORM_910') {
      return quarter <= 2
        ? new Date(Date.UTC(year, 7, 15))
        : new Date(Date.UTC(year + 1, 1, 15))
    }

    // Month after quarter end: Q1→Apr(4), Q2→Jul(7), Q3→Oct(10), Q4→Jan(1) of next year
    const quarterEndMonth = quarter * 3           // Mar=3, Jun=6, Sep=9, Dec=12
    let deadlineMonth = quarterEndMonth + 1       // Apr=4, Jul=7, Oct=10, Jan=13
    let deadlineYear  = year
    if (deadlineMonth > 12) {
      deadlineMonth = 1
      deadlineYear  = year + 1
    }

    if (formType === 'FORM_912') {
      return new Date(Date.UTC(deadlineYear, deadlineMonth - 1, 15))
    }
    if (formType === 'ESP') {
      return new Date(Date.UTC(deadlineYear, deadlineMonth - 1, 25))
    }
    // FORM_200 quarterly is treated as monthly below — fall through not expected
    throw new Error(`getDeclarationDeadline: formType ${formType} does not use quarterly periods`)
  }

  // Monthly period: "YYYY-MM"
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period)
  if (monthMatch) {
    const year  = parseInt(monthMatch[1]!, 10)
    const month = parseInt(monthMatch[2]!, 10)

    if (formType === 'FORM_200') {
      // Monthly FORM_200: 25th of next month
      const deadlineMonth = month === 12 ? 1 : month + 1
      const deadlineYear  = month === 12 ? year + 1 : year
      return new Date(Date.UTC(deadlineYear, deadlineMonth - 1, 25))
    }

    throw new Error(`getDeclarationDeadline: formType ${formType} does not use monthly periods`)
  }

  // Annual period: "YYYY"
  const annualMatch = /^(\d{4})$/.exec(period)
  if (annualMatch) {
    const year = parseInt(annualMatch[1]!, 10)

    if (formType === 'FORM_200' || formType === 'FORM_912') {
      // Annual declaration: 31 March of following year
      return new Date(Date.UTC(year + 1, 2, 31))
    }

    throw new Error(`getDeclarationDeadline: formType ${formType} does not use annual periods`)
  }

  throw new Error(`getDeclarationDeadline: unrecognised period format "${period}"`)
}

// ── Regime-based deadline calculation ────────────────────────────────────────

interface TaxDeadline {
  /** Localized display name, e.g. "910.00 нысаны, 2026 жылғы 1-жартыжылдық" */
  deadlineName: string
  /** Internal form type string for contextual action routing */
  formType: string
  /** Localized due date, e.g. "2026 жылғы 15 тамыз" */
  dueDateFormatted: string
  /** Calendar days remaining (can be negative if past) */
  daysLeft: number
}

const MONTHS: Record<SupportedLanguage, string[]> = {
  kk: [
    'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
    'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
  ],
  ru: [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}

function formatDate(year: number, month: number, day: number, language: SupportedLanguage): string {
  const monthName = MONTHS[language][month - 1]!
  if (language === 'kk') return `${year} жылғы ${day} ${monthName}`
  if (language === 'en') return `${monthName} ${day}, ${year}`
  return `${day} ${monthName} ${year}`
}

function calcDaysLeft(year: number, month: number, day: number): number {
  return dayNumber(year, month, day) - todayAlmatyDayNumber()
}

function formLabel(formType: string, language: SupportedLanguage): string {
  const formNumber = formType.replace('FORM_', '')
  if (formType === 'ESP') {
    if (language === 'kk') return 'БЖТ'
    if (language === 'en') return 'USP'
    return 'ЕСП'
  }

  if (language === 'kk') return `${formNumber}.00 нысаны`
  if (language === 'en') return `Form ${formNumber}.00`
  return `Форма ${formNumber}.00`
}

function halfYearLabel(half: 1 | 2, year: number, language: SupportedLanguage): string {
  if (language === 'kk') return `${year} жылғы ${half}-жартыжылдық`
  if (language === 'en') return `${half === 1 ? 'first' : 'second'} half of ${year}`
  return `${half}-е полугодие ${year}`
}

function annualLabel(year: number, language: SupportedLanguage): string {
  if (language === 'kk') return `${year} жыл`
  if (language === 'en') return `${year}`
  return `${year} год`
}

function monthlyLabel(year: number, month: number, language: SupportedLanguage): string {
  const monthName = MONTHS[language][month - 1]!
  if (language === 'kk') return `${year} жылғы ${monthName} айы`
  if (language === 'en') return `${monthName} ${year}`
  return `${monthName} ${year}`
}

function deadlineName(formType: string, periodLabel: string, language: SupportedLanguage): string {
  if (language === 'kk') return `${formLabel(formType, language)}, ${periodLabel}`
  if (language === 'en') return `${formLabel(formType, language)} for ${periodLabel}`
  return `${formLabel(formType, language)} за ${periodLabel}`
}

/**
 * Returns all upcoming (or current) deadlines for a given tax regime.
 * Only returns deadlines where daysLeft >= 0 (not yet passed).
 */
function getDeadlines(regime: string, language: SupportedLanguage): TaxDeadline[] {
  const year  = almatyYear()
  const month = almatyMonth()
  const deadlines: TaxDeadline[] = []

  if (regime === 'SIMPLIFIED_DECLARATION') {
    // Form 910: semi-annual
    // 1st half deadline: 15 August of current year
    const d1 = { year, month: 8, day: 15 }
    // 2nd half deadline: 15 February of next year
    const d2 = { year: year + 1, month: 2, day: 15 }

    const half = month <= 6 ? 1 : 2
    const halfLabel1 = halfYearLabel(1, year, language)
    const halfLabel2 = halfYearLabel(2, year, language)

    const dl1 = calcDaysLeft(d1.year, d1.month, d1.day)
    const dl2 = calcDaysLeft(d2.year, d2.month, d2.day)

    if (dl1 >= 0) {
      deadlines.push({
        deadlineName:    deadlineName('FORM_910', halfLabel1, language),
        formType:        'FORM_910',
        dueDateFormatted: formatDate(d1.year, d1.month, d1.day, language),
        daysLeft:        dl1,
      })
    }
    // Always show the upcoming 2nd-half deadline if 1st half is done
    if (dl2 >= 0 && (dl1 < 0 || half === 2)) {
      deadlines.push({
        deadlineName:    deadlineName('FORM_910', halfLabel2, language),
        formType:        'FORM_910',
        dueDateFormatted: formatDate(d2.year, d2.month, d2.day, language),
        daysLeft:        dl2,
      })
    }
  }

  if (regime === 'GENERAL_REGIME') {
    // Form 200: annual, 31 March of following year
    const deadlineYear = year + 1
    const dl = calcDaysLeft(deadlineYear, 3, 31)
    if (dl >= 0) {
      deadlines.push({
        deadlineName:    deadlineName('FORM_200', annualLabel(year, language), language),
        formType:        'FORM_200',
        dueDateFormatted: formatDate(deadlineYear, 3, 31, language),
        daysLeft:        dl,
      })
    }
  }

  if (regime === 'PATENT') {
    // Form 912: renewal due 31 March
    const deadlineYear = year + 1
    const dl = calcDaysLeft(deadlineYear, 3, 31)
    if (dl >= 0) {
      deadlines.push({
        deadlineName:    deadlineName('FORM_912', annualLabel(year, language), language),
        formType:        'FORM_912',
        dueDateFormatted: formatDate(deadlineYear, 3, 31, language),
        daysLeft:        dl,
      })
    }
  }

  if (regime === 'ESP') {
    // ESP: monthly, due 25th of following month
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear  = month === 12 ? year + 1 : year
    const dl = calcDaysLeft(nextYear, nextMonth, 25)
    if (dl >= 0) {
      const periodLabel = monthlyLabel(year, month, language)
      deadlines.push({
        deadlineName:    deadlineName('ESP', periodLabel, language),
        formType:        'ESP',
        dueDateFormatted: formatDate(nextYear, nextMonth, 25, language),
        daysLeft:        dl,
      })
    }
  }

  return deadlines
}

// ── Job ───────────────────────────────────────────────────────────────────────

export function startDeadlineRemindersJob(): void {
  // "0 4 * * *" = 04:00 UTC = 09:00 Asia/Almaty (UTC+5, no DST)
  // node-cron timezone option handles the wall-clock scheduling;
  // internal day arithmetic uses explicit UTC+5 offset to be tz-independent.
  cron.schedule(
    '0 9 * * *',
    () => { void runDeadlineReminders() },
    { timezone: 'Asia/Almaty', name: JOB_NAME },
  )
  logger.info(`${JOB_NAME}: scheduled at 09:00 Asia/Almaty`)
}

async function runDeadlineReminders(): Promise<void> {
  logger.info(`${JOB_NAME}: starting run`)

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { emailNotifications: true },
        { telegramNotifications: true, telegramChatId: { not: null } },
      ],
    },
    select: {
      id:                    true,
      email:                 true,
      fullName:              true,
      taxRegime:             true,
      telegramChatId:        true,
      emailNotifications:    true,
      telegramNotifications: true,
      notifyDaysBefore:      true,
      preferredLanguage:     true,
    },
  })

  if (users.length === 0) {
    logger.info(`${JOB_NAME}: no users with notifications enabled`)
    return
  }

  logger.info(`${JOB_NAME}: processing ${users.length} user(s)`)

  let sent = 0
  for (const user of users) {
    const language = normalizeLanguage(user.preferredLanguage) ?? DEFAULT_LANGUAGE
    const deadlines = getDeadlines(user.taxRegime, language)
    // Fall back to [14, 7, 2, 1] if user has not configured notify days
    const notifyOn  = user.notifyDaysBefore.length > 0 ? user.notifyDaysBefore : [14, 7, 2, 1]

    for (const deadline of deadlines) {
      if (!notifyOn.includes(deadline.daysLeft)) continue

      try {
        await sendDeadlineReminder({
          userId:                user.id,
          fullName:              user.fullName,
          email:                 user.email,
          telegramChatId:        user.telegramChatId,
          emailNotifications:    user.emailNotifications,
          telegramNotifications: user.telegramNotifications,
          deadlineName:          deadline.deadlineName,
          formType:              deadline.formType,
          dueDateFormatted:      deadline.dueDateFormatted,
          daysLeft:              deadline.daysLeft,
          language,
        })
        sent++
        logger.info(`${JOB_NAME}: reminder queued`, { userId: user.id, formType: deadline.formType, daysLeft: deadline.daysLeft })
      } catch (err) {
        // sendDeadlineReminder should never throw, but guard anyway
        logger.error(`${JOB_NAME}: unexpected error`, {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  logger.info(`${JOB_NAME}: run complete — ${sent} reminder(s) queued`)
}
