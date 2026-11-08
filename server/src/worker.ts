import { pino } from 'pino'
import { openDb, createOrm } from './db/index.js'
import { runMigrations } from './db/migrate.js'
import { createWorker } from './jobs/worker.js'
import { createHandlers } from './jobs/handlers.js'
import { createEmailProvider } from './email/provider.js'
import { config } from './config.js'

const sqlite = openDb()
runMigrations(sqlite)
const db = createOrm(sqlite)

const logger = pino(
  config.NODE_ENV === 'development'
    ? {
        level: config.LOG_LEVEL,
        redact: ['authorization', 'cookie'],
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
      }
    : { level: config.LOG_LEVEL, redact: ['authorization', 'cookie'] },
)

const worker = createWorker(db, createHandlers(createEmailProvider(config, logger)), logger)
worker.start()
logger.info('Quotely worker started (interval 5s)');
