// A source-local parsing rule, not global taxonomic identity or a GBIF match.
export function toBinomialName(name: string): string | null {
  return name.trim().replace(/\s+/g, ' ')
    .match(/^([A-Z][a-z]+ [a-z][a-z-]+)(?:$|\s+(?:['"‘’].+['"‘’]|hembra|macho)$)/u)?.[1] ?? null
}
