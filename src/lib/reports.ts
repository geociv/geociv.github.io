import type { Category, Transaction } from '../db/types'
import { rootSectionId } from './categories'
import { inRange, type Period, type Range } from './dates'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface CategoryBreakdown {
  categoryId: string
  name: string
  color: string
  total: number
}

export interface MethodBreakdown {
  efectivo: number
  transferencia: number
  otro: number
}

export interface ReportSummary {
  income: number
  expense: number
  balance: number
  count: number
  /** Ingresos agrupados por SECCIÓN (nivel 1). */
  incomeByCategory: CategoryBreakdown[]
  /** Egresos agrupados por SECCIÓN (nivel 1). */
  expenseByCategory: CategoryBreakdown[]
  incomeByMethod: MethodBreakdown
  expenseByMethod: MethodBreakdown
  transactions: Transaction[]
}

/** Calcula ingresos, egresos, balance y desglose por categoría dentro de un rango. */
export function summarize(
  all: Transaction[],
  categories: Category[],
  range: Range,
): ReportSummary {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const txs = all.filter((t) => !t.deleted && inRange(t.date, range))

  let income = 0
  let expense = 0
  // Agrupa por la SECCIÓN raíz de cada movimiento (sube desde la subsección)
  const incomeAcc = new Map<string, number>()
  const expenseAcc = new Map<string, number>()
  const incomeByMethod: MethodBreakdown = { efectivo: 0, transferencia: 0, otro: 0 }
  const expenseByMethod: MethodBreakdown = { efectivo: 0, transferencia: 0, otro: 0 }

  for (const t of txs) {
    const rootId = rootSectionId(categories, t.categoryId)
    const methodKey: keyof MethodBreakdown =
      t.paymentMethod === 'efectivo' ? 'efectivo' : t.paymentMethod === 'transferencia' ? 'transferencia' : 'otro'
    if (t.type === 'income') {
      income += t.amount
      incomeAcc.set(rootId, (incomeAcc.get(rootId) ?? 0) + t.amount)
      incomeByMethod[methodKey] += t.amount
    } else {
      expense += t.amount
      expenseAcc.set(rootId, (expenseAcc.get(rootId) ?? 0) + t.amount)
      expenseByMethod[methodKey] += t.amount
    }
  }

  const toBreakdown = (acc: Map<string, number>): CategoryBreakdown[] =>
    [...acc.entries()]
      .map(([categoryId, total]) => ({
        categoryId,
        name: catMap.get(categoryId)?.name ?? 'Sin categoría',
        color: catMap.get(categoryId)?.color ?? '#94a3b8',
        total,
      }))
      .sort((a, b) => b.total - a.total)

  return {
    income,
    expense,
    balance: income - expense,
    count: txs.length,
    incomeByCategory: toBreakdown(incomeAcc),
    expenseByCategory: toBreakdown(expenseAcc),
    incomeByMethod,
    expenseByMethod,
    transactions: txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
  }
}

/** Balance total histórico (todos los movimientos vivos). */
export function totalBalance(all: Transaction[]): {
  income: number
  expense: number
  balance: number
} {
  let income = 0
  let expense = 0
  for (const t of all) {
    if (t.deleted) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, balance: income - expense }
}

export interface SeriesPoint {
  label: string
  income: number
  expense: number
}

/** Serie temporal para la gráfica: por mes si es anual, por día en el resto. */
export function seriesFor(all: Transaction[], range: Range, period: Period): SeriesPoint[] {
  const byKey = new Map<string, { income: number; expense: number }>()
  const yearly = period === 'yearly'
  for (const t of all) {
    if (t.deleted || !inRange(t.date, range)) continue
    const key = yearly ? t.date.slice(0, 7) : t.date // YYYY-MM ó YYYY-MM-DD
    const cur = byKey.get(key) ?? { income: 0, expense: 0 }
    if (t.type === 'income') cur.income += t.amount
    else cur.expense += t.amount
    byKey.set(key, cur)
  }
  return [...byKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({
      label: yearly ? MONTHS[Number(key.slice(5, 7)) - 1] : key.slice(5),
      income: v.income,
      expense: v.expense,
    }))
}
