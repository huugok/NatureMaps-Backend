import type { Request, Response } from 'express'
import { decimal, integer, sendError } from './params.js'
import { getRoute, listRoutes, routeAccess } from '../services/routeCatalog.js'

// Catálogo de rutas botánico-culturales predefinidas. Sin parámetros: el
// catálogo se genera una vez y se lee tal cual (los GET abren en navegador).

export async function routesList(_req: Request, res: Response) {
  try {
    res.json(await listRoutes())
  } catch (error) { sendError(res, error) }
}

export async function routeDetail(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const route = await getRoute(id)
    if (!route) { res.status(404).json({ error: 'Ruta no encontrada' }); return }
    res.json(route)
  } catch (error) { sendError(res, error) }
}

/** Cómo llegar al inicio: distancia, tiempo y tramo desde la ubicación actual. */
export async function routeAccessController(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const latitude = decimal(req.query.lat, 'lat', -90, 90)
    const longitude = decimal(req.query.lon, 'lon', -180, 180)
    const access = await routeAccess(id, { latitude, longitude })
    if (!access) { res.status(404).json({ error: 'Ruta no encontrada' }); return }
    res.json(access)
  } catch (error) { sendError(res, error) }
}
