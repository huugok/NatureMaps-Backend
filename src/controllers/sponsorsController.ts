import type { Request, Response } from 'express'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { handle, sendError } from './params.js'

/** Comercios patrocinadores de las rutas: viven dentro del jsonb `stops`,
 *  pero el mapa los pinta solos, con el mismo aspecto que los POIs. */
export const sponsorsList = handle(async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      select distinct on (stop->>'id')
        (stop->>'id')::integer as id,
        stop->>'name' as name,
        coalesce(stop->>'businessName', stop->>'name') as "businessName",
        coalesce(stop->>'sponsorLocation', '') as "sponsorLocation",
        (stop->>'latitude')::double precision as latitude,
        (stop->>'longitude')::double precision as longitude
      from routes r, jsonb_array_elements(r.stops) as stop
      where stop->>'kind' = 'sponsor'
      order by stop->>'id', r.id
    `)
    res.json(result.rows)
  } catch (error) { sendError(res, error) }
})
