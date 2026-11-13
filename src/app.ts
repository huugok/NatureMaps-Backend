import cors from 'cors'
import express from 'express'
import plantsRouter from './routes/plants.js'
import { treesRouter } from './routes/trees.js'
import { speciesRouter } from './routes/species.js'
import { sourcesRouter } from './routes/sources.js'
import { poisRouter } from './routes/pois.js'
import { greenAreasRouter } from './routes/greenAreas.js'
import { editorialRouter } from './routes/editorial.js'

export const app = express()

app.use(cors())
app.use(express.json())
app.use('/plants', plantsRouter)
app.use('/trees', treesRouter)
app.use('/species', speciesRouter)
app.use('/sources', sourcesRouter)
app.use('/pois', poisRouter)
app.use('/green-areas', greenAreasRouter)
app.use('/editorial', editorialRouter)

// Página de prueba para identificar plantas desde el navegador.
app.get('/probar', (_req, res) => {
  res.sendFile('identificar.html', { root: 'public' })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})
