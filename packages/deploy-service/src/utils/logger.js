import { config } from 'dotenv'
import path from 'path'
import log4js from 'log4js'

const envPath = process.env.ENV_PATH
config({ path: envPath || '.env' })

const appName = envPath ? path.basename(envPath, path.extname(envPath)).replace('.', '') : 'env'
const pattern = `[${appName}][%c][%p][%d{yyyy-MM-dd|hh:mm:ss}] %m`

log4js.configure({
  appenders: {
    console: {
      type: 'stdout',
      layout: { type: 'pattern', pattern },
    },
    file: {
      type: 'dateFile',
      filename: `logs/${appName}.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      compress: false,
      numBackups: 10,
      layout: { type: 'pattern', pattern },
    },
    'only-info': {
      type: 'logLevelFilter',
      appender: 'file',
      level: 'info',
    },
  },
  categories: {
    default: { appenders: ['only-info', 'console'], level: 'debug' },
    main: { appenders: ['only-info', 'console'], level: 'debug' },
    balanceWatcher: { appenders: ['only-info', 'console'], level: 'debug' },
    deployWorker: { appenders: ['only-info', 'console'], level: 'debug' },
    settleWorker: { appenders: ['only-info', 'console'], level: 'debug' },
    completionVerifier: { appenders: ['only-info', 'console'], level: 'debug' },
    database: { appenders: ['only-info', 'console'], level: 'debug' },
    multiChain: { appenders: ['only-info', 'console'], level: 'debug' },
  },
})

export const logger = log4js.getLogger()
export const getServiceLogger = (serviceName) => log4js.getLogger(serviceName)
