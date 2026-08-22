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

const logger = pino({ level: config.NODE_ENV === 'test' ? 'silent' : 'info' })

const app = createApp({
  db,
  storage: new LocalFileStorage(config.FILE_STORAGE_DIR),
  email: createEmailProvider(config),
  logger,
})

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Quotely API listening')
})