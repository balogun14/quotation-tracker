import { openDb, createOrm } from './db/index.js'
import { runMigrations } from './db/migrate.js'
import { createWorker } from './jobs/worker.js'
import { createHandlers } from './jobs/handlers.js'
import { createEmailProvider } from './email/provider.js'
import { config } from './config.js'

const sqlite = openDb()
runMigrations(sqlite)
const db = createOrm(sqlite)

const worker = createWorker(db, createHandlers(createEmailProvider(config)))
worker.start()
console.log(`Worker started (interval 5s), ${config.NODE_ENV}`)
