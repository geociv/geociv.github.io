export type TxType = 'income' | 'expense'

export type PaymentMethod = 'efectivo' | 'transferencia'

/** Rol de acceso: admin edita todo; viewer solo ve reportes. */
export type Role = 'admin' | 'viewer'

/** Identificador de cuenta (libro contable independiente dentro de la app). */
export type AccountId = string

export interface AccountDef {
  id: AccountId
  name: string
  description: string
  /** Oficina solo maneja gastos; Proyectos maneja ingresos y egresos. */
  allowsIncome: boolean
}

/** Las dos cuentas del negocio. Misma lógica, libros separados. */
export const ACCOUNTS: AccountDef[] = [
  { id: 'oficina', name: 'Oficina', description: 'Ingresos y egresos de la oficina', allowsIncome: true },
  { id: 'proyectos', name: 'Proyectos', description: 'Ingresos y egresos por proyecto', allowsIncome: true },
]

export function accountById(id: AccountId): AccountDef {
  return ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0]
}

/** Bancos/cooperativas iniciales. El usuario puede añadir más (ver Settings.banks). */
export const DEFAULT_BANKS = ['Banco Pichincha', 'Cooperativa Jardín Azuayo']

/** Un movimiento contable: ingreso o egreso, dentro de una cuenta. */
export interface Transaction {
  id: string
  /** Cuenta a la que pertenece: 'oficina' | 'proyectos'. */
  account: AccountId
  type: TxType
  /** Monto siempre positivo; el signo lo da `type`. */
  amount: number
  /** Apunta a la sección o subsección elegida (id en la tabla categories). */
  categoryId: string
  /** Fecha contable en formato YYYY-MM-DD (día en que ocurrió el movimiento). */
  date: string
  /** Descripción / concepto principal. */
  description: string
  /** Cómo se recibió/pagó. */
  paymentMethod?: PaymentMethod
  /** Banco o cooperativa cuando el método es transferencia. */
  bank?: string
  /** Información extra opcional (referencia, obra, proveedor, etc.). */
  note?: string
  createdAt: number
  updatedAt: number
  /** Borrado lógico: se conserva para poder sincronizar la eliminación. */
  deleted?: boolean
}

export type CategoryScope = TxType | 'both'

/**
 * Sección o subsección, dentro de una cuenta. Es jerárquica:
 * - `parentId` vacío  → es una SECCIÓN (ej. Sueldos en Oficina; Proyecto 1 en Proyectos).
 * - `parentId` con valor → es una SUBSECCIÓN dentro de esa sección.
 */
export interface Category {
  id: string
  /** Cuenta a la que pertenece la sección. */
  account: AccountId
  name: string
  scope: CategoryScope
  color: string
  parentId?: string
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export interface Settings {
  id: 'app'
  companyName: string
  currency: string
  currencySymbol: string
  /** Locale para formatear números y fechas, ej. 'es-EC'. */
  locale: string
  /** Día en que arranca la semana en los reportes: 1 = lunes. */
  weekStartsOn: 0 | 1
  /** Bancos/cooperativas sugeridos para transferencias. */
  banks: string[]
  /** Clave del usuario Administrador (edita todo). */
  adminPin: string
  /** Clave del usuario de solo reportes. */
  viewerPin: string
}

export const DEFAULT_ADMIN_PIN = 'GeoCiv@Admin2026'
export const DEFAULT_VIEWER_PIN = 'GeoCiv@Reportes2026'
/** Claves débiles anteriores; se migran a las nuevas automáticamente. */
export const LEGACY_PINS = ['1234', '0000']
