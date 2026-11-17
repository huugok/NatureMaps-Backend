// Algunos nombres del inventario de València llegan con la codificación rota: el texto
// UTF-8 se guardó como si fuera Latin-1 y «Ciprés común» queda «CiprÃ©s comÃºn». Es un
// error de la fuente (el geoportal lo sirve así), no de la descarga.

const MOJIBAKE_MARKER = /[ÃÂ]/
const strictUtf8 = new TextDecoder('utf-8', { fatal: true })

/** true si el texto tiene la marca típica de un UTF-8 leído como Latin-1. */
export function looksMojibake(text: string): boolean {
  return MOJIBAKE_MARKER.test(text)
}

/**
 * Devuelve el texto corregido si estaba mal codificado; si no lo estaba, o no se puede
 * corregir con seguridad, lo devuelve tal cual. Solo se acepta un UTF-8 válido, así que
 * un texto correcto nunca se estropea.
 */
export function repairMojibake(text: string): string {
  if (!looksMojibake(text)) return text
  // La «à» (UTF-8 C3 A0) llega como «Ã» + espacio duro, y la fuente normaliza ese espacio
  // duro a uno normal («AcÃ cia» por «Acàcia»). Una «Ã» seguida de un espacio normal nunca
  // aparece en un texto correcto, así que se restituye el byte perdido antes de decodificar.
  const restored = text.replace(/Ã /g, 'Ã\u00A0')
  const bytes = new Uint8Array(restored.length)
  for (let index = 0; index < restored.length; index += 1) {
    const code = restored.charCodeAt(index)
    if (code > 0xff) return text
    bytes[index] = code
  }
  try {
    const repaired = strictUtf8.decode(bytes)
    return repaired.includes('�') ? text : repaired
  } catch {
    return text
  }
}
