import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDryRun } from '../src/services/poiProfiles.ts'
import { parseImageCredits } from '../src/services/wikimedia.ts'

// Informe de `npm run db:seed:pois -- --dry-run` (plan 007): el formato se prueba
// sin base ni red; la consulta que lo alimenta se ejercita con la seed manual.
test('formatDryRun marca los nombres que emparejan con el catálogo', () => {
  const informe = formatDryRun([
    { sourceName: 'LLOTJA', found: true, wikipedia: 'Lonja de la Seda', languages: ['ca', 'es'] },
  ])
  assert.match(informe, /sí/)
  assert.match(informe, /Encontrados: 1\/1/)
})

test('formatDryRun deja visible el nombre original cuando no empareja', () => {
  const informe = formatDryRun([
    { sourceName: 'PALAU DE MONTORNÉS', found: false, wikipedia: 'Montornès del Vallès', languages: [] },
  ])
  const [, , fila] = informe.split('\n')
  assert.match(fila, /^PALAU DE MONTORNÉS\s+\| no\s+\|/)
  assert.match(informe, /Encontrados: 0\/1/)
})

test('formatDryRun con la lista vacía no divide por cero', () => {
  const informe = formatDryRun([])
  assert.match(informe, /Encontrados: 0\/0/)
})

// Verificación de licencias (plan 009): una foto solo se guarda si la licencia es
// reutilizable, hay autor y hay atribución.
const imageinfo = (licenseUrl, extra = {}) => ({
  thumburl: 'https://upload.wikimedia.org/x.jpg',
  descriptionurl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
  extmetadata: {
    LicenseShortName: { value: extra.license ?? 'CC BY-SA 4.0' },
    LicenseUrl: { value: licenseUrl },
    Artist: { value: 'Fotógrafo' },
  },
})

test('parseImageCredits verifica una CC BY-SA con versión portada por jurisdicción', () => {
  const creditos = parseImageCredits(imageinfo('https://creativecommons.org/licenses/by-sa/3.0/es/', { license: 'CC BY-SA 3.0 es' }), 'https://x', 'https://y')
  assert.equal(creditos?.licenseVerified, true)
  assert.ok(creditos?.attribution.includes('CC BY-SA 3.0 es'))
})

test('parseImageCredits verifica una licencia con la URL deed', () => {
  const creditos = parseImageCredits(imageinfo('https://creativecommons.org/publicdomain/zero/1.0/deed.en', { license: 'CC0' }), 'https://x', 'https://y')
  assert.equal(creditos?.licenseVerified, true)
})

test('parseImageCredits rechaza una licencia no reutilizable', () => {
  const creditos = parseImageCredits(imageinfo('https://creativecommons.org/licenses/by-nc/4.0/', { license: 'CC BY-NC 4.0' }), 'https://x', 'https://y')
  assert.equal(creditos?.licenseVerified, false)
})

test('parseImageCredits exige autor aunque la licencia sea reutilizable', () => {
  const info = imageinfo('https://creativecommons.org/licenses/by-sa/4.0/')
  delete info.extmetadata.Artist
  assert.equal(parseImageCredits(info, 'https://x', 'https://y')?.licenseVerified, false)
})
