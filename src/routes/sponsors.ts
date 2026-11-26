import { Router } from 'express'
import { sponsorsList } from '../controllers/sponsorsController.js'

export const sponsorsRouter = Router()
sponsorsRouter.get('/', sponsorsList)
