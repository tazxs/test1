import { createClient } from 'redis'
import { logger } from './logger'

type RedisClient = ReturnType<typeof createClient>

let client: RedisClient | null = null
let isConnected = false

export interface BullMqConnectionOptions {
  host: string
  port: number
  username?: string
  password?: string
  db?: number
  tls?: Record<string, never>
  maxRetriesPerRequest: null
  enableReadyCheck: boolean
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

export function getBullMqConnectionOptions(): BullMqConnectionOptions {
  const redisUrl = new URL(getRedisUrl())
  const dbPath = redisUrl.pathname.replace('/', '')
  const options: BullMqConnectionOptions = {
    host: redisUrl.hostname || 'localhost',
    port: Number(redisUrl.port || 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }

  if (redisUrl.username) options.username = decodeURIComponent(redisUrl.username)
  if (redisUrl.password) options.password = decodeURIComponent(redisUrl.password)
  if (dbPath) options.db = Number(dbPath)
  if (redisUrl.protocol === 'rediss:') options.tls = {}

  return options
}

export async function connectRedis(): Promise<void> {
  try {
    const c = createClient({
      url: getRedisUrl(),
      socket: {
        // Attempt once then give up — no background reconnect loop
        reconnectStrategy: false,
        connectTimeout: 3000,
      },
    })
    // Suppress unhandled error events after failed connect
    c.on('error', () => { /* silenced — caught by connect() below */ })
    c.on('connect', () => logger.info('Redis connected'))

    await c.connect()
    // Re-attach a proper error handler now that connection succeeded
    c.on('error', (err) => logger.warn('Redis runtime error', { err }))
    client = c
    isConnected = true
  } catch {
    logger.warn('Redis unavailable — running with in-memory fallbacks (no caching/distributed rate-limit)')
    isConnected = false
  }
}


export const redis = {
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!isConnected || !client) return
    if (ttlSeconds !== undefined) {
      await client.set(key, value, { EX: ttlSeconds })
    } else {
      await client.set(key, value)
    }
  },

  async get(key: string): Promise<string | null> {
    if (!isConnected || !client) return null
    return client.get(key)
  },

  async del(key: string): Promise<void> {
    if (!isConnected || !client) return
    await client.del(key)
  },

  async exists(key: string): Promise<boolean> {
    if (!isConnected || !client) return false
    const count = await client.exists(key)
    return count > 0
  },

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await redis.set(key, JSON.stringify(value), ttlSeconds)
  },

  async getJson<T>(key: string): Promise<T | null> {
    if (!isConnected || !client) return null
    const raw = await client.get(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  },

  async incr(key: string): Promise<number> {
    if (!isConnected || !client) return 0
    return client.incr(key)
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!isConnected || !client) return
    await client.expire(key, ttlSeconds)
  },

  /** Raw client for rate-limit-redis adapter — may be null */
  get raw(): RedisClient {
    if (!client) throw new Error('Redis not connected')
    return client
  },

  get connected(): boolean { return isConnected },
}
