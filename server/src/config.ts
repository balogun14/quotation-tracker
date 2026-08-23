import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('./data/quotely.db'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(16).default('dev-only-insecure-secret-do-not-use-in-prod'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Quotely <no-reply@quadstores.com>'),
  FX_BASE_URL: z.string().default('https://api.frankfurter.dev/v1'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:5173'),
  FILE_STORAGE_DIR: z.string().default('./data/files'),
  DEFAULT_QUOTE_EXPIRY_DAYS: z.coerce.number().int().positive().default(14),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

if (
  parsed.data.NODE_ENV === 'production' &&
  parsed.data.JWT_SECRET === 'dev-only-insecure-secret-do-not-use-in-prod'
) {
  console.error('JWT_SECRET must be set to a strong value in production.')
  process.exit(1)
}

export const config = parsed.data
export type Config = typeof config
