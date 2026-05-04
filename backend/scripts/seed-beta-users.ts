/**
 * Beta Rush Seed Script — generates 2,000 users with valid-format IINs.
 * 
 * Usage: npx tsx scripts/seed-beta-users.ts
 * 
 * Distribution: 75% FREE, 25% PRO
 * Each user gets a unique IIN (valid Kazakhstan checksum) and email.
 * 
 * CONSTRAINT: No real bank details. All data is sandbox-safe.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const prisma = new PrismaClient()
const BATCH_SIZE = 200
const TOTAL_USERS = 2_000

// ── IIN Generator (valid Kazakhstan checksum) ─────────────────────────────────
const WEIGHTS_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const WEIGHTS_2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]

function generateValidIIN(index: number): string {
  // Generate a unique date component (YYMMDD) cycling through valid dates
  const year = 70 + (index % 30)  // 1970-1999 (stays 2 digits)
  const month = (index % 12) + 1
  const day = (index % 28) + 1
  
  const yy = String(year).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  
  // Century+gender digit: 3 = 2000s male, 5 = 1900s female
  const centuryGender = index % 2 === 0 ? '3' : '5'
  
  // Sequential digits (8-11)
  const seq = String(index % 10000).padStart(4, '0')
  
  // Build first 11 digits
  const first11 = `${yy}${mm}${dd}${centuryGender}${seq}`
  const d = first11.split('').map(Number)
  
  // Calculate check digit (digit 12)
  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += d[i]! * WEIGHTS_1[i]!
  }
  let check = sum % 11
  
  if (check === 10) {
    sum = 0
    for (let i = 0; i < 11; i++) {
      sum += d[i]! * WEIGHTS_2[i]!
    }
    check = sum % 11
  }
  
  // If still 10, adjust sequential number
  if (check === 10) {
    return generateValidIIN(index + TOTAL_USERS)
  }
  
  return `${first11}${check}`
}

async function main() {
  console.log(`\n🚀 Seeding ${TOTAL_USERS} beta users...`)
  console.log(`   Distribution: 75% FREE (${Math.floor(TOTAL_USERS * 0.75)}), 25% PRO (${Math.floor(TOTAL_USERS * 0.25)})\n`)
  
  const passwordHash = await bcrypt.hash('BetaTest2026!', 12)
  const startTime = Date.now()
  
  let created = 0
  let skipped = 0
  
  for (let batch = 0; batch < Math.ceil(TOTAL_USERS / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_USERS)
    const users = []
    
    for (let i = batchStart; i < batchEnd; i++) {
      const iin = generateValidIIN(i)
      const isPro = i >= Math.floor(TOTAL_USERS * 0.75)
      
      users.push({
        email: `beta-user-${i}@nalogai.test`,
        password: passwordHash,
        fullName: `Beta User ${i}`,
        iin,
        plan: isPro ? 'PRO' as const : 'FREE' as const,
        role: 'USER' as const,
        preferredLanguage: ['ru', 'kk', 'en'][i % 3] as 'ru' | 'kk' | 'en',
        businessType: (['SELF_EMPLOYED', 'SOLE_PROPRIETOR', 'LLC'] as const)[i % 3],
        taxRegime: (['SIMPLIFIED_DECLARATION', 'PATENT', 'ESP'] as const)[i % 3],
      })
    }
    
    try {
      const result = await prisma.user.createMany({
        data: users,
        skipDuplicates: true,
      })
      created += result.count
    } catch (err) {
      skipped += users.length
      console.error(`  ⚠️  Batch ${batch + 1} failed:`, (err as Error).message)
    }
    
    if ((batch + 1) % 5 === 0) {
      console.log(`  ✓ Batch ${batch + 1}/${Math.ceil(TOTAL_USERS / BATCH_SIZE)} — ${created} users created`)
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const totalInDB = await prisma.user.count()
  
  console.log(`\n✅ Seed complete!`)
  console.log(`   Created: ${created}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total in DB: ${totalInDB}`)
  console.log(`   Duration: ${elapsed}s\n`)
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
