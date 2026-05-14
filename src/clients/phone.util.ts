/**
 * Normalización de teléfonos a formato E.164 canónico.
 *
 * Problema que resuelve: el admin/cliente puede pegar el número en mil
 * formatos ("+54 9 11 5555-2200", "011 5555 2200", "5491155552200", etc.).
 * Sin normalización terminamos guardando el mismo contacto como dos clients
 * distintos (la columna `phone` es UNIQUE), perdiendo el historial.
 *
 * Para Argentina (+54) además aplica las reglas locales:
 *   - quita el "0" troncal si está
 *   - asegura el "9" móvil al inicio (WhatsApp lo requiere)
 *   - colapsa duplicaciones del code (ej: "+54 549..." → "+549...")
 *
 * Para el resto: countryCode + dígitos únicos.
 *
 * @returns string E.164 sin espacios (ej: "+5491155552200"), o "" si la
 *          entrada está vacía. NO valida largo mínimo — eso lo decide el caller.
 */
export function normalizePhone(input: string, countryCode = '+54'): string {
  if (!input) return '';

  // 1) Solo dígitos. Acepta "+", espacios, guiones, paréntesis, etc.
  let digits = input.replace(/\D/g, '');
  if (!digits) return '';

  const ccDigits = countryCode.replace(/\D/g, '') || '54';

  // 2) Si arranca con el country code, lo sacamos (puede aparecer más de una
  //    vez por error de tipeo "+54 +54 11..." → digits "5454...")
  while (digits.startsWith(ccDigits)) {
    digits = digits.slice(ccDigits.length);
  }

  // 3) Reglas Argentina
  if (ccDigits === '54') {
    // "0" troncal doméstico: 011 4567 8900 → 11 4567 8900
    if (digits.startsWith('0')) digits = digits.slice(1);
    // "9" móvil: lo sacamos para re-agregarlo prolijo (idempotente)
    if (digits.startsWith('9')) digits = digits.slice(1);
    return `+549${digits}`;
  }

  return `+${ccDigits}${digits}`;
}

/**
 * Validación liviana: ¿la entrada normalizada parece un número usable?
 * Para Argentina queremos al menos +54 9 + 8 dígitos (área + número corto).
 * No bloquea: solo para que el caller decida si pedir más data al usuario.
 */
export function isLikelyValidPhone(normalized: string): boolean {
  if (!normalized.startsWith('+')) return false;
  const digits = normalized.slice(1);
  return digits.length >= 10 && digits.length <= 15;
}
