import { beforeEach, describe, expect, it, vi } from 'vitest'

const bullMqMocks = vi.hoisted(() => {
  const add = vi.fn()
  const getJobCounts = vi.fn()
  const instances: Array<{ name: string; options: unknown }> = []
  const Queue = vi.fn().mockImplementation((name: string, options: unknown) => {
    instances.push({ name, options })
    return { add, getJobCounts }
  })

  return { add, getJobCounts, instances, Queue }
})

vi.mock('bullmq', () => ({
  Queue: bullMqMocks.Queue,
}))

vi.mock('@utils/redis', () => ({
  redis: { connected: true },
  getBullMqConnectionOptions: vi.fn(() => ({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })),
}))

describe('notificationQueue', () => {
  beforeEach(() => {
    vi.resetModules()
    bullMqMocks.add.mockReset()
    bullMqMocks.getJobCounts.mockReset()
    bullMqMocks.instances.length = 0
  })

  it('enqueues durable notification jobs with bounded retry and cleanup defaults', async () => {
    bullMqMocks.add.mockResolvedValueOnce({ id: 'job-1' })
    const { enqueueNotificationJob, NOTIFICATION_QUEUE_NAME } = await import('../notificationQueue')

    const jobId = await enqueueNotificationJob({ kind: 'test-email', userId: 'user_1' })

    expect(jobId).toBe('job-1')
    expect(bullMqMocks.Queue).toHaveBeenCalledTimes(1)
    expect(bullMqMocks.instances[0]?.name).toBe(NOTIFICATION_QUEUE_NAME)
    expect(bullMqMocks.instances[0]?.options).toMatchObject({
      connection: {
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
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
          age: 604_800,
          count: 250,
        },
      },
    })
    expect(bullMqMocks.add).toHaveBeenCalledWith('test-email', {
      kind: 'test-email',
      userId: 'user_1',
    })
  })

  it('reports queue health and the Redis memory budget', async () => {
    bullMqMocks.getJobCounts.mockResolvedValueOnce({
      waiting: 2,
      delayed: 1,
      active: 0,
      failed: 1,
      completed: 8,
    })
    const { getNotificationQueueHealth } = await import('../notificationQueue')

    await expect(getNotificationQueueHealth()).resolves.toMatchObject({
      queueName: 'notifications',
      redisConnected: true,
      status: 'ok',
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
      counts: {
        waiting: 2,
        delayed: 1,
        active: 0,
        failed: 1,
        completed: 8,
      },
    })
  })
})
