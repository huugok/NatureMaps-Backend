import { Router } from 'express'
import { enrichSpeciesFromTrees, listSpecies } from '../controllers/speciesController.js'

export const speciesRouter = Router()

speciesRouter.post('/enrich', enrichSpeciesFromTrees)
speciesRouter.get('/', listSpecies)
