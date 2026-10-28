import { Router } from 'express'
import { importTrees, treeDetail, treesList } from '../controllers/treesController.js'

export const treesRouter = Router()

treesRouter.post('/import', importTrees)
treesRouter.get('/', treesList)
treesRouter.get('/:id', treeDetail)
