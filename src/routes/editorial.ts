import { Router } from 'express'
import { articleDetail, articlesList } from '../controllers/editorialController.js'

export const editorialRouter = Router()

editorialRouter.get('/', articlesList)
editorialRouter.get('/:slug', articleDetail)
