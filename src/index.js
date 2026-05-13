import 'dotenv/config'
import cluster from 'cluster'
import os from 'os'
import logger from './logger.js'
import app from './app.js'
import initialize from './initialize.js'

// How many cluster workers to spawn.
//
// `os.cpus().length` returns the *host* CPU count, which on a containerized
// platform (Fleet/Kubernetes) is much higher than the pod's actual CPU limit.
// With a 0.5-vCPU plan on a 4-CPU node, we'd fork 4 workers and each one
// would spin up its own mongoose / feathers-sync redis clients, then starve
// each other competing for 500m of CPU. Result: redis connect timeouts and
// nothing ever binds to `port`.
//
// Default to a single worker (no clustering) — Fleet replicas are the
// horizontal-scaling primitive. Set `workers=auto` to restore the original
// "one per host CPU" behaviour, or `workers=N` for a fixed count.
const workersEnv = (process.env.workers || process.env.WORKERS || '1').trim()
const cpus = workersEnv === 'auto' ? os.cpus().length : Math.max(1, parseInt(workersEnv, 10) || 1)

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