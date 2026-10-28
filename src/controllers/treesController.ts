import type { Request, Response } from 'express'
import { CatalogError } from '../services/catalogError.js'
import { importValenciaInventory } from '../services/inventoryImport.js'
import { getTree, listTrees } from '../services/treeCatalog.js'

function integer(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new CatalogError(400, `${name} debe ser un entero entre ${min} y ${max}`)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new CatalogError(400, `${name} debe ser un entero entre ${min} y ${max}`)
  return number
}

function language(value: unknown): string {
  if (value === undefined) return 'es'
  if (typeof value !== 'string' || value.length > 35) throw new CatalogError(400, 'lang no es válido')
  try {
    const canonical = Intl.getCanonicalLocales(value)[0]
    if (!canonical) throw new Error('Missing language')
    return canonical
  } catch { throw new CatalogError(400, 'lang no es válido') }
}

function sendError(res: Response, error: unknown) {
  if (error instanceof CatalogError) {
    res.status(error.status).json({ error: error.message })
  } else {
    // Do not expose driver errors, SQL parameters or connection strings.
    res.status(500).json({ error: 'No se pudo consultar o guardar el catálogo' })
  }
}

export async function importTrees(req: Request, res: Response) {
  try {
    const limit = integer(req.query.limit, 20, 1, 200, 'limit')
    const offset = integer(req.query.offset, 0, 0, 10_000_000, 'offset')
    res.json(await importValenciaInventory(limit, offset))
  } catch (error) { sendError(res, error) }
}

export async function treesList(req: Request, res: Response) {
  try {
    const limit = integer(req.query.limit, 20, 1, 200, 'limit')
    const offset = integer(req.query.offset, 0, 0, 10_000_000, 'offset')
    res.json(await listTrees(limit, offset, language(req.query.lang)))
  } catch (error) { sendError(res, error) }
}

export async function treeDetail(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const tree = await getTree(id, language(req.query.lang))
    if (!tree) { res.status(404).json({ error: 'Planta no encontrada' }); return }
    res.json(tree)
  } catch (error) { sendError(res, error) }
}
