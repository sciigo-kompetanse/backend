import 'dotenv/config'
import cluster from 'cluster'
import os from 'os'
import logger from './logger.js'
import app from './app.js'
import initialize from './initialize.js'

const cpus = os.cpus().length

if (!cluster.isPrimary || cpus <= 1) {

  if (cpus <= 1) initialize(app)

  // Accept both `port` (this repo's historical convention) and `PORT`
  // (the standard env var Fleet / most PaaS platforms inject).
  const envPort = process.env.port || process.env.PORT
  if (envPort) app.set('port', envPort)
  const port = app.get('port')

  app.listen(port).then(server => {

    process.on('unhandledRejection', (reason, p) =>
      logger.error('Unhandled Rejection at: Promise ', p, reason)
    )

    server.on('listening', () =>
      logger.info('Feathers application started on http://%s:%d', app.get('host'), port)
    )

  }).catch(e => {
    console.log('could not listen on port', e)
  })

} else {

  initialize(app)
  
  for (let i = 0; i < cpus; i++) {
    cluster.fork()
  }

}