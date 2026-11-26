import { Router } from 'express'
import { routeAccessController, routeDetail, routesList } from '../controllers/routesController.js'

export const routesRouter = Router()

// /:id dinámico al final: el listado no colisiona con el detalle.
routesRouter.get('/', routesList)
routesRouter.get('/:id/directions', routeAccessController)
routesRouter.get('/:id', routeDetail)
