import { Router } from 'express'
import { enrichSpeciesFromTrees, speciesDetail, speciesList } from '../controllers/speciesController.js'

export const speciesRouter = Router()
speciesRouter.post('/enrich', enrichSpeciesFromTrees)
speciesRouter.get('/', speciesList)
speciesRouter.get('/:id', speciesDetail)
