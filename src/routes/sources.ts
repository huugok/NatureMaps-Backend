import { Router } from 'express'
import { sourceDetail, sourcesList } from '../controllers/sourcesController.js'

export const sourcesRouter = Router()
sourcesRouter.get('/', sourcesList)
sourcesRouter.get('/:code', sourceDetail)
