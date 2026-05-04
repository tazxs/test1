import { QueueEvents, Worker, type Job } from 'bullmq'
import { logger } from '@utils/logger'
import { getBullMqConnectionOptions, redis } from '@utils/redis'
import {
  NOTIFICATION_QUEUE_NAME,
  type NotificationJobData,
} from '@jobs/notificationQueue'
import {
  deliverDeadlineAlertChannel,
  deliverDeadlineReminderChannel,
  deliverEmailJob,
  deliverTelegramMessageJob,
  deliverTestNotificationChannel,
} from '@services/NotificationService'
import { prisma } from '@utils/prisma'
import { DEFAULT_LANGUAGE, detectLanguageFromParts, normalizeLanguage, type SupportedLanguage } from '@utils/language'

let notificationWorker: Worker<NotificationJobData> | null = null
let notificationQueueEvents: QueueEvents | null = null

export function startNotificationWorkers(): void {
  if (notificationWorker || notificationQueueEvents) return

  if (!redis.connected) {
    logger.warn('Notification worker not started: Redis unavailable')
    return
  }

  const connection = getBullMqConnectionOptions()
  const concurrency = Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 5)

  notificationWorker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE_NAME,
    processNotificationJob,
    { connection, concurrency },
  )

  const queueEvents = new QueueEvents(NOTIFICATION_QUEUE_NAME, { connection })
  notificationQueueEvents = queueEvents
  queueEvents.on('waiting', ({ jobId }) => {
    logger.info('Notification job waiting', { jobId })
  })

  notificationWorker.on('completed', (job) => {
    logger.info('Notification job completed', {
      jobId: job.id,
      kind: job.name,
      attemptsMade: job.attemptsMade,
    })
  })

  notificationWorker.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      kind: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    })
  })

  logger.info('Notification worker started', { concurrency })
}

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const data = job.data

  switch (data.kind) {
    case 'deadline-reminder-email':
      await deliverDeadlineReminderChannel('email', await loadDeadlineReminder(data))
      return
    case 'deadline-reminder-telegram':
      await deliverDeadlineReminderChannel('telegram', await loadDeadlineReminder(data))
      return
    case 'deadline-alert-email':
      await deliverDeadlineAlertChannel('email', await loadDeadlineAlert(data))
      return
    case 'deadline-alert-telegram':
      await deliverDeadlineAlertChannel('telegram', await loadDeadlineAlert(data))
      return
    case 'test-email':
      await deliverTestNotificationChannel('email', await loadTestNotification(data.userId, data.language))
      return
    case 'test-telegram':
      await deliverTestNotificationChannel('telegram', await loadTestNotification(data.userId, data.language))
      return
    case 'email':
      await deliverEmailJob(data)
      return
    case 'telegram-message':
      await deliverTelegramMessageJob(data)
      return
  }
}

async function loadDeadlineReminder(data: Extract<NotificationJobData, { kind: 'deadline-reminder-email' | 'deadline-reminder-telegram' }>) {
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id:                    true,
      fullName:              true,
      email:                 true,
      telegramChatId:        true,
      emailNotifications:    true,
      telegramNotifications: true,
      preferredLanguage:     true,
    },
  })

  if (!user) throw new Error('Notification user not found')

  return {
    userId:                user.id,
    fullName:              user.fullName,
    email:                 user.email,
    telegramChatId:        user.telegramChatId,
    emailNotifications:    user.emailNotifications,
    telegramNotifications: user.telegramNotifications,
    deadlineName:          data.deadlineName,
    formType:              data.formType,
    dueDateFormatted:      data.dueDateFormatted,
    daysLeft:              data.daysLeft,
    taxAmount:             data.taxAmount,
    language:              normalizeLanguage(user.preferredLanguage) ?? data.language ?? detectLanguageFromParts([user.fullName, data.deadlineName, data.dueDateFormatted], DEFAULT_LANGUAGE),
  }
}

async function loadDeadlineAlert(data: Extract<NotificationJobData, { kind: 'deadline-alert-email' | 'deadline-alert-telegram' }>) {
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id:                    true,
      email:                 true,
      telegramChatId:        true,
      emailNotifications:    true,
      telegramNotifications: true,
      preferredLanguage:     true,
    },
  })

  if (!user) throw new Error('Notification user not found')

  return {
    userId:                user.id,
    userEmail:             user.email,
    telegramChatId:        user.telegramChatId,
    emailNotifications:    user.emailNotifications,
    telegramNotifications: user.telegramNotifications,
    declarationPeriod:     data.declarationPeriod,
    formType:              data.formType,
    daysUntilDeadline:     data.daysUntilDeadline,
    language:              normalizeLanguage(user.preferredLanguage) ?? data.language ?? detectLanguageFromParts([data.declarationPeriod, data.formType], DEFAULT_LANGUAGE),
  }
}

async function loadTestNotification(userId: string, language?: SupportedLanguage) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:                    true,
      fullName:              true,
      email:                 true,
      telegramChatId:        true,
      emailNotifications:    true,
      telegramNotifications: true,
      preferredLanguage:     true,
    },
  })

  if (!user) throw new Error('Notification user not found')

  return {
    userId:                user.id,
    fullName:              user.fullName,
    email:                 user.email,
    telegramChatId:        user.telegramChatId,
    emailNotifications:    user.emailNotifications,
    telegramNotifications: user.telegramNotifications,
    language:              language ?? userLanguage(user.preferredLanguage, [user.fullName]),
  }
}

function userLanguage(value: string, fallbackParts: Array<string | null | undefined>): SupportedLanguage {
  return normalizeLanguage(value) ?? detectLanguageFromParts(fallbackParts, DEFAULT_LANGUAGE)
}
