import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

function makeClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
      : [{ level: 'error', emit: 'stdout' }],
  })
}

// Lazy singleton — the client is NOT constructed at module import time.
// This prevents PrismaClientInitializationError during Next.js build-time
// static analysis when DATABASE_URL is absent from the build environment.
let _instance: PrismaClient | undefined

function getInstance(): PrismaClient {
  if (_instance) return _instance
  _instance = global.__prisma ?? makeClient()
  if (process.env.NODE_ENV !== 'production') {
    global.__prisma = _instance
  }
  return _instance
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getInstance()
    const value = Reflect.get(client, prop, client)
    if (typeof value === 'function') return (value as (...args: unknown[]) => unknown).bind(client)
    return value
  },
})
