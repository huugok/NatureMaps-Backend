import type { Request, Response } from 'express'
import { CatalogError } from '../services/catalogError.js'
import { getSpeciesDetail, listSpecies } from '../services/speciesCatalog.js'
import { enrichCatalogSpecies } from '../services/wikipediaImport.js'

function number(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))
    || Number(value) < min || Number(value) > max) throw new CatalogError(400, 'Parámetro numérico inválido')
  return Number(value)
}

function errorResponse(res: Response, error: unknown) {
  res.status(error instanceof CatalogError ? error.status : 500)
    .json({ error: error instanceof CatalogError ? error.message : 'No se pudo procesar el catálogo de especies' })
}

export async function enrichSpeciesFromTrees(req: Request, res: Response) {
  try {
    const language = req.query.lang
    if (language !== undefined && language !== 'es' && language !== 'en') {
      throw new CatalogError(400, 'lang debe ser es o en')
    }
    res.json(await enrichCatalogSpecies(number(req.query.limit, 20, 1, 200),
      number(req.query.afterId, 0, 0, 2_147_483_647), language))
  } catch (error) { errorResponse(res, error) }
}

export async function speciesList(req: Request, res: Response) {
  try {
    res.json(await listSpecies(number(req.query.limit, 200, 1, 200), number(req.query.offset, 0, 0, 10_000_000),
      requestedLanguage(req.query.lang)))
  } catch (error) { errorResponse(res, error) }
}

function requestedLanguage(value: unknown): string {
  if (value === undefined) return 'es'
  if (typeof value !== 'string' || value.length > 35) throw new CatalogError(400, 'lang no es válido')
  try { return Intl.getCanonicalLocales(value)[0] ?? 'es' } catch { throw new CatalogError(400, 'lang no es válido') }
}

export async function speciesDetail(req: Request, res: Response) {
  try {
    const id = number(req.params.id, 0, 1, 2_147_483_647)
    const detail = await getSpeciesDetail(id, requestedLanguage(req.query.lang),
      number(req.query.locationLimit, 50, 1, 200), number(req.query.afterLocationId, 0, 0, 2_147_483_647))
    if (!detail) { res.status(404).json({ error: 'Especie no encontrada' }); return }
    res.json(detail)
  } catch (error) { errorResponse(res, error) }
}
