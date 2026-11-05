import assert from 'node:assert/strict'
import test from 'node:test'
import { editorialReference, inventoryReference, withSpeciesProvenance } from '../src/services/provenance.ts'

test('legacy references expose only known providers and explicitly recorded consultation dates', () => {
  const source = editorialReference({ name: 'Wikipedia (es)', url: 'https://es.wikipedia.org/wiki/Citrus',
    description: 'Texto CC BY-SA · Consulta 25/10/2026' })
  assert.equal(source.provider, 'Wikimedia Foundation')
  assert.equal(source.date, '2026-10-25')
  assert.equal(source.dateType, 'consulted')
  assert.match(source.description, /CC BY-SA/)
  assert.equal(editorialReference({ url: 'https://es.wikipedia.org.evil.invalid/x' }).provider, null)
  assert.equal(editorialReference({ url: 'javascript:alert(1)' }), null)
  for (const date of ['31/02/2026', '29/02/2026', '00/10/2026']) {
    assert.equal(editorialReference({ url: 'https://example.org', description: `Consulta ${date}` }).date, null)
  }
})

test('explicit version and responsible entity survive normalization without inventing dates', () => {
  const source = editorialReference({ name: 'Herbario', provider: 'Universidad', url: 'https://example.org/v2', version: '2.0' })
  assert.equal(source.provider, 'Universidad')
  assert.equal(source.version, '2.0')
  assert.equal(source.date, null)
  assert.equal(source.dateType, null)
})

test('inventory retains the specimen URL and actual import date; only the species uses the dataset URL', () => {
  const specimen = inventoryReference('VALENCIA_ARBOLADO', 'https://geoportal.valencia.es/tree/1', '2026-10-31T18:43:18Z')
  assert.equal(specimen.provider, 'Ajuntament de València')
  assert.equal(specimen.url, 'https://geoportal.valencia.es/tree/1')
  assert.equal(specimen.date, '2026-10-31T18:43:18.000Z')
  assert.equal(specimen.dateType, 'imported')
  assert.match(inventoryReference('VALENCIA_ARBOLADO', specimen.url, specimen.date, true).url, /dataset/)
  assert.equal(inventoryReference('UNKNOWN', 'https://example.org', null).provider, null)
})

test('species combine inventory, selected text and actual image without losing credits', () => {
  const result = withSpeciesProvenance({ id: 1, fetchedAt: '2026-11-01T12:00:00Z', profile: null,
    inventorySources: [{ source: 'VALENCIA_ARBOLADO', url: 'https://geoportal.valencia.es/tree/1', date: '2026-10-31' }],
    enrichment: { url: 'https://en.wikipedia.org/wiki/Citrus', license: 'CC BY-SA 4.0' },
    image: { sourceUrl: 'https://commons.wikimedia.org/wiki/File:Citrus.jpg', attribution: 'Photographer · CC BY-SA 4.0' } })
  assert.equal('inventorySources' in result, false)
  assert.deepEqual(result.provenance.map((source) => source.scope), ['inventory', 'editorial', 'image'])
  assert.equal(result.provenance[1].dateType, 'retrieved')
  assert.match(result.provenance[2].description, /Photographer/)
})
