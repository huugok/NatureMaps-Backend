import { Router } from 'express'
import { routeDetail, routeRemove, routesList, routeUpdate } from '../controllers/routesController.js'

export const routesRouter = Router()

// /:id dinámico al final: el listado no colisiona con el detalle.
routesRouter.get('/', routesList)
routesRouter.get('/:id', routeDetail)
routesRouter.put('/:id', routeUpdate)
routesRouter.delete('/:id', routeRemove)
