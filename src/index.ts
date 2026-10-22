import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import plantsRouter from './routes/plants.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/plants', plantsRouter)

// Página de prueba para identificar plantas desde el navegador (http://localhost:3000/probar)
app.get('/probar', (_req, res) => {
  res.sendFile('identificar.html', { root: 'public' })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
