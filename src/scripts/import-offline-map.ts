import { readFile } from 'node:fs/promises'
import { inspectMapArchive, storeMapArchive } from '../services/offlineMaps.js'

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((arg) => arg.startsWith('--file='))?.slice(7)
  const source = args.find((arg) => arg.startsWith('--source='))?.slice(9)
  if (!file || !source) throw new Error('Uso: npm run import:mapa -- --file=valencia.pmtiles --source=https://build.protomaps.com/FECHA.pmtiles [--check]')
  const bytes = await readFile(file)
  const result = args.includes('--check') ? inspectMapArchive(bytes) : await storeMapArchive(bytes, source)
  console.log(JSON.stringify(result))
}

main().catch(() => { console.error('No se pudo importar el mapa. Revisa el archivo, su procedencia y la conexión a la base.'); process.exitCode = 1 })
