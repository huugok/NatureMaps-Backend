import type { Request, Response } from 'express'
import { decimal, integer, language, sendError } from './params.js'
import { CatalogError } from '../services/catalogError.js'
import { getGreenArea, getGreenAreaGroup, greenAreaAt, listGreenAreas } from '../services/greenAreaCatalog.js'
import type { AreaBounds } from '../services/greenAreaCatalog.js'
import { importValenciaGreenAreas } from '../services/greenAreaImport.js'

// Zonas verdes (NM-08): capa del mapa, zona de un punto y ficha de zona.

function flag(value: unknown, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new CatalogError(400, `${name} debe ser true o false`)
}

/** `bbox=oeste,sur,este,norte` (orden GeoJSON), opcional. */
function bounds(value: unknown): AreaBounds | null {
  if (value === undefined) return null
  const parts = typeof value === 'string' ? value.split(',') : []
  if (parts.length !== 4 || parts.some((part) => !/^-?\d+(\.\d+)?$/.test(part))) {
    throw new CatalogError(400, 'bbox debe ser oeste,sur,este,norte')
  }
  const [west, south, east, north] = parts.map(Number) as [number, number, number, number]
  if (west < -180 || east > 180 || south < -90 || north > 90 || west > east || south > north) {
    throw new CatalogError(400, 'bbox debe ser oeste,sur,este,norte')
  }
  return { west, south, east, north }
}

export function groupSlug(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) || value.length > 80) {
    throw new CatalogError(400, 'El identificador de la zona no es válido')
  }
  return value
}

export async function greenAreasList(req: Request, res: Response) {
  try {
    res.json(await listGreenAreas(
      flag(req.query.all, 'all', false), flag(req.query.geometry, 'geometry', true), bounds(req.query.bbox),
    ))
  } catch (error) { sendError(res, error) }
}

export async function greenAreaAtPoint(req: Request, res: Response) {
  try {
    const lat = decimal(req.query.lat, 'lat', -90, 90)
    const lon = decimal(req.query.lon, 'lon', -180, 180)
    res.json(await greenAreaAt(lat, lon, integer(req.query.radius, 150, 0, 1000, 'radius')))
  } catch (error) { sendError(res, error) }
}

export async function greenAreaGroupDetail(req: Request, res: Response) {
  try {
    const detail = await getGreenAreaGroup(groupSlug(req.params.slug), language(req.query.lang))
    if (!detail) { res.status(404).json({ error: 'Zona verde no encontrada' }); return }
    res.json(detail)
  } catch (error) { sendError(res, error) }
}

export async function greenAreaDetail(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const detail = await getGreenArea(id, language(req.query.lang))
    if (!detail) { res.status(404).json({ error: 'Zona verde no encontrada' }); return }
    res.json(detail)
  } catch (error) { sendError(res, error) }
}

export async function importGreenAreas(_req: Request, res: Response) {
  try {
    res.json(await importValenciaGreenAreas())
  } catch (error) { sendError(res, error) }
}
