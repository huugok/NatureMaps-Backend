import { Router } from 'express'
import { enrichSpeciesFromTrees, speciesList } from '../controllers/speciesController.js'

export const speciesRouter = Router()
speciesRouter.post('/enrich', enrichSpeciesFromTrees)
speciesRouter.get('/', speciesList)
