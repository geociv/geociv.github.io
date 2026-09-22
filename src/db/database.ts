import Dexie, { type Table } from 'dexie'
import { DEFAULT_ADMIN_PIN, DEFAULT_BANKS, DEFAULT_VIEWER_PIN, LEGACY_PINS, type Advance, type Category, type Pending, type Settings, type Transaction } from './types'

/**
 * Base de datos local (IndexedDB) — es la fuente de la verdad.
 * La app funciona 100% sin internet. La sincronización con la nube
 * (ver lib/sync.ts) viene horneada por el desarrollador.
 */
export class GeoCivDB extends Dexie {
  transactions!: Table<Transaction, string>
  categories!: Table<Category, string>
  advances!: Table<Advance, string>
  pendings!: Table<Pending, string>
  settings!: Table<Settings, string>

  constructor() {
    super('geociv-cuentas')
    this.version(1).stores({
      transactions: 'id, date, type, categoryId, updatedAt, deleted',
      categories: 'id, scope, updatedAt, deleted',
      settings: 'id',
    })
    this.version(2)
      .stores({
        transactions: 'id, date, type, categoryId, updatedAt, deleted',
        categories: 'id, scope, parentId, updatedAt, deleted',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('categories').clear()
      })
    // v3: dos cuentas (Oficina / Proyectos). Añade `account` a categorías y
    // movimientos. Reinicia los datos para sembrar la nueva estructura.
    this.version(3)
      .stores({
        transactions: 'id, account, date, type, categoryId, updatedAt, deleted',
        categories: 'id, account, scope, parentId, updatedAt, deleted',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('categories').clear()
        await tx.table('transactions').clear()
      })
    // v4: adelantos a trabajadores (aparte del balance)
    this.version(4).stores({
      transactions: 'id, account, date, type, categoryId, updatedAt, deleted',
      categories: 'id, account, scope, parentId, updatedAt, deleted',
      advances: 'id, account, updatedAt, deleted',
      settings: 'id',
    })
    // v5: saldos pendientes por cobrar (tampoco afectan el balance)
    this.version(5).stores({
      transactions: 'id, account, date, type, categoryId, updatedAt, deleted',
      categories: 'id, account, scope, parentId, updatedAt, deleted',
      advances: 'id, account, updatedAt, deleted',
      pendings: 'id, account, updatedAt, deleted',
      settings: 'id',
    })
  }
}

export const db = new GeoCivDB()

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  companyName: 'GeoCiv',
  currency: 'USD',
  currencySymbol: '$',
  locale: 'es-EC',
  weekStartsOn: 1,
  banks: DEFAULT_BANKS,
  adminPin: DEFAULT_ADMIN_PIN,
  viewerPin: DEFAULT_VIEWER_PIN,
}

/**
 * Crea los AJUSTES por defecto la primera vez (empresa, moneda, claves, bancos).
 * NO siembra secciones ni subsecciones: la empresa las crea a su medida en
 * Ajustes, o las importa desde Excel. La app arranca en blanco.
 */
export async function ensureSeed(): Promise<void> {
  const existing = await db.settings.get('app')
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS)
    return
  }
  // Completa campos nuevos en instalaciones anteriores
  const patch: Partial<Settings> = {}
  if (!existing.banks || existing.banks.length === 0) patch.banks = DEFAULT_BANKS
  // Migra claves vacías o débiles ('1234'/'0000') a las profesionales por defecto
  if (!existing.adminPin || LEGACY_PINS.includes(existing.adminPin)) patch.adminPin = DEFAULT_ADMIN_PIN
  if (!existing.viewerPin || LEGACY_PINS.includes(existing.viewerPin)) patch.viewerPin = DEFAULT_VIEWER_PIN
  if (Object.keys(patch).length) await db.settings.put({ ...existing, ...patch })
}
