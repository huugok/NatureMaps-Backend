import { Router } from 'express'
import { routeDetail, routesList } from '../controllers/routesController.js'

export const routesRouter = Router()

// /:id dinámico al final: el listado no colisiona con el detalle.
routesRouter.get('/', routesList)
routesRouter.get('/:id', routeDetail)
