import 'dotenv/config'
import type { SQL } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL!
if (!connectionString) throw new Error('Falta DATABASE_URL en .env')

const hostname = new URL(connectionString).hostname
const isLocalPostgres = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)

function createDatabase(): ReturnType<typeof drizzleNeon> {
  if (isLocalPostgres) {
    const pool = new Pool({ connectionString })
    const localDb = drizzlePostgres(pool, { schema })

    // Neon HTTP tiene batch; en local ejecutamos esas sentencias dentro de una transacción.
    return Object.assign(localDb, {
      batch: async (statements: Array<{ getSQL: () => SQL }>) =>
        localDb.transaction(async (transaction) => {
          const results = []
          for (const statement of statements) {
            results.push(await transaction.execute(statement.getSQL()))
          }
          return results
        }),
    }) as unknown as ReturnType<typeof drizzleNeon>
  }

  const sql = neon(connectionString)
  return drizzleNeon(sql, { schema }) as ReturnType<typeof drizzleNeon>
}

export const db = createDatabase()
