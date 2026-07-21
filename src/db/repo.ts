import { db, DEFAULT_SETTINGS, uid } from './database'
import { requestSync } from '../lib/sync'
import type { AccountId, Category, PaymentMethod, Settings, Transaction, TxType } from './types'

export interface TxInput {
  account: AccountId
  type: TxType
  amount: number
  categoryId: string
  date: string
  description: string
  paymentMethod?: PaymentMethod
  bank?: string
  note?: string
}

// Normaliza método de pago y banco según el tipo de movimiento
function normalizePayment(input: Partial<TxInput>) {
  const paymentMethod = input.paymentMethod
  const bank = paymentMethod === 'transferencia' ? input.bank?.trim() || undefined : undefined
  return { paymentMethod, bank }
}

export async function addTransaction(input: TxInput): Promise<string> {
  const now = Date.now()
  const tx: Transaction = {
    id: uid(),
    ...input,
    ...normalizePayment(input),
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  }
  await db.transactions.put(tx)
  requestSync()
  return tx.id
}

export async function updateTransaction(
  id: string,
  patch: Partial<TxInput>,
): Promise<void> {
  await db.transactions.update(id, {
    ...patch,
    ...normalizePayment(patch),
    note: patch.note !== undefined ? patch.note.trim() || undefined : undefined,
    updatedAt: Date.now(),
  })
  requestSync()
}

/** Borrado lógico: se marca como eliminado para poder sincronizarlo. */
export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.update(id, { deleted: true, updatedAt: Date.now() })
  requestSync()
}

export async function addCategory(
  input: Pick<Category, 'name' | 'scope' | 'color' | 'account'> & { parentId?: string },
): Promise<string> {
  const now = Date.now()
  const cat: Category = {
    id: uid(),
    ...input,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  }
  await db.categories.put(cat)
  requestSync()
  return cat.id
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'scope' | 'color'>>,
): Promise<void> {
  await db.categories.update(id, { ...patch, updatedAt: Date.now() })
  requestSync()
}

/** Borrado lógico. Si es una sección, arrastra sus subsecciones. */
export async function deleteCategory(id: string): Promise<void> {
  const now = Date.now()
  const children = await db.categories.where('parentId').equals(id).toArray()
  await db.categories.update(id, { deleted: true, updatedAt: now })
  for (const child of children) {
    await db.categories.update(child.id, { deleted: true, updatedAt: now })
  }
  requestSync()
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...current, ...patch })
  requestSync()
}

/** Agrega un banco/cooperativa a las sugerencias si no existe. */
export async function addBank(name: string): Promise<void> {
  const clean = name.trim()
  if (!clean) return
  const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS
  if (current.banks.some((b) => b.toLowerCase() === clean.toLowerCase())) return
  await db.settings.put({ ...current, banks: [...current.banks, clean] })
  requestSync()
}

export async function removeBank(name: string): Promise<void> {
  const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...current, banks: current.banks.filter((b) => b !== name) })
  requestSync()
}

/** Todas las transacciones vivas (no borradas), más recientes primero. */
export function liveTransactions() {
  return db.transactions
    .orderBy('date')
    .reverse()
    .filter((t) => !t.deleted)
    .toArray()
}

export function liveCategories() {
  return db.categories.filter((c) => !c.deleted).toArray()
}
