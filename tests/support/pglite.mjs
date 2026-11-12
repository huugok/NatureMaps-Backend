import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { neonConfig } from '@neondatabase/serverless'
import { PGlite } from '@electric-sql/pglite'

// Arnés compartido por las suites: PostgreSQL en WASM detrás del protocolo HTTP
// de Neon, con todas las migraciones del journal ya aplicadas. Ninguna suite
// debe volver a copiar `wireResult` ni la carga de migraciones.

/** Traduce el resultado de PGlite al formato HTTP de Neon (rowAsArray). */
export function wireResult(result, query) {
  const fields = result.fields.map((field) => ({ ...field, format: 'text' }))
  return {
    fields,
    rows: result.rows.map((row) => fields.map(({ name, dataTypeID }) => {
      const value = row[name]
      if (value === null || value === undefined) return null
      if (dataTypeID === 114 || dataTypeID === 3802) return JSON.stringify(value)
      if (typeof value === 'boolean') return value ? 't' : 'f'
      if (value instanceof Date) return value.toISOString()
      return String(value)
    })),
    rowCount: result.affectedRows ?? result.rows.length,
    command: query.trim().split(/\s+/)[0].toUpperCase(),
    rowAsArray: true,
  }
}

// Raíz del repositorio por defecto: este fichero vive en tests/support/.
const DEFAULT_ROOT = new URL('../../', import.meta.url)

function toDirectoryUrl(rootDir) {
  if (rootDir instanceof URL) return rootDir
  const path = rootDir.endsWith('/') ? rootDir : `${rootDir}/`
  return pathToFileURL(path)
}

/**
 * Arranca PGlite con todas las migraciones aplicadas y desvía el driver HTTP de
 * Neon a PGlite. Devuelve { pg, restore } — llama a restore() en el finally.
 *
 * `rootDir` es la raíz del repo (donde está `drizzle/`); por defecto se deduce
 * de la ubicación de este módulo. Cerrar `pg` sigue siendo cosa de la suite.
 */
export async function startFixtureDatabase(rootDir = DEFAULT_ROOT) {
  const base = toDirectoryUrl(rootDir)
  const pg = new PGlite()
  const journal = JSON.parse(await readFile(new URL('drizzle/meta/_journal.json', base), 'utf8'))
  for (const entry of journal.entries) {
    await pg.exec(await readFile(new URL(`drizzle/${entry.tag}.sql`, base), 'utf8'))
  }

  const originalNeonFetch = neonConfig.fetchFunction
  const originalDatabaseUrl = process.env.DATABASE_URL

  async function execute(client, query) {
    return wireResult(await client.query(query.query, query.params), query.query)
  }

  process.env.DATABASE_URL = 'postgresql://test:test@ep-test.eu-central-1.aws.neon.tech/test'
  neonConfig.fetchFunction = async (_url, init) => {
    const body = JSON.parse(init.body)
    try {
      if (body.queries) {
        const results = await pg.transaction(async (tx) => {
          const rows = []
          for (const query of body.queries) rows.push(await execute(tx, query))
          return rows
        })
        return Response.json({ results })
      }
      return Response.json(await execute(pg, body))
    } catch (error) {
      return Response.json({ message: 'Fixture database error', code: error.code }, { status: 400 })
    }
  }

  return {
    pg,
    restore() {
      neonConfig.fetchFunction = originalNeonFetch
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalDatabaseUrl
    },
  }
}
