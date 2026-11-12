import { Router } from 'express'
import { importPois, poiDetail, poisNearby } from '../controllers/poisController.js'

export const poisRouter = Router()

poisRouter.post('/import', importPois)
// /nearby must be registered before /:id so it is not parsed as an id.
poisRouter.get('/nearby', poisNearby)
poisRouter.get('/:id', poiDetail)
