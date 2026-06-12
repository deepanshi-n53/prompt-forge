/**
 * Prisma tenant isolation via AsyncLocalStorage.
 *
 * Usage:
 *   import { runWithTenant, tenantDb } from '@/lib/db/tenant-middleware'
 *
 *   // In auth middleware / route handler when inside an org context:
 *   return runWithTenant(orgId, () => handler(req, ctx))
 *
 *   // In DB queries that need org isolation:
 *   const projects = await tenantDb.project.findMany(...)
 */

import { AsyncLocalStorage } from 'async_hooks'
import { db } from './prisma'

// ALS holds the active orgId for the current request.
// null / undefined means "no org context" — queries run without org filter.
export const tenantStorage = new AsyncLocalStorage<string>()

/** Runs `fn` with the given orgId bound to all tenantDb queries in its callstack. */
export function runWithTenant<T>(orgId: string, fn: () => T | Promise<T>): Promise<T> {
  return tenantStorage.run(orgId, () => Promise.resolve(fn()))
}

// ── Write operations that never have a top-level where clause ─────────────────

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'upsert',
])

// ── Filter injectors ──────────────────────────────────────────────────────────

type AnyArgs = { where?: Record<string, unknown> }

/**
 * Injects `orgId` directly into `args.where` — for models that carry orgId
 * as a top-level column (Project).
 */
function withDirectOrgFilter(operation: string, args: AnyArgs, orgId: string): AnyArgs {
  if (WRITE_OPS.has(operation)) return args
  return { ...args, where: { ...args.where, orgId } }
}

/**
 * Injects `{ project: { orgId } }` into `args.where` — for models that reach
 * orgId through their Project relation (BRD, DecisionGraph, etc.).
 */
function withProjectOrgFilter(operation: string, args: AnyArgs, orgId: string): AnyArgs {
  if (WRITE_OPS.has(operation)) return args
  const existingProject = (args.where?.project ?? {}) as Record<string, unknown>
  return {
    ...args,
    where: {
      ...args.where,
      project: { ...existingProject, orgId },
    },
  }
}

// ── Extended client ───────────────────────────────────────────────────────────

export const tenantDb = db.$extends({
  query: {
    // Project has orgId directly
    project: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $allOperations({ operation, args, query }: any) {
        const orgId = tenantStorage.getStore()
        return query(orgId ? withDirectOrgFilter(operation, args as AnyArgs, orgId) : args)
      },
    },

    // The remaining models reach orgId via the project relation
    bRD: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $allOperations({ operation, args, query }: any) {
        const orgId = tenantStorage.getStore()
        return query(orgId ? withProjectOrgFilter(operation, args as AnyArgs, orgId) : args)
      },
    },

    decisionGraph: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $allOperations({ operation, args, query }: any) {
        const orgId = tenantStorage.getStore()
        return query(orgId ? withProjectOrgFilter(operation, args as AnyArgs, orgId) : args)
      },
    },

    generatedPrompt: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $allOperations({ operation, args, query }: any) {
        const orgId = tenantStorage.getStore()
        return query(orgId ? withProjectOrgFilter(operation, args as AnyArgs, orgId) : args)
      },
    },

    changeEvent: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $allOperations({ operation, args, query }: any) {
        const orgId = tenantStorage.getStore()
        return query(orgId ? withProjectOrgFilter(operation, args as AnyArgs, orgId) : args)
      },
    },
  },
})

export type TenantDb = typeof tenantDb
