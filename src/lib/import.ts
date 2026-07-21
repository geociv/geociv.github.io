import * as XLSX from 'xlsx'
import { db, uid } from '../db/database'
import { requestSync } from './sync'
import { roundMoney } from './money'
import type { AccountId, Category, PaymentMethod, Transaction, TxType } from '../db/types'

const PALETTE = ['#2563eb', '#16a34a', '#c026d3', '#dc2626', '#d97706', '#0284c7', '#7c3aed', '#0d9488']

/** Columnas exigidas y opcionales por cuenta. El archivo debe cumplirlas. */
export const TEMPLATE_SPEC: Record<AccountId, { required: string[]; optional: string[] }> = {
  oficina: {
    required: ['Fecha', 'Monto', 'Sección'],
    optional: ['Subsección', 'Descripción', 'Método', 'Banco', 'Nota'],
  },
  proyectos: {
    required: ['Fecha', 'Tipo', 'Monto', 'Proyecto'],
    optional: ['Subsección', 'Descripción', 'Método', 'Banco', 'Nota'],
  },
}

export function templateHeaders(account: AccountId): string[] {
  const spec = TEMPLATE_SPEC[account]
  return [...spec.required, ...spec.optional]
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
}

// ---------- Plantillas ----------

export function downloadTemplate(account: AccountId): void {
  const headers = templateHeaders(account)
  const example =
    account === 'oficina'
      ? [
          { Fecha: '15/01/2026', Monto: 320.5, 'Sección': 'Sueldos', 'Subsección': '', 'Descripción': 'Sueldo enero', 'Método': 'Efectivo', Banco: '', Nota: '' },
          { Fecha: '18/01/2026', Monto: 45.9, 'Sección': 'Comida', 'Subsección': '', 'Descripción': 'Almuerzo equipo', 'Método': 'Efectivo', Banco: '', Nota: '' },
        ]
      : [
          { Fecha: '15/01/2026', Tipo: 'Ingreso', Monto: 5000, Proyecto: 'Proyecto 1', 'Subsección': 'Anticipos', 'Descripción': 'Anticipo de obra', 'Método': 'Transferencia', Banco: 'Banco Pichincha', Nota: 'F-001' },
          { Fecha: '20/01/2026', Tipo: 'Egreso', Monto: 1250.75, Proyecto: 'Proyecto 1', 'Subsección': 'Materiales', 'Descripción': 'Cemento', 'Método': 'Efectivo', Banco: '', Nota: '' },
        ]

  const ws = XLSX.utils.json_to_sheet(example, { header: headers })
  ws['!cols'] = headers.map((h) => ({ wch: h === 'Descripción' ? 26 : 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
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
  const empty: ParsedImport = { rows: [], errors: [], totalRows: 0, formatError: null }
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
    const description = clean(pick(r, ['Descripción', 'Concepto', 'Detalle', 'Description']))
    const note = clean(pick(r, ['Nota', 'Observación', 'Note']))
    const bank = clean(pick(r, ['Banco', 'Cooperativa', 'Bank']))
    const paymentMethod = parseMethod(pick(r, ['Método', 'Forma de pago', 'Method']))
    // Oficina solo maneja gastos; Proyectos exige la columna Tipo
    const type: TxType | null = account === 'oficina' ? 'expense' : parseType(pick(r, ['Tipo', 'Type']))

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
      description,
      paymentMethod,
      bank: paymentMethod === 'transferencia' ? bank || undefined : undefined,
      note: note || undefined,
    })
  })

  return { rows, errors, totalRows: raw.length, formatError: null }
}

// ---------- Guardado ----------

/** Inserta los movimientos, creando las secciones/subsecciones que falten. */
export async function commitImport(rows: ImportRow[]): Promise<number> {
  const now = Date.now()
  const cats: Category[] = await db.categories.filter((c) => !c.deleted).toArray()
  const newCats: Category[] = []

  const all = () => [...cats, ...newCats]
  const findSection = (account: AccountId, name: string) =>
    all().find((c) => c.account === account && !c.parentId && norm(c.name) === norm(name))
  const findSub = (parentId: string, name: string) =>
    all().find((c) => c.parentId === parentId && norm(c.name) === norm(name))

  const txs: Transaction[] = []

  for (const r of rows) {
    let section = findSection(r.account, r.section)
    if (!section) {
      section = {
        id: uid(),
        account: r.account,
        name: r.section,
        scope: r.account === 'oficina' ? 'expense' : 'both',
        color: PALETTE[newCats.length % PALETTE.length],
        createdAt: now,
        updatedAt: now,
        deleted: false,
      }
      newCats.push(section)
    }

    let leafId = section.id
    if (r.subsection) {
      let sub = findSub(section.id, r.subsection)
      if (!sub) {
        sub = {
          id: uid(),
          account: r.account,
          name: r.subsection,
          scope: r.type,
          color: section.color,
          parentId: section.id,
          createdAt: now,
          updatedAt: now,
          deleted: false,
        }
        newCats.push(sub)
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
      createdAt: now,
      updatedAt: now,
      deleted: false,
    })
  }

  await db.transaction('rw', db.categories, db.transactions, async () => {
    if (newCats.length) await db.categories.bulkPut(newCats)
    await db.transactions.bulkPut(txs)
  })
  requestSync()
  return txs.length
}
