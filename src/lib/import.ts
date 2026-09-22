import * as XLSX from 'xlsx'
import { db, uid } from '../db/database'
import { requestSync } from './sync'
import { roundMoney } from './money'
import type { AccountId, Category, CategoryScope, PaymentMethod, Transaction, TxType } from '../db/types'

const PALETTE = ['#2563eb', '#16a34a', '#c026d3', '#dc2626', '#d97706', '#0284c7', '#7c3aed', '#0d9488']

/**
 * Columnas de la plantilla por cuenta. `headers` es el orden en que se genera el
 * Excel; `required` son las que el archivo DEBE traer para poder importarlo.
 * "Tipo de sección" es opcional: sirve para declarar que una sección es de
 * Ingreso, de Egreso o de Ambos. Si no viene, se deduce de la columna "Tipo".
 */
export const TEMPLATE_SPEC: Record<AccountId, { headers: string[]; required: string[] }> = {
  oficina: {
    headers: ['Fecha', 'Tipo', 'Monto', 'Sección', 'Subsección', 'Tipo de sección', 'Descripción', 'Método', 'Banco', 'Nota'],
    // En Oficina la columna Tipo puede faltar: se asume Egreso (y se avisa).
    required: ['Fecha', 'Monto', 'Sección'],
  },
  proyectos: {
    headers: ['Fecha', 'Tipo', 'Monto', 'Proyecto', 'Subsección', 'Tipo de sección', 'Descripción', 'Método', 'Banco', 'Nota'],
    required: ['Fecha', 'Tipo', 'Monto', 'Proyecto'],
  },
}

export function templateHeaders(account: AccountId): string[] {
  return TEMPLATE_SPEC[account].headers
}

export interface ImportRow {
  rowNumber: number
  account: AccountId
  type: TxType
  amount: number
  /** yyyy-MM-dd */
  date: string
  section: string
  subsection?: string
  /** Tipo declarado para la sección en la columna "Tipo de sección" (opcional). */
  sectionType?: CategoryScope
  description: string
  paymentMethod?: PaymentMethod
  bank?: string
  note?: string
}

export interface ImportError {
  rowNumber: number
  message: string
}

export interface ParsedImport {
  rows: ImportRow[]
  errors: ImportError[]
  totalRows: number
  /** Si el archivo no cumple el formato, aquí va el motivo y `rows` viene vacío. */
  formatError: string | null
  /** Aviso no bloqueante (ej. falta la columna Tipo y se asume Egreso). */
  warning: string | null
}

// ---------- Plantillas ----------

export function downloadTemplate(account: AccountId): void {
  const headers = templateHeaders(account)
  const example =
    account === 'oficina'
      ? [
          { Fecha: '15/01/2026', Tipo: 'Egreso', Monto: 320.5, 'Sección': 'Sueldos', 'Subsección': '', 'Tipo de sección': 'Egreso', 'Descripción': 'Sueldo enero', 'Método': 'Efectivo', Banco: '', Nota: '' },
          { Fecha: '18/01/2026', Tipo: 'Ingreso', Monto: 500, 'Sección': 'Reembolsos', 'Subsección': '', 'Tipo de sección': 'Ingreso', 'Descripción': 'Reembolso caja chica', 'Método': 'Efectivo', Banco: '', Nota: '' },
        ]
      : [
          { Fecha: '15/01/2026', Tipo: 'Ingreso', Monto: 5000, Proyecto: 'Proyecto 1', 'Subsección': 'Anticipos', 'Tipo de sección': 'Ambos', 'Descripción': 'Anticipo de obra', 'Método': 'Transferencia', Banco: 'Banco Pichincha', Nota: 'F-001' },
          { Fecha: '20/01/2026', Tipo: 'Egreso', Monto: 1250.75, Proyecto: 'Proyecto 1', 'Subsección': 'Materiales', 'Tipo de sección': 'Ambos', 'Descripción': 'Cemento', 'Método': 'Efectivo', Banco: '', Nota: '' },
        ]

  const ws = XLSX.utils.json_to_sheet(example, { header: headers })
  ws['!cols'] = headers.map((h) => ({ wch: h === 'Descripción' ? 26 : 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')

  // Hoja de ayuda: qué significa cada columna
  const help = [
    ['Columna', 'Para qué sirve'],
    ['Fecha', 'Día del movimiento: 15/01/2026 o 2026-01-15.'],
    ['Tipo', 'Ingreso o Egreso. Define si el monto suma o resta.'],
    ['Monto', 'Siempre positivo. El signo lo pone la columna Tipo.'],
    [account === 'oficina' ? 'Sección' : 'Proyecto', 'Nombre de la sección o del proyecto. Si no existe, se crea.'],
    ['Subsección', 'Opcional. Detalle dentro de la sección (ej. Materiales).'],
    [
      'Tipo de sección',
      'Opcional. Ingreso, Egreso o Ambos. Decide en qué lista aparece la sección al registrar un movimiento. Si se deja vacío, se deduce de la columna Tipo.',
    ],
    ['Descripción', 'Concepto del movimiento.'],
    ['Método', 'Efectivo o Transferencia (opcional).'],
    ['Banco', 'Solo si el método es Transferencia.'],
    ['Nota', 'Información extra: Nº de factura, proveedor, observaciones.'],
  ]
  const wsHelp = XLSX.utils.aoa_to_sheet(help)
  wsHelp['!cols'] = [{ wch: 18 }, { wch: 82 }]
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Instrucciones')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GeoCiv_plantilla_${account}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- Normalizadores ----------

const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())

/** Minúsculas y sin acentos, para comparar encabezados sin sorpresas. */
function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function two(n: number): string {
  return String(n).padStart(2, '0')
}

/** Convierte fecha de Excel (Date, serial o texto) a 'yyyy-MM-dd'. */
export function parseDate(v: unknown, dayFirst = true): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${two(v.getMonth() + 1)}-${two(v.getDate())}`
  }
  if (typeof v === 'number' && isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (isNaN(d.getTime())) return null
    return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`
  }
  const s = clean(v)
  if (!s) return null
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return `${m[1]}-${two(Number(m[2]))}-${two(Number(m[3]))}`
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += 2000
    let day = dayFirst ? a : b
    let month = dayFirst ? b : a
    if (month > 12 && day <= 12) [day, month] = [month, day]
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${two(month)}-${two(day)}`
  }
  return null
}

/** Monto: acepta coma o punto decimal. Siempre positivo y a 2 decimales. */
export function parseAmountCell(v: unknown): number {
  let n: number
  if (typeof v === 'number') {
    n = v
  } else {
    const s = clean(v).replace(/[^\d,.-]/g, '')
    if (!s) return NaN
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    let normalized = s
    if (lastComma > -1 && lastDot > -1) {
      normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
    } else if (lastComma > -1) {
      normalized = s.replace(',', '.')
    }
    n = Number(normalized)
  }
  if (!isFinite(n)) return NaN
  // El signo lo define la columna Tipo, así que se usa el valor absoluto
  return roundMoney(Math.abs(n))
}

function parseType(v: unknown): TxType | null {
  const s = norm(clean(v))
  if (!s) return null
  if (s.startsWith('ing') || s === 'income' || s === 'i') return 'income'
  if (s.startsWith('egr') || s.startsWith('gas') || s === 'expense' || s === 'e') return 'expense'
  return null
}

/** "Tipo de sección": Ingreso, Egreso o Ambos. */
function parseScope(v: unknown): CategoryScope | undefined {
  const s = norm(clean(v))
  if (!s) return undefined
  if (s.startsWith('amb') || s.startsWith('los dos') || s === 'both') return 'both'
  return parseType(v) ?? undefined
}

function parseMethod(v: unknown): PaymentMethod | undefined {
  const s = norm(clean(v))
  if (s.startsWith('efe') || s === 'cash') return 'efectivo'
  if (s.startsWith('tra') || s.startsWith('dep')) return 'transferencia'
  return undefined
}

/** Busca un valor por varios nombres posibles de encabezado. */
function pick(row: Record<string, unknown>, names: string[]): unknown {
  const keys = Object.keys(row)
  for (const name of names) {
    const k = keys.find((key) => norm(key) === norm(name))
    if (k !== undefined) return row[k]
  }
  return undefined
}

// ---------- Lectura y validación ----------

export function parseWorkbook(data: ArrayBuffer, account: AccountId, dayFirst = true): ParsedImport {
  const empty: ParsedImport = { rows: [], errors: [], totalRows: 0, formatError: null, warning: null }
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(data, { cellDates: true })
  } catch {
    return { ...empty, formatError: 'No se pudo leer el archivo. ¿Es un Excel o CSV válido?' }
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { ...empty, formatError: 'El archivo no tiene ninguna hoja con datos.' }

  // Validación estricta de encabezados
  const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] ?? []) as unknown[]
  const present = headerRow.map((h) => norm(clean(h))).filter(Boolean)
  const spec = TEMPLATE_SPEC[account]
  const missing = spec.required.filter((req) => !present.includes(norm(req)))
  if (missing.length) {
    return {
      ...empty,
      formatError: `El archivo no cumple el formato de ${account === 'oficina' ? 'Oficina' : 'Proyectos'}. Faltan las columnas: ${missing.join(', ')}. Descarga la plantilla y usa esos encabezados.`,
    }
  }

  // En Oficina la columna Tipo puede no venir: se asume Egreso, pero se avisa.
  const hasTypeColumn = present.includes(norm('Tipo'))
  const warning = hasTypeColumn
    ? null
    : 'El archivo no trae la columna "Tipo", así que todas las filas se importarán como EGRESO. Si hay ingresos, agrégala a la plantilla y vuelve a subir el archivo.'

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const rows: ImportRow[] = []
  const errors: ImportError[] = []

  raw.forEach((r, i) => {
    const rowNumber = i + 2 // +1 encabezado, +1 base 1
    if (Object.values(r).every((v) => clean(v) === '')) return

    const date = parseDate(pick(r, ['Fecha', 'Date']), dayFirst)
    const amount = parseAmountCell(pick(r, ['Monto', 'Valor', 'Importe', 'Amount']))
    const section = clean(pick(r, ['Sección', 'Proyecto', 'Section', 'Categoría']))
    const subsection = clean(pick(r, ['Subsección', 'Subsection']))
    const sectionType = parseScope(pick(r, ['Tipo de sección', 'Tipo de seccion', 'Tipo sección', 'Section type']))
    const description = clean(pick(r, ['Descripción', 'Concepto', 'Detalle', 'Description']))
    const note = clean(pick(r, ['Nota', 'Observación', 'Note']))
    const bank = clean(pick(r, ['Banco', 'Cooperativa', 'Bank']))
    const paymentMethod = parseMethod(pick(r, ['Método', 'Forma de pago', 'Method']))
    // Ambas cuentas manejan ingresos y egresos. Si la columna Tipo no existe
    // en el archivo (solo permitido en Oficina), se asume Egreso.
    const type: TxType | null = hasTypeColumn ? parseType(pick(r, ['Tipo', 'Type'])) : 'expense'

    if (!date) return errors.push({ rowNumber, message: 'Fecha inválida o vacía' })
    if (!isFinite(amount) || amount <= 0) return errors.push({ rowNumber, message: 'Monto inválido, vacío o cero' })
    if (!type) return errors.push({ rowNumber, message: 'Tipo debe ser "Ingreso" o "Egreso"' })
    if (!section)
      return errors.push({ rowNumber, message: account === 'oficina' ? 'Falta la Sección' : 'Falta el Proyecto' })

    rows.push({
      rowNumber,
      account,
      type,
      amount,
      date,
      section,
      subsection: subsection || undefined,
      sectionType,
      description,
      paymentMethod,
      bank: paymentMethod === 'transferencia' ? bank || undefined : undefined,
      note: note || undefined,
    })
  })

  return { rows, errors, totalRows: raw.length, formatError: null, warning }
}

// ---------- Guardado ----------

/** Clave con la que se identifica una sección dentro del archivo. */
const sectionKeyOf = (r: ImportRow) => `${r.account}|${norm(r.section)}`

interface ScopeInfo {
  types: Set<TxType>
  explicit?: CategoryScope
}

/**
 * Recorre las filas y anota, para cada sección y subsección, qué tipos de
 * movimiento trae el archivo y si se declaró un tipo a mano.
 */
function collectScopes(rows: ImportRow[]): Map<string, ScopeInfo> {
  const map = new Map<string, ScopeInfo>()
  const add = (key: string, type: TxType, explicit?: CategoryScope) => {
    const info = map.get(key) ?? { types: new Set<TxType>() }
    info.types.add(type)
    if (explicit) info.explicit = explicit
    map.set(key, info)
  }
  for (const r of rows) {
    const key = sectionKeyOf(r)
    add(key, r.type, r.sectionType)
    // La subsección toma su tipo de sus propias filas, no de "Tipo de sección"
    if (r.subsection) add(`${key}|${norm(r.subsection)}`, r.type)
  }
  return map
}

/**
 * Decide si una sección es de ingresos, de egresos o de ambos. Manda lo que
 * declare la columna "Tipo de sección"; si eso contradice a las filas del
 * archivo, gana 'both': es preferible que la sección aparezca de más y no que
 * un movimiento se quede sin dónde registrarse.
 */
function resolveScope(info: ScopeInfo | undefined, fallback: TxType): CategoryScope {
  const types = info?.types ?? new Set<TxType>([fallback])
  const observed: CategoryScope = types.size > 1 ? 'both' : types.has('income') ? 'income' : 'expense'
  const explicit = info?.explicit
  if (!explicit || explicit === observed) return observed
  return 'both'
}

/** Une dos alcances: si no coinciden, la categoría pasa a servir para ambos. */
const widen = (current: CategoryScope, needed: CategoryScope): CategoryScope =>
  current === needed ? current : 'both'

export interface SectionPreview {
  name: string
  scope: CategoryScope
  count: number
}

/**
 * Resumen de las secciones que traerá el archivo y de qué tipo quedará cada una.
 * Sirve para revisarlo ANTES de importar, que es donde se detecta una sección
 * mal clasificada (ej. "Arriendo" apareciendo entre los ingresos).
 */
export function previewSections(rows: ImportRow[]): SectionPreview[] {
  const scopes = collectScopes(rows)
  const byKey = new Map<string, SectionPreview>()
  for (const r of rows) {
    const key = sectionKeyOf(r)
    const cur = byKey.get(key)
    if (cur) cur.count++
    else byKey.set(key, { name: r.section, scope: resolveScope(scopes.get(key), r.type), count: 1 })
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Inserta los movimientos, creando las secciones/subsecciones que falten con el
 * tipo (ingreso / egreso / ambos) que les corresponde según el archivo.
 */
export async function commitImport(rows: ImportRow[]): Promise<number> {
  const now = Date.now()
  const scopes = collectScopes(rows)
  const cats: Category[] = await db.categories.filter((c) => !c.deleted).toArray()
  const newCats: Category[] = []
  /** Secciones que ya existían y hay que ampliar de alcance. */
  const widened = new Map<string, Category>()
  let sectionCount = 0

  const all = () => [...cats, ...newCats]
  const findSection = (account: AccountId, name: string) =>
    all().find((c) => c.account === account && !c.parentId && norm(c.name) === norm(name))
  const findSub = (parentId: string, name: string) =>
    all().find((c) => c.parentId === parentId && norm(c.name) === norm(name))

  /** Amplía el alcance de una categoría existente y la deja lista para guardar. */
  const applyWiden = (cat: Category, needed: CategoryScope): Category => {
    const merged = widen(cat.scope, needed)
    if (merged === cat.scope) return cat
    const updated: Category = { ...cat, scope: merged, updatedAt: now }
    const idx = cats.findIndex((c) => c.id === cat.id)
    if (idx >= 0) cats[idx] = updated
    else {
      const j = newCats.findIndex((c) => c.id === cat.id)
      if (j >= 0) newCats[j] = updated
    }
    if (idx >= 0) widened.set(updated.id, updated)
    return updated
  }

  const txs: Transaction[] = []

  rows.forEach((r, i) => {
    const key = sectionKeyOf(r)
    const sectionScope = resolveScope(scopes.get(key), r.type)

    let section = findSection(r.account, r.section)
    if (!section) {
      section = {
        id: uid(),
        account: r.account,
        name: r.section,
        scope: sectionScope,
        color: PALETTE[sectionCount % PALETTE.length],
        createdAt: now,
        updatedAt: now,
        deleted: false,
      }
      sectionCount++
      newCats.push(section)
    } else {
      section = applyWiden(section, sectionScope)
    }

    let leafId = section.id
    if (r.subsection) {
      const subScope = resolveScope(scopes.get(`${key}|${norm(r.subsection)}`), r.type)
      let sub = findSub(section.id, r.subsection)
      if (!sub) {
        sub = {
          id: uid(),
          account: r.account,
          name: r.subsection,
          scope: subScope,
          color: section.color,
          parentId: section.id,
          createdAt: now,
          updatedAt: now,
          deleted: false,
        }
        newCats.push(sub)
      } else {
        sub = applyWiden(sub, subScope)
      }
      leafId = sub.id
    }

    txs.push({
      id: uid(),
      account: r.account,
      type: r.type,
      amount: r.amount,
      categoryId: leafId,
      date: r.date,
      description: r.description,
      paymentMethod: r.paymentMethod,
      bank: r.bank,
      note: r.note,
      // +i conserva el orden de las filas del Excel dentro de un mismo día
      createdAt: now + i,
      updatedAt: now + i,
      deleted: false,
    })
  })

  await db.transaction('rw', db.categories, db.transactions, async () => {
    const toSave = [...newCats, ...widened.values()]
    if (toSave.length) await db.categories.bulkPut(toSave)
    await db.transactions.bulkPut(txs)
  })
  requestSync()
  return txs.length
}
