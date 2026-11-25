import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'

dotenv.config({ quiet: true })

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Configúrala en el archivo .env de la raíz del proyecto.')
  process.exitCode = 1
} else {
  try {
    const connectionString = process.env.DATABASE_URL
    const hostname = new URL(connectionString).hostname
    let result
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
      const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 20_000 })
      try {
        result = await pool.query('SELECT 1 AS ok, current_database() AS database')
      } finally {
        await pool.end()
      }
    } else {
      const sql = neon(connectionString, {
        fetchOptions: { signal: AbortSignal.timeout(20_000) },
      })
      result = await sql.query('SELECT 1 AS ok, current_database() AS database')
    }
    console.log('Conexión correcta:')
    console.log(result.rows ?? result)
  } catch {
    // El error original puede contener credenciales; no se imprime.
    console.error('No se pudo conectar en un máximo de 20 segundos. Revisa DATABASE_URL y la conexión a Internet.')
    process.exitCode = 1
  }
}
