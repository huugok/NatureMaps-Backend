import { Router } from 'express'
import { offlineMapArchive, offlineMapMetadata } from '../controllers/offlineMapsController.js'

export const offlineMapsRouter = Router()
offlineMapsRouter.get('/:code/:hash.pmtiles', offlineMapArchive)
offlineMapsRouter.get('/:code', offlineMapMetadata)
