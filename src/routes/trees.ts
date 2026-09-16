import { Router } from 'express'
import { importTrees, listTrees } from '../controllers/treesController.js'

export const treesRouter = Router()

treesRouter.post('/import', importTrees)
treesRouter.get('/', listTrees)
