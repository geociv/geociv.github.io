import type { AccountId, Category, TxType } from '../db/types'

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
