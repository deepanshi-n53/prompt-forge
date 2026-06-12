import type { ParsedBRD } from './brd'
import type { DecisionGraph } from './decision'

export enum ProjectStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
  UPDATING = 'UPDATING',
}

export enum Track {
  FAST = 'FAST',
  FULL = 'FULL',
}

export enum Plan {
  FREE = 'FREE',
  PROFESSIONAL = 'PROFESSIONAL',
  AGENCY = 'AGENCY',
  ENTERPRISE = 'ENTERPRISE',
}

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum PromptStatus {
  GENERATED = 'GENERATED',
  OUTDATED = 'OUTDATED',
  APPLIED = 'APPLIED',
}

export interface Project {
  id: string
  orgId: string
  userId: string
  name: string
  status: ProjectStatus
  track: Track
  brdStoragePath: string | null
  parsedBrd: ParsedBRD | null
  decisionGraph: DecisionGraph | null
  answers: Record<string, string> | null
  generationCount: number
  lastGeneratedAt: Date | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Prompt {
  id: string
  projectId: string
  sectionNum: string
  sectionName: string
  content: string
  status: PromptStatus
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface OrgMembership {
  id: string
  orgId: string
  userId: string
  role: OrgRole
  createdAt: Date
}

export interface OrgSubscription {
  id: string
  orgId: string
  plan: Plan
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Date | null
  createdAt: Date
  updatedAt: Date
}
