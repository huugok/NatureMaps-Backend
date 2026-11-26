import type { Request, Response } from 'express'
import { integer, sendError } from './params.js'
import { deleteRoute, getRoute, listRoutes, updateRoute } from '../services/routeCatalog.js'

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

/** Modificación de una ruta: nombre, tema y paradas (la forma no se toca). */
export async function routeUpdate(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const { name, theme, description, stops } = req.body ?? {}
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' }); return
    }
    if (typeof theme !== 'string' || !['botanica', 'cultural', 'mixta', 'sponsor'].includes(theme)) {
      res.status(400).json({ error: 'Tema no válido' }); return
    }
    if (!Array.isArray(stops) || stops.length < 2) {
      res.status(400).json({ error: 'La ruta necesita al menos dos paradas' }); return
    }
    const updated = await updateRoute(id, { name: name.trim(), theme, description, stops })
    if (!updated) { res.status(404).json({ error: 'Ruta no encontrada' }); return }
    res.json(updated)
  } catch (error) { sendError(res, error) }
}

/** Borrado permanente (la app lo pide tras el diálogo de confirmación). */
export async function routeRemove(req: Request, res: Response) {
  try {
    const id = integer(req.params.id, 0, 1, 2_147_483_647, 'id')
    const removed = await deleteRoute(id)
    if (!removed) { res.status(404).json({ error: 'Ruta no encontrada' }); return }
    res.status(204).end()
  } catch (error) { sendError(res, error) }
}
