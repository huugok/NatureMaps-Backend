import type { Request, Response } from 'express'
import { decimal, detailLevel, integer, language, sendError } from './params.js'
import { getPoi, listNearbyPois } from '../services/poiCatalog.js'
import { importValenciaPois } from '../services/poiImport.js'

// POIs histórico-culturales del mapa (NM-06): lista de cercanos con la ficha
// completa y detalle por id. Mismo contrato de parámetros que /trees/nearby.

export async function poisNearby(req: Request, res: Response) {
  try {
    const lat = decimal(req.query.lat, 'lat', -90, 90)
    const lon = decimal(req.query.lon, 'lon', -180, 180)
    const radius = integer(req.query.radius, 1000, 50, 10000, 'radius')
    const limit = integer(req.query.limit, 200, 1, 1000, 'limit')
    const detail = detailLevel(req.query.detail)
    res.json(await listNearbyPois(lat, lon, radius, limit, language(req.query.lang), detail))
  } catch (error) { sendError(res, error) }
}

export async function poiDetail(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const poi = await getPoi(id, language(req.query.lang))
    if (!poi) { res.status(404).json({ error: 'Punto de interés no encontrado' }); return }
    res.json(poi)
  } catch (error) { sendError(res, error) }
}

export async function importPois(_req: Request, res: Response) {
  try {
    res.json(await importValenciaPois())
  } catch (error) { sendError(res, error) }
}
