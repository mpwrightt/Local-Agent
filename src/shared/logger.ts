import pino from 'pino'

export const logger = pino({
  name: 'local-agent',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
})


