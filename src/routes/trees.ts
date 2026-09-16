import { Router } from 'express'
import { getTree, importTrees, listTrees } from '../controllers/treesController.js'

export const treesRouter = Router()

treesRouter.post('/import', importTrees)
treesRouter.get('/', listTrees)
treesRouter.get('/:id', getTree)
