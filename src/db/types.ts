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

/**
 * Adelanto a un trabajador. NO es un ingreso ni egreso: no afecta el balance.
 * Se lleva aparte como "pendiente" hasta que se quita (se descuenta/liquida).
 */
export interface Advance {
  id: string
  account: AccountId
  /** Trabajador que recibió el adelanto. */
  worker: string
  amount: number
  /** Fecha en formato YYYY-MM-DD. */
  date: string
  note?: string
  createdAt: number
  updatedAt: number
  /** "Quitar" un adelanto = marcarlo borrado (ya liquidado). */
  deleted?: boolean
}

/**
 * Saldo pendiente por cobrar: el porcentaje que falta cuando se trabaja con
 * abono inicial (ej. 50% al empezar y 50% al entregar).
 * NO es un ingreso todavía: no suma al balance hasta que se cobra. Al cobrarlo
 * se crea el movimiento de ingreso real y el pendiente queda liquidado.
 */
export interface Pending {
  id: string
  account: AccountId
  /** Cliente u obra a quien se le va a cobrar. */
  client: string
  /** Monto que falta por cobrar. */
  amount: number
  /** Fecha esperada de cobro (o de registro), en formato YYYY-MM-DD. */
  date: string
  /** Sección/subsección donde se registrará el ingreso al cobrarlo. */
  categoryId?: string
  note?: string
  /** Movimiento del abono inicial que lo generó, si nació desde el formulario. */
  sourceTxId?: string
  /** Movimiento de ingreso creado al cobrarlo. */
  settledTxId?: string
  /** Momento en que se cobró. Vacío = sigue pendiente. */
  settledAt?: number
  createdAt: number
  updatedAt: number
  /** Borrado lógico (se anuló el pendiente). */
  deleted?: boolean
}
