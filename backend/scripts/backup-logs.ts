/**
 * Backup Logs Script
 * 
 * Exports audit logs to /backups/logs/ directory.
 * Logs are NEVER deleted — only archived.
 * 
 * Usage: npx tsx scripts/backup-logs.ts [--retention-days=30]
 * 
 * Can also be triggered by the logRotation cron job.
 */
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const prisma = new PrismaClient()

const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'logs')
const DEFAULT_RETENTION_DAYS = 30

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`)
  }
}

async function main() {
  const retentionArg = process.argv.find((a) => a.startsWith('--retention-days='))
  const retentionDays = retentionArg
    ? parseInt(retentionArg.split('=')[1]!, 10)
    : DEFAULT_RETENTION_DAYS

  console.log(`\n🔄 Audit Log Backup Script`)
  console.log(`   Retention: ${retentionDays} days`)
  console.log(`   Backup dir: ${BACKUP_DIR}\n`)

  ensureBackupDir()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  // Fetch logs older than retention period
  const oldLogs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    include: {
      actor: { select: { id: true, email: true, fullName: true } },
    },
  })

  if (oldLogs.length === 0) {
    console.log('✅ No logs to archive.')
    await prisma.$disconnect()
    return
  }

  console.log(`📊 Found ${oldLogs.length} logs to archive (older than ${cutoff.toISOString()})`)

  // Create export payload
  const exportData = {
    exportedAt: new Date().toISOString(),
    retentionDays,
    cutoffDate: cutoff.toISOString(),
    count: oldLogs.length,
    logs: oldLogs,
  }

  // Write compressed JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `audit-logs-${timestamp}.json.gz`
  const filepath = path.join(BACKUP_DIR, filename)

  const jsonStr = JSON.stringify(exportData, null, 2)
  const compressed = gzipSync(Buffer.from(jsonStr, 'utf-8'))
  fs.writeFileSync(filepath, compressed)

  const sizeKB = (compressed.length / 1024).toFixed(1)
  console.log(`📦 Exported ${oldLogs.length} logs → ${filename} (${sizeKB} KB)`)

  // IMPORTANT: Logs are NOT deleted — only archived
  // If you want to delete after archiving, uncomment below:
  // const { count: deleted } = await prisma.auditLog.deleteMany({
  //   where: { createdAt: { lt: cutoff } },
  // })
  // console.log(`🗑️  Deleted ${deleted} archived logs from DB`)

  console.log(`\n✅ Backup complete. Logs preserved in database.\n`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Backup failed:', err)
  prisma.$disconnect()
  process.exit(1)
})
