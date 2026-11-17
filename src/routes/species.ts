import { Router } from 'express'
import { rateLimit } from '../middlewares/rateLimit.js'
import { enrichSpeciesFromTrees, lookupSpecies, speciesDetail, speciesList } from '../controllers/speciesController.js'

export const speciesRouter = Router()
speciesRouter.post('/enrich', enrichSpeciesFromTrees)
// Consulta Wikipedia por cada petición (no escribe en la base): con límite por IP.
speciesRouter.post('/lookup', rateLimit({ max: 20, windowMs: 60_000 }), lookupSpecies)
speciesRouter.get('/', speciesList)
speciesRouter.get('/:id', speciesDetail)
