import { Queue, type JobsOptions } from 'bullmq'
import { InternalError } from '@utils/errors'
import { getBullMqConnectionOptions, redis } from '@utils/redis'
import type { SupportedLanguage } from '@utils/language'

export const NOTIFICATION_QUEUE_NAME = 'notifications'

export type NotificationChannel = 'email' | 'telegram'

export interface DeadlineReminderJobFields {
  userId: string
  deadlineName: string
  formType: string
  dueDateFormatted: string
  daysLeft: number
  taxAmount?: number
  language?: SupportedLanguage
}

export interface DeadlineAlertJobFields {
  userId: string
  declarationPeriod: string
  formType: string
  daysUntilDeadline: number
  language?: SupportedLanguage
}

export type NotificationJobData =
  | ({ kind: 'deadline-reminder-email' } & DeadlineReminderJobFields)
  | ({ kind: 'deadline-reminder-telegram' } & DeadlineReminderJobFields)
  | ({ kind: 'deadline-alert-email' } & DeadlineAlertJobFields)
  | ({ kind: 'deadline-alert-telegram' } & DeadlineAlertJobFields)
  | { kind: 'test-email'; userId: string; language?: SupportedLanguage }
  | { kind: 'test-telegram'; userId: string; language?: SupportedLanguage }
  | { kind: 'email'; userId?: string; to: string; subject: string; html: string; text?: string }
  | { kind: 'telegram-message'; userId?: string; chatId: string; message: string; parseMode?: string }

const notificationJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 30_000,
  },
  removeOnComplete: {
    age: 3_600,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 3_600,
    count: 250,
  },
}

export interface NotificationQueueHealth {
  queueName: string
  redisConnected: boolean
  status: 'ok' | 'degraded'
  retryPolicy: {
    attempts: number
    backoff: 'exponential'
    delayMs: number
  }
  memoryBudget: {
    redisLimitMb: number
    maxQueueSharePercent: number
    maxQueueMemoryMb: number
  }
  cleanup: {
    removeOnComplete: { ageSeconds: number; count: number }
    removeOnFail: { ageSeconds: number; count: number }
  }
  counts?: {
    waiting: number
    delayed: number
    active: number
    failed: number
    completed: number
  }
  error?: string
}

/*
 * Redis budget: keep BullMQ notification state below 64MB (25% of a 256MB
 * instance). Normal jobs carry IDs and compact deadline metadata; rendered
 * templates are built in workers. Completed jobs are aggressively removed,
 * failed history is capped, and raw email jobs should stay exceptional.
 */
let notificationQueue: Queue<NotificationJobData> | null = null

function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
      connection: getBullMqConnectionOptions(),
      defaultJobOptions: notificationJobOptions,
    })
  }

  return notificationQueue
}

export async function enqueueNotificationJob(data: NotificationJobData): Promise<string> {
  if (!redis.connected) {
    throw new InternalError('Notification queue unavailable')
  }

  const job = await getNotificationQueue().add(data.kind, data)
  return job.id ?? ''
}

export async function getNotificationQueueHealth(): Promise<NotificationQueueHealth> {
  const base: NotificationQueueHealth = {
    queueName: NOTIFICATION_QUEUE_NAME,
    redisConnected: redis.connected,
    status: redis.connected ? 'ok' : 'degraded',
    retryPolicy: {
      attempts: 3,
      backoff: 'exponential',
      delayMs: 30_000,
    },
    memoryBudget: {
      redisLimitMb: 256,
      maxQueueSharePercent: 25,
      maxQueueMemoryMb: 64,
    },
    cleanup: {
      removeOnComplete: { ageSeconds: 3_600, count: 1_000 },
      removeOnFail: { ageSeconds: 7 * 24 * 3_600, count: 250 },
    },
  }

  if (!redis.connected) return base

  try {
    const counts = await getNotificationQueue().getJobCounts(
      'waiting',
      'delayed',
      'active',
      'failed',
      'completed',
    )
    return {
      ...base,
      counts: {
        waiting: counts.waiting ?? 0,
        delayed: counts.delayed ?? 0,
        active: counts.active ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
      },
    }
  } catch (err) {
    return {
      ...base,
      status: 'degraded',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
