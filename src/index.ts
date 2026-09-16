import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { speciesRouter } from './routes/species.js'
import { treesRouter } from './routes/trees.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/trees', treesRouter)
app.use('/species', speciesRouter)

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
