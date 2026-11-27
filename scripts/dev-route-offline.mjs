// Demostración aislada: un recorrido y sus fichas en PGlite, sin datos ni
// llamadas a Neon. El navegador obtiene las teselas del proveedor. Al cerrar el
// proceso se descarta el catálogo de prueba, no las descargas del navegador.
import { startFixtureDatabase } from '../tests/support/pglite.mjs'

const port = Number(process.env.PORT) || 3000
const { pg, restore } = await startFixtureDatabase()

const { id: speciesId } = (await pg.query("insert into species (scientific_name, source) values ('Citrus aurantium', 'DEMO') returning id")).rows[0]
const { id: plantId } = (await pg.query(`insert into plant_locations (species_id, latitude, longitude, source, external_id, source_url)
  values ($1, 39.47, -0.38, 'DEMO', 'naranjo', 'https://example.test/naranjo') returning id`, [speciesId])).rows[0]
await pg.query("insert into plant_names (plant_location_id, language, name) values ($1, 'es', 'Naranjo de prueba')", [plantId])
await pg.query(`insert into species_profiles (species_id, language, description, sources)
  values ($1, 'es', 'Ficha local de demostración para comprobar la descarga sin conexión.', '[]')`, [speciesId])
const imageUrl = `http://localhost:${port}/local-route-demo-image.svg`
const { id: poiId } = (await pg.query(`insert into pois (name, category, latitude, longitude, source, external_id, source_url,
  image_url, image_source_url, image_author, image_license, image_license_url, image_attribution)
  values ('Parada cultural de prueba', 'monumento', 39.471, -0.381, 'DEMO', 'parada', 'https://example.test/parada',
  $1, $1, 'Nature MAPS', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/', 'Imagen local de demostración · CC0') returning id`, [imageUrl])).rows[0]
await pg.query(`insert into poi_profiles (poi_id, language, description, source, source_url)
  values ($1, 'es', 'Ficha cultural de demostración guardada con el recorrido.', 'DEMO', 'https://example.test/parada')`, [poiId])
const stops = [
  { kind: 'planta', id: plantId, speciesId, name: 'Naranjo de prueba', latitude: 39.47, longitude: -0.38 },
  { kind: 'poi', id: poiId, speciesId: null, name: 'Parada cultural de prueba', latitude: 39.471, longitude: -0.381 },
]
const { id: routeId } = (await pg.query(`insert into routes (name, theme, shape, length_category, distance_meters,
  duration_seconds, start_latitude, start_longitude, description, stops, path)
  values ('Ruta local de prueba', 'mixta', 'lineal', 'corta', 200, 180, 39.47, -0.38,
  'Recorrido ficticio para probar mapa, fichas e imagen sin utilizar Neon.', $1, $2) returning id`,
  [JSON.stringify(stops), JSON.stringify(stops.map(({ latitude, longitude }) => ({ latitude, longitude })))])).rows[0]

const { app } = await import('../src/app.ts')
app.get('/local-route-demo-image.svg', (_request, response) => {
  response.type('svg').send('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#f5f2e9"/><path d="M300 280C150 180 190 70 390 90C410 240 340 270 300 280Z" fill="#2c6344"/><path d="M260 320L350 140" stroke="#f5f2e9" stroke-width="10"/><text x="300" y="370" text-anchor="middle" font-family="sans-serif" font-size="24">Imagen local de prueba</text></svg>')
})
const server = app.listen(port, () => {
  console.log(`Backend de prueba en http://localhost:${port}; ruta ${routeId}: Ruta local de prueba.`)
  console.log('Catálogo en memoria; teselas descargadas por el navegador. No se utiliza Neon. Ctrl+C para cerrar.')
})
process.once('SIGINT', () => {
  server.close(async () => { restore(); await pg.close(); process.exit(0) })
})
