import assert from 'node:assert/strict'
import test from 'node:test'
import { displayName } from '../src/services/valenciaHeritage.ts'

// Nombres oficiales del geoportal: mayúsculas de origen, pero conservan
// partículas, apóstrofos y números romanos al pasarlos a mayúscula inicial.
const CASES = [
  ['TORRES DELS SERRANS', 'Torres dels Serrans'],
  ["CASA PALAU DELS COMTES D'ALMENARA", "Casa Palau dels Comtes d'Almenara"],
  ['CASA SENYORIAL AL CARRER DE BAIX', 'Casa Senyorial al Carrer de Baix'],
  ['CASA CONSISTORIAL I ENTORN URBANÍSTIC - II', 'Casa Consistorial i Entorn Urbanístic - II'],
  ["L'ALMOINA. CENTRE ARQUEOLÒGIC", "L'Almoina. Centre Arqueològic"],
  ['PALAU DELS MARQUESOS DE MALFERIT O DELS COMTES DE BRIZUELA', 'Palau dels Marquesos de Malferit o dels Comtes de Brizuela'],
]

for (const [raw, expected] of CASES) {
  test(`displayName: ${raw}`, () => {
    assert.equal(displayName(raw), expected)
  })
}
