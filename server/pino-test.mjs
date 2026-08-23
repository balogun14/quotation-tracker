import { pino } from 'pino'
const p = pino({ transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } })
p.info('hello pretty')
p.warn('a warning')
setTimeout(() => process.exit(0), 500)
