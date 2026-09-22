import type { AccountId, Category, CategoryScope, Transaction, TxType } from '../db/types'

/** Secciones (nivel 1) de una cuenta que aplican a un tipo de movimiento. */
export function sectionsFor(categories: Category[], type: TxType, account: AccountId): Category[] {
  return categories
    .filter((c) => c.account === account && !c.parentId && (c.scope === type || c.scope === 'both'))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Todas las secciones (nivel 1) de una cuenta, sin importar el tipo. */
export function sectionsOfAccount(categories: Category[], account: AccountId): Category[] {
  return categories
    .filter((c) => c.account === account && !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Subsecciones (nivel 2) de una sección; opcionalmente filtradas por tipo. */
export function subsectionsOf(categories: Category[], parentId: string, type?: TxType): Category[] {
  return categories
    .filter((c) => c.parentId === parentId && (!type || c.scope === type || c.scope === 'both'))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Opciones planas para elegir dónde va un movimiento: la sección y, debajo,
 * cada una de sus subsecciones como "Sección › Subsección".
 */
export function leafOptionsFor(
  categories: Category[],
  type: TxType,
  account: AccountId,
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const s of sectionsFor(categories, type, account)) {
    out.push({ id: s.id, label: s.name })
    for (const sub of subsectionsOf(categories, s.id, type)) {
      out.push({ id: sub.id, label: `${s.name} › ${sub.name}` })
    }
  }
  return out
}

/** Devuelve el id de la sección raíz de cualquier categoría (para agrupar reportes). */
export function rootSectionId(categories: Category[], id: string): string {
  const map = new Map(categories.map((c) => [c.id, c]))
  let cur = map.get(id)
  while (cur?.parentId) cur = map.get(cur.parentId)
  return cur?.id ?? id
}

/** Etiqueta legible: "Sección › Subsección" o solo "Sección". */
export function categoryPath(categories: Category[], id: string): string {
  const map = new Map(categories.map((c) => [c.id, c]))
  const leaf = map.get(id)
  if (!leaf) return 'Sin sección'
  if (!leaf.parentId) return leaf.name
  const parent = map.get(leaf.parentId)
  return parent ? `${parent.name} › ${leaf.name}` : leaf.name
}

/** Nombre corto para listas (subsección si existe, si no la sección). */
export function categoryLabel(categories: Category[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? 'Sin sección'
}

export interface ScopeFix {
  id: string
  name: string
  /** Nombre de la sección madre, si es una subsección. */
  parentName?: string
  current: CategoryScope
  proposed: CategoryScope
  income: number
  expense: number
}

/**
 * Revisa el tipo (ingreso / egreso / ambos) de cada sección y subsección
 * mirando los movimientos que YA tiene registrados y el tipo de sus
 * subsecciones. Devuelve solo las que no cuadran.
 *
 * Sirve para reparar datos importados con una versión anterior, cuando la
 * importación dejaba todas las secciones como "Ambos" y por eso aparecían
 * secciones de gasto al registrar un ingreso. Las categorías sin ningún
 * movimiento no se tocan: no hay con qué deducir su tipo.
 */
export function proposeScopeFixes(
  categories: Category[],
  transactions: Transaction[],
  account: AccountId,
): ScopeFix[] {
  const cats = categories.filter((c) => c.account === account)
  const byId = new Map(cats.map((c) => [c.id, c]))
  const counts = new Map<string, { income: number; expense: number }>()
  const bump = (id: string, type: TxType) => {
    const cur = counts.get(id) ?? { income: 0, expense: 0 }
    cur[type]++
    counts.set(id, cur)
  }

  for (const t of transactions) {
    if (t.deleted || t.account !== account || !byId.has(t.categoryId)) continue
    bump(t.categoryId, t.type)
    // El movimiento también cuenta para la sección madre
    const root = rootSectionId(categories, t.categoryId)
    if (root !== t.categoryId) bump(root, t.type)
  }

  const fixes: ScopeFix[] = []
  for (const c of cats) {
    const own = counts.get(c.id) ?? { income: 0, expense: 0 }
    const types = new Set<TxType>()
    if (own.income) types.add('income')
    if (own.expense) types.add('expense')
    // Una sección hereda además los tipos de sus subsecciones
    if (!c.parentId) {
      for (const sub of cats) {
        if (sub.parentId !== c.id) continue
        if (sub.scope === 'both') {
          types.add('income')
          types.add('expense')
        } else {
          types.add(sub.scope)
        }
      }
    }
    if (types.size === 0) continue
    const proposed: CategoryScope = types.size > 1 ? 'both' : types.has('income') ? 'income' : 'expense'
    if (proposed === c.scope) continue
    fixes.push({
      id: c.id,
      name: c.name,
      parentName: c.parentId ? byId.get(c.parentId)?.name : undefined,
      current: c.scope,
      proposed,
      income: own.income,
      expense: own.expense,
    })
  }
  return fixes.sort((a, b) => a.name.localeCompare(b.name))
}
