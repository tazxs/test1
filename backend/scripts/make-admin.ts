/**
 * Script to list users and promote one to ADMIN role.
 * Usage: npx tsx scripts/make-admin.ts [email]
 *   - Without email: lists all users
 *   - With email: promotes that user to ADMIN
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const targetEmail = process.argv[2]

  if (!targetEmail) {
    // List all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, plan: true },
      orderBy: { createdAt: 'asc' },
    })

    console.log('\n📋 All users:')
    console.log('─'.repeat(80))
    for (const u of users) {
      console.log(`  ${u.role === 'ADMIN' ? '🛡️' : '👤'} ${u.email.padEnd(35)} ${u.fullName.padEnd(20)} role=${u.role} plan=${u.plan}`)
    }
    console.log('─'.repeat(80))
    console.log(`\nTotal: ${users.length} users`)
    console.log('\nTo promote a user to admin, run:')
    console.log('  npx tsx scripts/make-admin.ts user@example.com\n')
  } else {
    // Promote user to ADMIN
    const user = await prisma.user.findUnique({ where: { email: targetEmail } })
    if (!user) {
      console.error(`❌ User not found: ${targetEmail}`)
      process.exit(1)
    }

    if (user.role === 'ADMIN') {
      console.log(`✅ ${targetEmail} is already an ADMIN`)
      process.exit(0)
    }

    await prisma.user.update({
      where: { email: targetEmail },
      data: { role: 'ADMIN' },
    })

    console.log(`🛡️  ${targetEmail} has been promoted to ADMIN`)
    console.log('\n⚠️  The user must log out and log back in for the JWT to include the new role.\n')
  }
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
