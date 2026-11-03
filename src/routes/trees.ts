import { Router } from 'express'
import { importTrees, treeDetail, treesList, treesNearby } from '../controllers/treesController.js'

export const treesRouter = Router()

treesRouter.post('/import', importTrees)
treesRouter.get('/', treesList)
// /nearby must be registered before /:id so it is not parsed as an id.
treesRouter.get('/nearby', treesNearby)
treesRouter.get('/:id', treeDetail)
