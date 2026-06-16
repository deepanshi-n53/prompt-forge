import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/prisma'

// One-time admin endpoint: upgrades all @n53tech.com users to ENTERPRISE.
// Protected by a secret token set in ADMIN_SECRET env var.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await db.user.updateMany({
    where: {
      email: { endsWith: '@n53tech.com' },
      plan:  { not: 'ENTERPRISE' },
    },
    data: { plan: 'ENTERPRISE' },
  })

  return NextResponse.json({
    upgraded: updated.count,
    message:  `${updated.count} @n53tech.com user(s) upgraded to ENTERPRISE`,
  })
}
