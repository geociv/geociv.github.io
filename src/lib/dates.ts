import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { es } from 'date-fns/locale'

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Range {
  start: Date
  end: Date
  /** Etiqueta legible del período, ej. "Semana del 14 al 20 jul 2026". */
  label: string
}

/** Convierte una fecha (o string YYYY-MM-DD) al rango del período que la contiene. */
export function rangeFor(
  period: Period,
  ref: Date | string,
  weekStartsOn: 0 | 1 = 1,
): Range {
  const d = typeof ref === 'string' ? parseISO(ref) : ref
  switch (period) {
    case 'daily':
      return {
        start: startOfDay(d),
        end: endOfDay(d),
        label: capitalize(format(d, "EEEE d 'de' MMMM yyyy", { locale: es })),
      }
    case 'weekly': {
      const start = startOfWeek(d, { weekStartsOn })
      const end = endOfWeek(d, { weekStartsOn })
      return {
        start,
        end,
        label: `Semana del ${format(start, 'd MMM', { locale: es })} al ${format(
          end,
          'd MMM yyyy',
          { locale: es },
        )}`,
      }
    }
    case 'monthly':
      return {
        start: startOfMonth(d),
        end: endOfMonth(d),
        label: capitalize(format(d, 'MMMM yyyy', { locale: es })),
      }
    case 'yearly':
      return {
        start: startOfYear(d),
        end: endOfYear(d),
        label: `Año ${format(d, 'yyyy', { locale: es })}`,
      }
  }
}

export function inRange(dateISO: string, range: Range): boolean {
  const d = parseISO(dateISO).getTime()
  return d >= range.start.getTime() && d <= range.end.getTime()
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function fmtDate(dateISO: string): string {
  return format(parseISO(dateISO), "d MMM yyyy", { locale: es })
}

export function fmtDateShort(dateISO: string): string {
  return format(parseISO(dateISO), 'dd/MM/yy', { locale: es })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
