import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'

dotenv.config({ quiet: true })

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Configúrala en el archivo .env de la raíz del proyecto.')
  process.exitCode = 1
} else {
  try {
    const sql = neon(process.env.DATABASE_URL, {
      fetchOptions: { signal: AbortSignal.timeout(20_000) },
    })
    const result = await sql.query('SELECT 1 AS ok, current_database() AS database')
    console.log('Conexión correcta:')
    console.log(result)
  } catch {
    // El error original puede contener credenciales; no se imprime.
    console.error('No se pudo conectar en un máximo de 20 segundos. Revisa DATABASE_URL y la conexión a Internet.')
    process.exitCode = 1
  }
}
