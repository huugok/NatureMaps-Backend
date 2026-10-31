import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

// Este módulo carga el entorno él mismo: tanto el servidor (`src/index.ts`)
// como los scripts que arrancan directo por aquí (la seed, futuros scripts de
// mantenimiento) comparten estas conexiones, y solo el entry del servidor
// cargaba dotenv — la seed moría con "No database connection string". dotenv
// no sobreescribe variables ya presentes, así que la carga doble es inofensiva.
const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema })
