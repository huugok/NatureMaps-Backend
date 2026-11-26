import type { Request, Response } from 'express'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { handle, sendError } from './params.js'

/** Comercios patrocinadores del mapa: entidades propias en BD, cargadas una vez
 *  por sesión y pintadas como los POIs pero en rosa/morado. */
export const sponsorsList = handle(async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      select id, name, business_name as "businessName", address as "sponsorLocation",
        latitude, longitude
      from sponsors
      order by business_name
    `)
    res.json(result.rows)
  } catch (error) { sendError(res, error) }
})
