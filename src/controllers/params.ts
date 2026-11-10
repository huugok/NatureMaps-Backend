import type { NextFunction, Request, Response } from 'express'
import { CatalogError } from '../services/catalogError.js'

// Validación de los parámetros de consulta compartida por los controladores:
// el mapa pide coordenadas, radio y límite con el mismo contrato en /trees y /pois.

export function integer(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new CatalogError(400, `${name} debe ser un entero entre ${min} y ${max}`)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new CatalogError(400, `${name} debe ser un entero entre ${min} y ${max}`)
  return number
}

export function language(value: unknown): string {
  if (value === undefined) return 'es'
  if (typeof value !== 'string' || value.length > 35) throw new CatalogError(400, 'lang no es válido')
  try {
    const canonical = Intl.getCanonicalLocales(value)[0]
    if (!canonical) throw new Error('Missing language')
    return canonical
  } catch { throw new CatalogError(400, 'lang no es válido') }
}

/** `detail=lite|full` (por defecto `full`): el mapa pide ligero, la ficha pide completo. */
export function detailLevel(value: unknown): 'lite' | 'full' {
  if (value === undefined) return 'full'
  if (value === 'lite' || value === 'full') return value
  throw new CatalogError(400, 'detail debe ser lite o full')
}

export function decimal(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) throw new CatalogError(400, `${name} debe ser un número entre ${min} y ${max}`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) throw new CatalogError(400, `${name} debe ser un número entre ${min} y ${max}`)
  return number
}

export function sendError(res: Response, error: unknown) {
  if (error instanceof CatalogError) {
    res.status(error.status).json({ error: error.message })
  } else {
    // Do not expose driver errors, SQL parameters or connection strings.
    res.status(500).json({ error: 'No se pudo consultar o guardar el catálogo' })
  }
}

/** Envuelve un handler para que un fallo inesperado no tumbe la petición sin respuesta. */
export function handle(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }
}
