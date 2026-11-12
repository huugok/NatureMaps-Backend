import type { Request, Response } from 'express'
import { decimal, integer, language, sendError } from './params.js'
import { importValenciaInventory } from '../services/inventoryImport.js'
import { getTree, listNearbyTrees, listTrees } from '../services/treeCatalog.js'

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

export async function treesNearby(req: Request, res: Response) {
  try {
    const lat = decimal(req.query.lat, 'lat', -90, 90)
    const lon = decimal(req.query.lon, 'lon', -180, 180)
    const radius = integer(req.query.radius, 1000, 50, 10000, 'radius')
    const limit = integer(req.query.limit, 100, 1, 1000, 'limit')
    res.json(await listNearbyTrees(lat, lon, radius, limit, language(req.query.lang)))
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
