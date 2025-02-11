const fs = require('fs/promises')
const { logger} = require('./get-logger.js')

module.exports.monitorFile = (
  _filePath, 
  _interval, 
  _callback, 
  _callbackArgs = []
) => {
  let lastModifiedTime = null

  let _monitorLoop = () =>
    fs
      .stat(_filePath)
      .then((_stats) => {
        if (_stats.mtimeMs !== lastModifiedTime) {
          lastModifiedTime = _stats.mtimeMs
          logger.info(`Detected change on ${_filePath}`)
          return _callback(..._callbackArgs)
        } else {
          return Promise.resolve()
        }
      })
      .catch((_err) => {
        console.error(_err)
      })

  return fs
    .stat(_filePath)
    .then((_stats) => {
      lastModifiedTime = _stats.mtimeMs
      setInterval(_monitorLoop, _interval * 1000)
      logger.info(`Monitoring of file ${_filePath} started...`)
    })
    .catch((_err) => {
      console.error(_err)
    })
}
