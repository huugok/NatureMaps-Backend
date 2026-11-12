import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { startFixtureDatabase } from './support/pglite.mjs'

// Rutas botánico-culturales predefinidas: generador (anillo y línea), cliente
// Valhalla simulado y endpoints del catálogo. Mismo arnés PGlite que el resto
// de suites; Valhalla nunca se llama de verdad (respuesta simulada).

// Codificador de polilínea (precision 6), el inverso del decodificador del
// servicio: el simulador de Valhalla necesita devolver geometría real.
function encodePolyline(points, precision = 6) {
  const factor = 10 ** precision
  let lastLat = 0
  let lastLon = 0
  let out = ''
  for (const point of points) {
    const lat = Math.round(point.latitude * factor)
    const lon = Math.round(point.longitude * factor)
    for (const value of [lat - lastLat, lon - lastLon]) {
      let v = value < 0 ? -value * 2 - 1 : value * 2
      while (v >= 0x20) {
        out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
        v = Math.floor(v / 32)
      }
      out += String.fromCharCode(v + 63)
    }
    lastLat = lat
    lastLon = lon
  }
  return out
}

function haversineMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h))
}

// El simulador mide ~30 % más que la línea recta, como el caminar real.
const DETOUR = 1.3

test('Rutas predefinidas: generador, cliente Valhalla y catálogo', async (t) => {
  const { pg, restore } = await startFixtureDatabase()
  process.env.VALHALLA_URL = 'https://valhalla.test'

  const originalFetch = globalThis.fetch
  let valhallaCalls = 0
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === '127.0.0.1') return originalFetch(input, init)
    assert.equal(url.hostname, 'valhalla.test', `Llamada externa inesperada: ${url.hostname}`)
    assert.equal(url.pathname, '/route')
    assert.equal(init.method, 'POST')
    const body = JSON.parse(init.body)
    assert.equal(body.costing, 'pedestrian')
    assert.equal(body.directions_options.units, 'kilometers')
    valhallaCalls++
    const [origin, destination] = body.locations
    const distance = haversineMeters(origin, destination) * DETOUR
    const time = distance / 1.4
    const shape = encodePolyline([
      { latitude: origin.lat, longitude: origin.lon },
      { latitude: (origin.lat + destination.lat) / 2, longitude: (origin.lon + destination.lon) / 2 },
      { latitude: destination.lat, longitude: destination.lon },
    ])
    return Response.json({ trip: { status: 0, summary: { length: distance / 1000, time },
      legs: [{ shape, summary: { length: distance / 1000, time } }] } })
  }

  let plantSeq = 0
  async function insertPlant(latitude, longitude, name = null) {
    plantSeq++
    const row = (await pg.query(
      `insert into plant_locations (source, external_id, latitude, longitude, source_url)
       values ('TEST', $1, $2, $3, 'https://test/valencia') returning id`,
      [`P${plantSeq}`, latitude, longitude])).rows[0]
    if (name) {
      await pg.query(`insert into plant_names (plant_location_id, language, name) values ($1, 'es', $2)`, [row.id, name])
    }
  }

  async function insertPoi(latitude, longitude, name) {
    await pg.query(
      `insert into pois (source, external_id, name, category, latitude, longitude, source_url)
       values ('TEST', $1, $2, 'monumento', $3, $4, 'https://test/poi')`,
      [`G${name}`, name, latitude, longitude])
  }

  async function clearStops() {
    await pg.exec('delete from plant_names')
    await pg.exec('delete from plant_locations')
    await pg.exec('delete from pois')
  }

  try {
    const { generateRoute } = await import('../src/services/routeGenerator.ts')
    const { CatalogError } = await import('../src/services/catalogError.ts')

    await t.test('cierra un anillo de paradas cuando la zona lo permite', async () => {
      await clearStops()
      // 16 plantas repartidas en un anillo de 245 m + 8 POIs poco más allá.
      for (let k = 0; k < 16; k++) {
        const angle = (Math.PI * 2 * k) / 16
        await insertPlant(245 * Math.sin(angle) / 110_540, 245 * Math.cos(angle) / 111_320, `Planta ${k}`)
      }
      for (let k = 0; k < 8; k++) {
        const angle = (Math.PI * 2 * k) / 8 + Math.PI / 8
        await insertPoi(260 * Math.sin(angle) / 110_540, 260 * Math.cos(angle) / 111_320, `POI ${k}`)
      }
      const route = await generateRoute({ start: { latitude: 0, longitude: 0 }, targetDistance: 2000, content: 'mixta' })
      assert.equal(route.shape, 'circular')
      assert.ok(route.stops.length >= 5, `paradas: ${route.stops.length}`)
      assert.ok(route.stops.some((stop) => stop.kind === 'poi'), 'la mixta incluye POIs')
      assert.ok(route.stops.every((stop) => stop.name.length > 0))
      assert.equal(route.theme, 'mixta')
      assert.ok(route.distanceMeters > 1000 && route.distanceMeters < 4000,
        `distancia: ${route.distanceMeters}`)
      assert.ok(route.durationSeconds > 0)
      assert.ok(route.path.length >= 2)
      // La geometría cierra en el punto de partida (primera = última).
      assert.ok(Math.abs(route.path[0].latitude - route.path[route.path.length - 1].latitude) < 1e-5)
    })

    await t.test('las paradas van pegadas al anillo, para que la traza sea circular', async () => {
      await clearStops()
      // Anillo de 8 plantas a 245 m del inicio (el radio del anillo para 2 km).
      for (let k = 0; k < 8; k++) {
        const angle = (Math.PI * 2 * k) / 8
        await insertPlant(245 * Math.sin(angle) / 110_540, 245 * Math.cos(angle) / 111_320, `Planta ${k}`)
      }

      const route = await generateRoute({ start: { latitude: 0, longitude: 0 }, targetDistance: 2000, content: 'botanica' })
      const radiusOf = (point) => Math.hypot(point.latitude * 110_540, point.longitude * 111_320)
      // Las paradas se quedan en la banda del anillo (75 %–125 % del radio):
      // si se dispersan, los tramos cortan por dentro y la traza no es un
      // círculo.
      assert.ok(route.stops.length >= 3, `paradas: ${route.stops.length}`)
      for (const stop of route.stops) {
        const radius = radiusOf(stop)
        assert.ok(radius >= 245 * 0.7 && radius <= 245 * 1.3, `parada a ${Math.round(radius)} m del inicio`)
      }
      // La traza (entre paradas) se mantiene en la banda del anillo.
      const onBand = route.path.filter((point) => {
        const radius = radiusOf(point)
        return radius >= 245 * 0.7 && radius <= 245 * 1.3
      }).length
      assert.ok(onBand >= route.path.length / 2, `trazado por el anillo: ${onBand}/${route.path.length}`)
    })

    await t.test('una ruta recta a petición no cierra el anillo aunque la zona lo permita', async () => {
      await clearStops()
      // 16 plantas repartidas en un anillo de 245 m: la zona da para un anillo.
      for (let k = 0; k < 16; k++) {
        const angle = (Math.PI * 2 * k) / 16
        await insertPlant(245 * Math.sin(angle) / 110_540, 245 * Math.cos(angle) / 111_320, `Planta ${k}`)
      }
      const route = await generateRoute({
        start: { latitude: 0, longitude: 0 },
        targetDistance: 2000,
        content: 'botanica',
        shape: 'lineal',
      })
      assert.equal(route.shape, 'lineal')
      assert.ok(route.stops.length >= 3, `paradas: ${route.stops.length}`)
      // En línea no se cierra el anillo.
      assert.ok(Math.abs(route.path[0].latitude - route.path[route.path.length - 1].latitude) > 1e-5)
    })

    await t.test('cae a una ruta lineal con la longitud objetivo cuando no hay anillo', async () => {
      await clearStops()
      // Solo paradas hacia el este, cada 500 m: no hay nada al norte/sur/oeste.
      for (let k = 1; k <= 8; k++) {
        await insertPlant(0.0002 * k, (500 * k) / 111_320, `Planta este ${k}`)
      }
      const route = await generateRoute({ start: { latitude: 0, longitude: 0 }, targetDistance: 2000, content: 'botanica' })
      assert.equal(route.shape, 'lineal')
      assert.ok(route.stops.length >= 3, `paradas: ${route.stops.length}`)
      assert.ok(route.distanceMeters > 1000 && route.distanceMeters < 3500,
        `distancia: ${route.distanceMeters}`)
      // En línea no se cierra el anillo.
      assert.ok(Math.abs(route.path[0].latitude - route.path[route.path.length - 1].latitude) > 1e-5)
    })

    await t.test('sin paradas alrededor no genera nada y lo dice claro', async () => {
      await clearStops()
      await assert.rejects(
        generateRoute({ start: { latitude: 0, longitude: 0 }, targetDistance: 2000, content: 'botanica' }),
        (error) => error instanceof CatalogError && /No hay paradas/.test(error.message))
    })

    await t.test('sin VALHALLA_URL falla con un mensaje claro', async () => {
      delete process.env.VALHALLA_URL
      const { valhallaRoute } = await import('../src/services/valhalla.ts')
      await assert.rejects(
        valhallaRoute([{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 }]),
        (error) => error instanceof CatalogError && /VALHALLA_URL/.test(error.message))
      process.env.VALHALLA_URL = 'https://valhalla.test'
    })

    await t.test('respuesta rota del motor de rutas -> 502', async () => {
      const previous = globalThis.fetch
      globalThis.fetch = async () => Response.json({ trip: { status: 207, status_message: 'sin ruta' } })
      try {
        const { valhallaRoute } = await import('../src/services/valhalla.ts')
        await assert.rejects(
          valhallaRoute([{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 }]),
          (error) => error instanceof CatalogError && error.status === 502)
      } finally {
        globalThis.fetch = previous
      }
    })

    await t.test('listado y ficha por API, con 404 y 400', async () => {
      await pg.exec(`delete from routes`)
      await pg.query(`insert into routes (name, theme, shape, length_category, distance_meters,
        duration_seconds, start_latitude, start_longitude, description, stops, path)
        values ('Ruta de prueba', 'mixta', 'circular', 'corta', 2100, 1800, 0, 0, 'Descripción de prueba.',
        $1::jsonb, $2::jsonb)`,
        [JSON.stringify([{ kind: 'poi', id: 1, name: 'Torre', latitude: 0.002, longitude: 0.002 }]),
          JSON.stringify([{ latitude: 0, longitude: 0 }, { latitude: 0.002, longitude: 0.002 }])])

      const { app } = await import('../src/app.ts')
      const server = app.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const root = `http://127.0.0.1:${server.address().port}`
      async function request(path) {
        const response = await fetch(root + path)
        return { status: response.status, body: await response.json() }
      }

      try {
        const list = await request('/routes')
        assert.equal(list.status, 200)
        assert.equal(list.body.total, 1)
        assert.equal(list.body.routes[0].name, 'Ruta de prueba')
        assert.equal(list.body.routes[0].lengthCategory, 'corta')
        assert.equal(list.body.routes[0].stopsCount, 1)
        assert.equal(list.body.routes[0].path, undefined, 'el listado no lleva la geometría')

        const detail = await request('/routes/1')
        assert.equal(detail.status, 200)
        assert.equal(detail.body.theme, 'mixta')
        assert.equal(detail.body.shape, 'circular')
        assert.ok(Array.isArray(detail.body.path) && detail.body.path.length === 2)
        assert.equal(detail.body.stops[0].name, 'Torre')

        const missing = await request('/routes/999')
        assert.equal(missing.status, 404)

        const bad = await request('/routes/abc')
        assert.equal(bad.status, 400)
      } finally {
        server.close()
      }
    })

    assert.ok(valhallaCalls > 0, 'el simulador de Valhalla participó')
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.VALHALLA_URL
    restore()
  }
})
