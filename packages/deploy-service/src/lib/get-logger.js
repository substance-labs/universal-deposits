const envPath = process.env.ENV_PATH
require('dotenv').config({ path: envPath || '.env' })
const path = require('path')
const log4js = require('log4js')
const appName = path.basename(envPath, path.extname(envPath)).replace('.', '') || '.env'
const pattern = `[${appName}][%p][%d{yyyy-MM-dd|hh:mm:ss}] %m`

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
    "only-info": {
      type: "logLevelFilter",
      appender: "file",
      level: "info"
    }
  },
  categories: {
    default: { appenders: ['only-info', 'console'], level: 'debug' },
  },
})

module.exports.logger = log4js.getLogger()
