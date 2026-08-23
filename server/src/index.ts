import { pino } from 'pino'
import { openDb, createOrm } from './db/index.js'
import { runMigrations } from './db/migrate.js'
import { createApp } from './http/app.js'
import { createEmailProvider } from './email/provider.js'
import { LocalFileStorage } from './files/storage.js'
import { config } from './config.js'

const sqlite = openDb()
runMigrations(sqlite)
const db = createOrm(sqlite)

const logger = pino(
  config.NODE_ENV === 'development'
    ? {
        level: config.LOG_LEVEL,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'authorization', 'cookie'],
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
      }
    : {
        level: config.LOG_LEVEL,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'authorization', 'cookie'],
      },
)

const app = createApp({
  db,
  storage: new LocalFileStorage(config.FILE_STORAGE_DIR),
  email: createEmailProvider(config, logger),
  logger,
})

app.listen(config.PORT, () => {
  if (config.NODE_ENV !== 'test') logger.info({ port: config.PORT }, 'Quotely API listening')
})
