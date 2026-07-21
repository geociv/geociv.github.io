import type { Settings } from '../db/types'

export function formatMoney(amount: number, settings: Settings): string {
  try {
    return new Intl.NumberFormat(settings.locale, {
      style: 'currency',
      currency: settings.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Si el código de moneda no es válido, cae a símbolo + número
    return `${settings.currencySymbol}${amount.toFixed(2)}`
  }
}

export function formatNumber(amount: number, settings: Settings): string {
  try {
    return new Intl.NumberFormat(settings.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return amount.toFixed(2)
  }
}

/** Convierte texto del usuario a número, aceptando coma o punto decimal. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return NaN
  return roundMoney(n)
}

/** Redondea a 2 decimales evitando errores de coma flotante. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Limpia lo que el usuario escribe en el campo de monto:
 * - sin signo negativo ni letras
 * - un solo separador decimal
 * - máximo 2 decimales
 */
export function sanitizeAmountInput(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, '')
  const sepIndex = s.search(/[.,]/)
  if (sepIndex !== -1) {
    const head = s.slice(0, sepIndex)
    const sep = s[sepIndex]
    const decimals = s
      .slice(sepIndex + 1)
      .replace(/[.,]/g, '')
      .slice(0, 2)
    s = head + sep + decimals
  }
  return s
}
