import { Router } from 'express'
import {
  greenAreaAtPoint, greenAreaDetail, greenAreaGroupDetail, greenAreasList, importGreenAreas,
} from '../controllers/greenAreasController.js'

export const greenAreasRouter = Router()

greenAreasRouter.post('/import', importGreenAreas)
greenAreasRouter.get('/', greenAreasList)
// /at and /group/:slug must be registered before /:id so they are not parsed as an id.
greenAreasRouter.get('/at', greenAreaAtPoint)
greenAreasRouter.get('/group/:slug', greenAreaGroupDetail)
greenAreasRouter.get('/:id', greenAreaDetail)
