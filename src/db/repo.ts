import { db, DEFAULT_SETTINGS, uid } from './database'
import { requestSync } from '../lib/sync'
import type { AccountId, Advance, Category, PaymentMethod, Pending, Settings, Transaction, TxType } from './types'

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

// ===== Adelantos =====

export interface AdvanceInput {
  account: AccountId
  worker: string
  amount: number
  date: string
  note?: string
}

export async function addAdvance(input: AdvanceInput): Promise<string> {
  const now = Date.now()
  const adv: Advance = {
    id: uid(),
    ...input,
    worker: input.worker.trim(),
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  }
  await db.advances.put(adv)
  requestSync()
  return adv.id
}

/** "Quitar" un adelanto = liquidarlo (borrado lógico). */
export async function deleteAdvance(id: string): Promise<void> {
  await db.advances.update(id, { deleted: true, updatedAt: Date.now() })
  requestSync()
}

export function liveAdvances() {
  return db.advances.filter((a) => !a.deleted).toArray()
}

// ===== Saldos pendientes por cobrar =====

export interface PendingInput {
  account: AccountId
  client: string
  amount: number
  date: string
  categoryId?: string
  note?: string
  sourceTxId?: string
}

export async function addPending(input: PendingInput): Promise<string> {
  const now = Date.now()
  const pending: Pending = {
    id: uid(),
    ...input,
    client: input.client.trim(),
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  }
  await db.pendings.put(pending)
  requestSync()
  return pending.id
}

export async function updatePending(
  id: string,
  patch: Partial<Pick<Pending, 'client' | 'amount' | 'date' | 'categoryId' | 'note'>>,
): Promise<void> {
  await db.pendings.update(id, { ...patch, updatedAt: Date.now() })
  requestSync()
}

/**
 * Cobra un saldo pendiente: crea el movimiento de INGRESO real (ahí sí entra al
 * balance) y marca el pendiente como liquidado.
 */
export async function settlePending(
  id: string,
  opts: { categoryId: string; date: string; paymentMethod?: PaymentMethod; bank?: string },
): Promise<void> {
  const pending = await db.pendings.get(id)
  if (!pending || pending.settledAt) return
  const txId = await addTransaction({
    account: pending.account,
    type: 'income',
    amount: pending.amount,
    categoryId: opts.categoryId,
    date: opts.date,
    description: `Cobro de saldo pendiente · ${pending.client}`,
    paymentMethod: opts.paymentMethod,
    bank: opts.bank,
    note: pending.note,
  })
  await db.pendings.update(id, { settledAt: Date.now(), settledTxId: txId, updatedAt: Date.now() })
  requestSync()
}

/** Anula un pendiente (ya no se va a cobrar). Borrado lógico. */
export async function deletePending(id: string): Promise<void> {
  await db.pendings.update(id, { deleted: true, updatedAt: Date.now() })
  requestSync()
}

/** Pendientes vivos: sin borrar y sin cobrar todavía. */
export function livePendings() {
  return db.pendings.filter((p) => !p.deleted).toArray()
}

// ===== Borrado total (para volver a importar desde cero) =====

export interface ResetOptions {
  /** Cuentas a limpiar. */
  accounts: AccountId[]
  /** true = borra también secciones y subsecciones. */
  includeCategories: boolean
}

export interface ResetCounts {
  transactions: number
  categories: number
  advances: number
  pendings: number
}

/**
 * Deja la app en blanco para reimportar. Usa BORRADO LÓGICO (deleted = true)
 * a propósito: así el borrado viaja por la sincronización y también desaparece
 * en el celular y en la nube. Un `clear()` local volvería a llenarse en el
 * siguiente pull. No toca los ajustes (empresa, contraseñas, bancos).
 */
export async function resetData({ accounts, includeCategories }: ResetOptions): Promise<ResetCounts> {
  const now = Date.now()
  const inScope = (account: AccountId) => accounts.includes(account)
  const counts: ResetCounts = { transactions: 0, categories: 0, advances: 0, pendings: 0 }

  await db.transaction('rw', db.transactions, db.categories, db.advances, db.pendings, async () => {
    const txs = (await db.transactions.toArray()).filter((t) => !t.deleted && inScope(t.account))
    if (txs.length) {
      await db.transactions.bulkPut(txs.map((t) => ({ ...t, deleted: true, updatedAt: now })))
      counts.transactions = txs.length
    }

    const advs = (await db.advances.toArray()).filter((a) => !a.deleted && inScope(a.account))
    if (advs.length) {
      await db.advances.bulkPut(advs.map((a) => ({ ...a, deleted: true, updatedAt: now })))
      counts.advances = advs.length
    }

    const pends = (await db.pendings.toArray()).filter((p) => !p.deleted && inScope(p.account))
    if (pends.length) {
      await db.pendings.bulkPut(pends.map((p) => ({ ...p, deleted: true, updatedAt: now })))
      counts.pendings = pends.length
    }

    if (includeCategories) {
      const cats = (await db.categories.toArray()).filter((c) => !c.deleted && inScope(c.account))
      if (cats.length) {
        await db.categories.bulkPut(cats.map((c) => ({ ...c, deleted: true, updatedAt: now })))
        counts.categories = cats.length
      }
    }
  })

  requestSync()
  return counts
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

/**
 * Todas las transacciones vivas (no borradas), más recientes primero.
 * Dentro de un mismo día respeta el orden en que se registraron — y, en una
 * importación, el orden de las filas del Excel. Sin ese desempate IndexedDB
 * las devuelve por id (aleatorio) y el listado se ve revuelto.
 */
export async function liveTransactions(): Promise<Transaction[]> {
  const rows = await db.transactions.filter((t) => !t.deleted).toArray()
  return rows.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? 1 : -1))
}

export function liveCategories() {
  return db.categories.filter((c) => !c.deleted).toArray()
}
