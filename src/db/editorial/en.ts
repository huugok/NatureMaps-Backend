// Editorial content in English (NM-08). A translation of the Spanish texts in
// `es.ts`, with the same sources and the same figures: if a number changes in
// Spanish it has to change here too. Place names keep their Spanish or
// Valencian form, which is how they are signposted in the city, with a short
// gloss the first time a reader needs one. Structure (section, green space,
// sources) lives in `articles.ts`.

import type { ArticleText } from './text.js'

export const EN: Record<string, ArticleText> = {
  'flora-caracteristica-de-valencia': {
    title: 'Characteristic flora of València',
    summary: 'Bitter orange trees along the pavements, jacarandas that turn spring violet and century-old figs: the trees that give the city its character.',
    body: [
      'To walk through València is to walk under trees. The municipal tree inventory, which Nature MAPS uses as the basis of its map, records more than 157,000 specimens in streets and gardens. Among the most common is the bitter orange, with more than 12,600 trees. The jacaranda, originally from South America, adds more than 5,200 and covers its crown in blue-violet flowers in spring.',
      'The city’s giants are the Moreton Bay figs (Ficus macrophylla). The city council looks after the specimens in the Parterre, the Glorieta and the Alameda promenade as monumental trees, recognisable by the sheer size of their trunk and crown.',
      'Date and Canary Island palms, pines, mulberries, olives and magnolias complete a plant landscape where Mediterranean species live alongside others brought from far away. Each plant page in the app shows which parks and gardens you can find it in.',
    ].join('\n\n'),
  },
  'parques-urbanos-de-valencia': {
    title: 'The urban parks of València',
    summary: 'From the old bed of the river Turia to the neighbourhood parks: the large green spaces that give the city its shape.',
    body: [
      'València’s great park was born of a disaster. After the flood of 1957 the river was diverted, and the bed left behind became the Jardín del Turia, a park that crosses the city from west to east almost as far as the sea. At its western end it continues into Parque de Cabecera.',
      'Around that axis the city has added neighbourhood parks: Benicalap, Orriols, Parque del Oeste, Natzaret, and later Marxalenes and La Rambleta, designed in the late 1990s. Parque Central, next to Russafa, joins that list.',
      'On the Nature MAPS map you can switch on the green spaces layer to see the outline of each park and open its page, with the most common species and the points of interest inside it.',
    ].join('\n\n'),
  },
  'jardin-del-turia': {
    title: 'Jardín del Turia: the river that became a garden',
    summary: 'The old bed of the Turia, left empty when the river was diverted, is today the long linear park that crosses València under eighteen bridges.',
    body: [
      'On 14 October 1957 the Turia burst its banks and flooded València. To stop it happening again, the so-called Solución Sur (Southern Plan) was approved, taking the river along a new course to the south of the city. The historic bed was left dry, and in 1979 the city council finally agreed that this land would become a green space and a public park.',
      'The result is a linear garden several kilometres long, divided into sections, which you can walk or cycle without crossing a single street: the eighteen bridges that once spanned the river now pass over the park. Along the way there are wooded stretches, ponds, sports facilities and play areas.',
      'In Nature MAPS the Jardín del Turia appears as a single green space made up of all its sections, exactly as the city council publishes them.',
    ].join('\n\n'),
  },
  'parque-de-cabecera': {
    title: 'Parque de Cabecera: a riverside woodland',
    summary: 'Where the river used to enter the city, a lake, a riverside woodland and a viewpoint hill recreate the landscape of the Turia.',
    body: [
      'Parque de Cabecera occupies the historic bed of the Turia and extends the Jardín del Turia westwards. The design set out to recover the landscape typical of Mediterranean rivers: a riverside woodland in which water, relief and vegetation come together.',
      'According to the city council, its vegetation is made up of riverside woodland, Mediterranean pine groves and exotic trees. At the heart of the park is a lake, and from the viewpoint hill you can see the whole site and, in the distance, the Sierra Calderona. Two main routes, the Senda de la Ribera and the Paseo del Molí del Sol, run along either shore of the lake.',
    ].join('\n\n'),
  },
  'jardines-historicos-de-valencia': {
    title: 'Historic gardens of València',
    summary: 'Viveros, Monforte, the Glorieta, the Parterre and the Botanical Garden: gardens with centuries of history, a few steps from one another.',
    body: [
      'València’s public gardens go back to the 19th century. The Glorieta grew out of an 1813 plan to turn a square into a tree-lined promenade, and work on the Parterre began around 1850. Both still have the monumental fig trees that are now part of their character.',
      'The Jardines del Real, known locally as Viveros, stand on the site of the vanished Royal Palace. The Jardín de Monforte keeps its 19th-century neoclassical layout. And the Botanical Garden of the Universitat de València, which began as a garden of medicinal plants in 1567, has the Jardín de las Hespérides, devoted to citrus trees, right against its wall.',
      'Each has its own article in this section and its own page on the map.',
    ].join('\n\n'),
  },
  'jardines-del-real-viveros': {
    title: 'Jardines del Real (Viveros)',
    summary: 'The garden that surrounded València’s Royal Palace: from the kings’ orchard to the municipal tree nursery and today’s park.',
    body: [
      'The Royal Palace of València once stood here, demolished in the 19th century. A few ruins of the palace remain inside the garden; from its orchards comes its name.',
      'In 1903 the grounds were given to the city council to be used as a tree nursery — vivero in Spanish — which is where the popular name Viveros comes from. In the early 20th century it began to be turned into today’s public park, growing section by section.',
      'It is now one of the largest gardens in the city, with tree-lined walks, sculptures and doorways from vanished buildings that were moved here.',
    ].join('\n\n'),
  },
  'jardin-de-monforte': {
    title: 'Jardín de Monforte',
    summary: 'A 19th-century neoclassical garden with marble statues, fountains and ponds, a short walk from the Alameda.',
    body: [
      'The Jardín de Monforte was created in the second half of the 19th century, when one of the orchards outside the city walls was turned into a neoclassical garden with a small palace.',
      'It covers some 12,000 square metres, with ornamental fountains, ponds and statues; among its sculptures, the lions by José Bellver stand out.',
      'It is protected as a historic and artistic monument. It passed into municipal ownership and, after being restored, opened to the public in 1973.',
    ].join('\n\n'),
  },
  'jardin-de-las-hesperides': {
    title: 'Jardín de las Hespérides',
    summary: 'A collection garden devoted to citrus trees, telling the myth of the golden apples beside the wall of the Botanical Garden.',
    body: [
      'The Jardín de las Hespérides is a contemporary garden of just over four thousand square metres, right against the Botanical Garden. It is a collection garden: it brings together citrus varieties and so recovers the Valencian tradition of growing orange and lemon trees as ornamentals.',
      'Its narrative thread is the Greek myth of the Hesperides, the nymphs who guarded a garden of golden apples. The story is told through plants and three sculptures: Hercules, the nymphs turning into trees, and Venus. Rows of cypresses, like green walls, divide the space and draw the eye towards the trees of the Botanical Garden.',
    ].join('\n\n'),
  },
  'paisajismo-en-valencia': {
    title: 'Landscaping: how València’s green has been drawn',
    summary: 'From the market gardens that once ringed the city to the parks in the old riverbed: two centuries of decisions behind today’s landscape.',
    body: [
      'For centuries València’s great garden was the Huerta, the market gardens that surrounded it like a tapestry of crops and irrigation channels. Public gardens arrived in the 19th century, with tree-lined promenades such as the Glorieta and gardens such as the Parterre and Monforte.',
      'The 1957 flood changed the scale of things. Diverting the river gave the city a continuous green corridor, the Jardín del Turia, and with it a new way of thinking about its parks: connected to one another and meant to be walked. Parque de Cabecera, which recreates a riverside woodland, and the Jardín de las Hespérides, which reinterprets the old ornamental citrus gardens, are two recent examples of gardens that say something about where they stand.',
      'The outline of every green space you see on the map comes from the city council’s open data.',
    ].join('\n\n'),
  },
}
