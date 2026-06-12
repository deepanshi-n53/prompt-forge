import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino(
  {
    level: isDev ? 'debug' : 'info',
    // Redact sensitive field paths so they never appear in logs
    redact: {
      paths: [
        'password', 'token', 'secret', 'apiKey', 'jwt', 'authorization', 'cookie',
        '*.password', '*.token', '*.secret', '*.apiKey', '*.jwt',
        '*.authorization', '*.cookie', '*.key', 'headers.authorization',
        'headers.cookie', 'headers["x-api-key"]',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) { return { level: label } },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined, // omit pid and hostname
  },
  isDev
    ? pino.transport({
        target:  'pino-pretty',
        options: {
          colorize:      true,
          translateTime: 'HH:MM:ss.l',
          ignore:        'pid,hostname',
          singleLine:    false,
        },
      })
    : undefined,
)

/** Returns a child logger pre-bound with per-request context. */
export function createRequestLogger(context: {
  requestId?: string
  userId?:    string
  orgId?:     string
  projectId?: string
}): pino.Logger {
  return logger.child(context)
}

export type Logger = pino.Logger
