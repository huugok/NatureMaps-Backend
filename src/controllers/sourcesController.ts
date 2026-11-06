import type { Request, Response } from 'express'
import { CatalogError } from '../services/catalogError.js'
import { getDataSource, listDataSources } from '../services/dataSources.js'

function errorResponse(res: Response, error: unknown) {
  res.status(error instanceof CatalogError ? error.status : 500)
    .json({ error: error instanceof CatalogError ? error.message : 'No se pudo consultar las fuentes de datos' })
}

export async function sourcesList(_req: Request, res: Response) {
  try { res.json({ sources: await listDataSources() }) } catch (error) { errorResponse(res, error) }
}

export async function sourceDetail(req: Request, res: Response) {
  try {
    const code = req.params.code
    if (typeof code !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(code)) throw new CatalogError(400, 'code no es válido')
    const source = await getDataSource(code, true)
    if (!source) throw new CatalogError(404, 'Fuente no encontrada')
    res.json(source)
  } catch (error) { errorResponse(res, error) }
}
