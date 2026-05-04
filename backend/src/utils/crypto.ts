import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be set and at least 32 characters')
  }
  return scryptSync(key, 'nalogai-salt', 32)
}

/** Encrypt a plaintext string. Returns base64-encoded `salt:iv:tag:ciphertext`. */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/** Decrypt a string previously encrypted with `encrypt()`. */
export function decrypt(encoded: string): string {
  const key = getKey()
  const parts = encoded.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted format')

  const [, ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64!, 'base64')
  const tag = Buffer.from(tagB64!, 'base64')
  const data = Buffer.from(dataB64!, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
