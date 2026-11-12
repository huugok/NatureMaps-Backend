import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { CatalogError } from '../src/services/catalogError.ts'
import { displayName, fetchHeritageLayer, heritageLayers } from '../src/services/valenciaHeritage.ts'

// Import de POIs (NM-06) en sus casos límite: paginación, features inválidas,
// ids duplicados y fallos del geoportal. Sin base de datos ni red: `fetch` se
// sustituye por una cola de respuestas que se vacía en cada test.
const [MONUMENTOS, RECURSOS] = heritageLayers()

let originalFetch
let calls
let queue

function features(count, build) {
  return Array.from({ length: count }, (_, i) => build(i))
}

function monument(gid, nombre, x, y) {
  return { attributes: { gid, nombre }, geometry: { x, y } }
}

function monumentos(count, startId = 1) {
  return features(count, (i) => monument(startId + i, `MONUMENT ${startId + i}`, -0.37, 39.47))
}

// El servicio corta la paginación con `exceededTransferLimit: false` o con una
// página incompleta; la cola vacía devuelve esa página final para no colgar.
const EMPTY_PAGE = { body: { features: [], exceededTransferLimit: false } }

before(() => {
  originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const next = queue.shift() ?? EMPTY_PAGE
    return Response.json(next.body, next.status === undefined ? undefined : { status: next.status })
  }
})

after(() => {
  globalThis.fetch = originalFetch
})

beforeEach(() => {
  calls = []
  queue = []
})

test('paginación: acumula páginas mientras exceededTransferLimit sea true', async () => {
  queue = [
    { body: { features: monumentos(1000), exceededTransferLimit: true } },
    { body: { features: monumentos(2, 1001), exceededTransferLimit: false } },
  ]

  const { records, fetched, invalid } = await fetchHeritageLayer(MONUMENTOS)

  assert.equal(calls.length, 2)
  assert.equal(records.length, 1002)
  assert.equal(fetched, 1002)
  assert.equal(invalid, 0)
  // La segunda página se pide con el offset acumulado y no hay una tercera.
  assert.match(calls[1], /resultOffset=1000/)
})

test('paginación: sin exceededTransferLimit, una página llena pide otra', async () => {
  queue = [{ body: { features: monumentos(1000) } }]

  const { records, fetched } = await fetchHeritageLayer(MONUMENTOS)

  assert.equal(calls.length, 2)
  assert.equal(records.length, 1000)
  assert.equal(fetched, 1000)
})

test('features inválidas: coordenadas fuera de rango, sin nombre y sin attributes', async () => {
  queue = [{
    body: {
      features: [
        monument(1, 'FUERA DE RANGO', 0, 91),
        { attributes: { gid: 2 }, geometry: { x: 0, y: 39 } },
        { geometry: { x: 0, y: 39 } },
        monument(4, 'LLOTJA', -0.3785, 39.4742),
      ],
      exceededTransferLimit: false,
    },
  }]

  const { records, invalid } = await fetchHeritageLayer(MONUMENTOS)

  assert.equal(invalid, 3)
  assert.equal(records.length, 1)
  assert.equal(records[0].externalId, '202:4')
  assert.equal(records[0].name, displayName('LLOTJA'))
})

test('id duplicado: el servicio no deduplica dentro de la misma capa', async () => {
  queue = [{
    body: {
      features: [
        monument(42, 'LLOTJA', -0.3785, 39.4742),
        monument(42, 'LLOTJA (REPETIDA)', -0.3785, 39.4742),
      ],
      exceededTransferLimit: false,
    },
  }]

  // Comportamiento actual, no un contrato: ambas features entran en `records` y
  // la idempotencia frente a `(source, external_id)` la resuelve la escritura.
  // Si el producto quiere deduplicar aquí, este caso es la evidencia.
  const { records, invalid } = await fetchHeritageLayer(MONUMENTOS)

  assert.equal(invalid, 0)
  assert.equal(records.length, 2)
  assert.deepEqual(records.map((record) => record.externalId), ['202:42', '202:42'])
})

test('502 del geoportal: CatalogError con el status y el mensaje del servicio', async () => {
  queue = [{ body: { error: 'fixture upstream failure' }, status: 502 }]

  await assert.rejects(fetchHeritageLayer(MONUMENTOS), (error) => {
    assert.ok(error instanceof CatalogError)
    assert.equal(error.status, 502)
    assert.match(error.message, /No se pudo descargar la capa 202/)
    return true
  })
  assert.equal(calls.length, 1)
})

test('informacion_recurso: solo una URL http(s) llega a infoUrl', async () => {
  queue = [{
    body: {
      features: [
        {
          attributes: { objectid: 10, nombre: '10-MUSEO DE BELLAS ARTES', informacion_recurso: 'ver ficha' },
          geometry: { x: -0.3705, y: 39.4788 },
        },
        {
          attributes: {
            objectid: 11,
            nombre: '11-JARDÍN BOTÁNICO',
            informacion_recurso: 'https://www.valencia.es/ficha/10.pdf',
          },
          geometry: { x: -0.3862, y: 39.4765 },
        },
      ],
      exceededTransferLimit: false,
    },
  }]

  const { records, invalid } = await fetchHeritageLayer(RECURSOS)

  assert.equal(invalid, 0)
  assert.equal(records.length, 2)
  assert.equal(records[0].infoUrl, null)
  assert.equal(records[1].infoUrl, 'https://www.valencia.es/ficha/10.pdf')
})
