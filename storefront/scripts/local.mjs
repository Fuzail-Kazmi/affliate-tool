import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

const dir = resolve(process.env.UNITY_DATA_DIR || '../.local/unityaffliate')
mkdirSync(dir, { recursive: true })
const secretFile = join(dir, 'local-keys.json')
if (!existsSync(secretFile)) {
  writeFileSync(
    secretFile,
    JSON.stringify({
      database: randomBytes(32).toString('hex'),
      session: randomBytes(48).toString('hex'),
    }),
    { mode: 0o600, flag: 'wx' },
  )
}
const keys = JSON.parse(readFileSync(secretFile, 'utf8'))
const data = join(dir, 'postgres')
const port = Number(process.env.UNITY_DB_PORT || 55438)
const pg = new EmbeddedPostgres({
  databaseDir: data,
  port,
  user: 'unitylocal',
  password: keys.database,
  persistent: true,
  autoRehydrateSymlinks: true,
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  initdbFlags: ['--auth-host=scram-sha-256', '--encoding=UTF8'],
  onLog: () => {},
})
if (!existsSync(join(data, 'PG_VERSION'))) await pg.initialise()
await pg.start()
process.env.DATABASE_URL = `postgresql://unitylocal:${keys.database}@127.0.0.1:${port}/postgres`
process.env.JWT_SECRET = keys.session
process.env.UNITY_LOCAL_SETUP = '1'
process.env.NEXT_TELEMETRY_DISABLED = '1'
const httpPort = process.env.PORT || '5081'
process.env.NEXT_PUBLIC_BASE_URL = 'http://127.0.0.1:' + httpPort
try {
  await import('./migrate.mjs')
  const next = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'dev',
      '--webpack',
      '-H',
      '127.0.0.1',
      '-p',
      httpPort,
    ],
    { stdio: 'inherit', windowsHide: true },
  )
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, () => next.kill())
  process.exitCode = await new Promise((resolve) =>
    next.once('exit', (code) => resolve(code ?? 0)),
  )
} finally {
  await pg.stop()
}
