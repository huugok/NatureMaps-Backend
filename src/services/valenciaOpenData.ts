// Fetches tree records from the Valencia City Council open data (Arbolado / Arbratge)
// ArcGIS REST endpoint. See docs/Flower MAP — Data Sources.md, section 2.1.
const ARBOLADO_ENDPOINT =
  'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/151/query'

interface ArbolTreeFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    idarbol: string
    nom_botanico: string | null
    nom_comu_c: string | null
    nom_comu_v: string | null
    distrito: string | null
    barrio: string | null
  }
}

interface ArbolFeatureCollection {
  type: 'FeatureCollection'
  features: ArbolTreeFeature[]
}

export interface ValenciaTree {
  externalId: string
  scientificName: string | null
  commonNameEs: string | null
  commonNameCa: string | null
  district: string | null
  neighborhood: string | null
  latitude: number
  longitude: number
}

export async function fetchValenciaTrees(limit = 200): Promise<ValenciaTree[]> {
  const url = new URL(ARBOLADO_ENDPOINT)
  url.searchParams.set('where', '1=1')
  url.searchParams.set(
    'outFields',
    'idarbol,nom_botanico,nom_comu_c,nom_comu_v,distrito,barrio',
  )
  url.searchParams.set('resultRecordCount', String(limit))
  url.searchParams.set('f', 'geojson')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Valencia Open Data request failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as ArbolFeatureCollection

  return data.features.map((feature) => ({
    externalId: feature.properties.idarbol,
    scientificName: feature.properties.nom_botanico,
    commonNameEs: feature.properties.nom_comu_c,
    commonNameCa: feature.properties.nom_comu_v,
    district: feature.properties.distrito,
    neighborhood: feature.properties.barrio,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  }))
}
