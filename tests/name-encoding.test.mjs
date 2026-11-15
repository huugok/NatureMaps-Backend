import assert from 'node:assert/strict'
import test from 'node:test'
import { repairMojibake } from '../src/services/textEncoding.ts'
import { startFixtureDatabase } from './support/pglite.mjs'

// Nombres del inventario de València con la codificación rota (UTF-8 leído como
// Latin-1): casos reales del geoportal.
const BROKEN = [
  ['CiprÃ©s comÃºn', 'Ciprés común'],
  ['Aligutre del JapÃ³n', 'Aligutre del Japón'],
  ['Ã\u0081rbol pica-pica', 'Árbol pica-pica'],
  ['Ficus matapalo/BenjamÃ­n/Higuera llorona', 'Ficus matapalo/Benjamín/Higuera llorona'],
  ['Limpia tubos llorÃ³n', 'Limpia tubos llorón'],
]

for (const [broken, expected] of BROKEN) {
  test(`repairMojibake: ${expected}`, () => {
    assert.equal(repairMojibake(broken), expected)
  })
}

test('repairMojibake: no toca el texto que ya está bien', () => {
  for (const text of ['Ciprés común', 'Xiprer comú', 'Palmera datilera', 'Cupressus sempervirens', 'Ñandú', '']) {
    assert.equal(repairMojibake(text), text)
  }
})

test('repairMojibake: lo que no se puede corregir con seguridad se deja como está', () => {
  // Contiene la marca pero no es UTF-8 válido al reinterpretarlo, o tiene caracteres fuera de Latin-1.
  for (const text of ['Ã', 'Ã¿ sin sentido Ã', 'Ã€ y ✓']) {
    assert.equal(repairMojibake(text), text)
  }
})

test('repairStoredNames corrige lo guardado y no repite el trabajo', async (t) => {
  const { pg, restore } = await startFixtureDatabase()
  try {
    const species = (await pg.query(
      `insert into species (scientific_name, source) values ('Cupressus sempervirens', 'TEST') returning id`)).rows[0].id
    // Especie rota cuya versión buena ya existe: no se renombra (el nombre es único por fuente).
    await pg.query(`insert into species (scientific_name, source) values ('Pinus pinÃ©a', 'TEST'), ('Pinus pinéa', 'TEST')`)
    const ids = []
    for (const [index, [es, ca]] of [['CiprÃ©s comÃºn', 'Xiprer comÃº'], ['Ciprés común', 'Xiprer comú']].entries()) {
      const plant = (await pg.query(
        `insert into plant_locations (species_id, latitude, longitude, source, external_id, source_url, reported_scientific_name)
         values ($1, 39.47, -0.37, 'TEST', $2, 'https://example.invalid/tree', $3) returning id`,
        [species, `T${index}`, index === 0 ? 'Cupressus sempervirens \'StrÃ­cta\'' : 'Cupressus sempervirens'])).rows[0].id
      ids.push(plant)
      await pg.query(`insert into plant_names (plant_location_id, language, name) values ($1, 'es', $2), ($1, 'ca', $3)`, [plant, es, ca])
    }

    const { repairStoredNames } = await import('../src/services/nameRepair.ts')

    // --check: cuenta y no escribe.
    const check = await repairStoredNames({ apply: false })
    assert.equal(check.plantNames.rows, 2)
    assert.equal(check.plantNames.repairable, 2)
    assert.equal(check.plantNames.updated, 0)
    assert.equal((await pg.query(`select count(*)::int as n from plant_names where name like '%Ã%'`)).rows[0].n, 2)

    const applied = await repairStoredNames({ apply: true })
    assert.equal(applied.plantNames.updated, 2)
    assert.equal(applied.reportedScientificNames.updated, 1)
    const names = (await pg.query(`select name from plant_names order by id`)).rows.map((row) => row.name)
    assert.deepEqual(names, ['Ciprés común', 'Xiprer comú', 'Ciprés común', 'Xiprer comú'])
    assert.equal((await pg.query(`select reported_scientific_name as n from plant_locations order by id`)).rows[0].n, "Cupressus sempervirens 'Strícta'")

    // Segunda ejecución: nada que corregir.
    const again = await repairStoredNames({ apply: true })
    assert.equal(applied.speciesNames.updated, 0)
    assert.equal(applied.speciesNames.skipped, 1)
    assert.equal(again.plantNames.rows, 0)
    assert.equal(again.plantNames.updated, 0)
    assert.equal(again.reportedScientificNames.updated, 0)
  } finally {
    restore()
    await pg.close()
  }
})

test('el import de València corrige los nombres con la codificación rota', async () => {
  const { fetchValenciaTrees } = await import('../src/services/valenciaOpenData.ts')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => Response.json({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        idarbol: '1', nom_botanico: 'Cupressus sempervirens', nom_comu_c: 'CiprÃ©s comÃºn', nom_comu_v: 'Xiprer comÃº',
        estado_gral: 'Bueno', distrito: 'X', barrio: 'Y',
      },
      geometry: { type: 'Point', coordinates: [-0.37, 39.47] },
    }],
  })
  try {
    const page = await fetchValenciaTrees(10, 0)
    assert.equal(page.records[0].commonNameEs, 'Ciprés común')
    assert.equal(page.records[0].commonNameCa, 'Xiprer comú')
  } finally {
    globalThis.fetch = originalFetch
  }
})
