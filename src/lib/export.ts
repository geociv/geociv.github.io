import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Category, Settings, Transaction } from '../db/types'
import type { Range } from './dates'
import { fmtDate } from './dates'
import { formatMoney } from './money'
import { categoryPath } from './categories'
import { argb, BRAND, loadLogoDataUrl } from './brand'
import type { ReportSummary } from './reports'

function paymentLabel(t: Transaction): string {
  if (t.paymentMethod === 'transferencia') return `Transferencia${t.bank ? ` · ${t.bank}` : ''}`
  if (t.paymentMethod === 'efectivo') return 'Efectivo'
  return '—'
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const slug = (s: string) => s.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
const stamp = () => new Date().toISOString().slice(0, 10)

function generatedAt(settings: Settings): string {
  try {
    return new Intl.DateTimeFormat(settings.locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
  } catch {
    return new Date().toLocaleString()
  }
}

// ============================ PDF ============================

/** Genera un PDF corporativo: portada con logo, resumen, desgloses y detalle. */
export async function exportReportPDF(
  summary: ReportSummary,
  categories: Category[],
  settings: Settings,
  range: Range,
  periodLabel: string,
  scopeLabel?: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const money = (n: number) => formatMoney(n, settings)
  const pageW = doc.internal.pageSize.getWidth()
  const logo = await loadLogoDataUrl()

  // ---- Encabezado corporativo ----
  doc.setFillColor(...BRAND.navyRGB)
  doc.rect(0, 0, pageW, 30, 'F')
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 12, 5, 20, 20, undefined, 'FAST')
    } catch {
      /* si el logo falla, el encabezado igual se ve bien */
    }
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(settings.companyName, logo ? 37 : 12, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(190, 205, 215)
  doc.text('Reporte de ingresos y egresos', logo ? 37 : 12, 21)

  // ---- Bloque de contexto ----
  let y = 40
  doc.setTextColor(...BRAND.navyRGB)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(scopeLabel ?? 'Reporte general', 12, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.grayRGB)
  doc.text(`Período: ${periodLabel} — ${range.label}`, 12, y)
  y += 5
  doc.text(`Generado: ${generatedAt(settings)}`, 12, y)
  y += 4

  // ---- Tarjetas de resumen ----
  const cardW = (pageW - 24 - 8) / 3
  const cards: { label: string; value: string; rgb: [number, number, number] }[] = [
    { label: 'INGRESOS', value: money(summary.income), rgb: BRAND.greenRGB },
    { label: 'EGRESOS', value: money(summary.expense), rgb: BRAND.roseRGB },
    { label: 'BALANCE', value: money(summary.balance), rgb: summary.balance >= 0 ? BRAND.tealRGB : BRAND.roseRGB },
  ]
  y += 4
  cards.forEach((c, i) => {
    const x = 12 + i * (cardW + 4)
    doc.setFillColor(246, 248, 250)
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'F')
    doc.setFillColor(...c.rgb)
    doc.roundedRect(x, y, 1.6, 20, 0.8, 0.8, 'F')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.grayRGB)
    doc.text(c.label, x + 5, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...c.rgb)
    doc.text(c.value, x + 5, y + 15)
    doc.setFont('helvetica', 'normal')
  })
  y += 28

  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // ---- Desglose por sección ----
  const breakdown = [
    ...summary.expenseByCategory.map((b) => ['Egreso', b.name, money(b.total)]),
    ...summary.incomeByCategory.map((b) => ['Ingreso', b.name, money(b.total)]),
  ]
  if (breakdown.length) {
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Sección', 'Total']],
      body: breakdown,
      theme: 'grid',
      headStyles: { fillColor: BRAND.tealRGB, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 22 }, 2: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 12, right: 12 },
    })
    y = lastY() + 8
  }

  // ---- Detalle de movimientos ----
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Tipo', 'Sección', 'Descripción', 'Pago', 'Monto']],
    body: summary.transactions.map((t) => [
      fmtDate(t.date),
      t.type === 'income' ? 'Ingreso' : 'Egreso',
      categoryPath(categories, t.categoryId),
      t.description || '—',
      paymentLabel(t),
      `${t.type === 'expense' ? '-' : ''}${money(t.amount)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.navyRGB, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 7.8, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 16 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
    },
    margin: { left: 12, right: 12, top: 18 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = String(data.cell.raw).startsWith('-') ? BRAND.roseRGB : BRAND.greenRGB
      }
    },
  })

  // ---- Marca de agua + pie en todas las páginas ----
  const pages = doc.getNumberOfPages()
  const pageH = doc.internal.pageSize.getHeight()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    if (logo) {
      try {
        const gs = new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.05 })
        doc.saveGraphicsState()
        ;(doc as unknown as { setGState: (g: unknown) => void }).setGState(gs)
        const size = 110
        doc.addImage(logo, 'PNG', (pageW - size) / 2, (pageH - size) / 2, size, size, undefined, 'FAST')
        doc.restoreGraphicsState()
      } catch {
        /* si el visor no soporta transparencia, se omite la marca de agua */
      }
    }
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.grayRGB)
    doc.text(`${settings.companyName} · ${scopeLabel ?? ''}`, 12, pageH - 8)
    doc.text(`Página ${p} de ${pages}`, pageW - 12, pageH - 8, { align: 'right' })
  }

  doc.save(`GeoCiv_reporte_${scopeLabel ? slug(scopeLabel) + '_' : ''}${periodLabel}_${stamp()}.pdf`)
}

// ============================ Excel ============================

/** Genera un Excel corporativo con logo, encabezados con formato y totales. */
export async function exportReportExcel(
  summary: ReportSummary,
  categories: Category[],
  periodLabel: string,
  scopeLabel: string,
  settings: Settings,
  range: Range,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = settings.companyName
  wb.created = new Date()

  const currencyFmt = `"${settings.currencySymbol}"#,##0.00`
  const titleFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: argb(BRAND.navy) } }
  const headFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: argb(BRAND.teal) } }
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFD9E1E8' } },
    left: { style: 'thin' as const, color: { argb: 'FFD9E1E8' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD9E1E8' } },
    right: { style: 'thin' as const, color: { argb: 'FFD9E1E8' } },
  }

  // Logo (si carga) para el encabezado de la hoja Resumen
  const logo = await loadLogoDataUrl()
  let logoId: number | null = null
  if (logo) {
    try {
      logoId = wb.addImage({ base64: logo, extension: 'png' })
    } catch {
      logoId = null
    }
  }

  // ---------- Hoja: Resumen ----------
  const s1 = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
  s1.columns = [{ width: 4 }, { width: 26 }, { width: 20 }, { width: 20 }, { width: 20 }]

  s1.mergeCells('B2:E2')
  const t = s1.getCell('B2')
  t.value = settings.companyName
  t.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  t.fill = titleFill
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  s1.getRow(2).height = 30
  s1.mergeCells('B3:E3')
  const sub = s1.getCell('B3')
  sub.value = `Reporte: ${scopeLabel}`
  sub.font = { size: 11, bold: true, color: { argb: argb(BRAND.teal) } }

  if (logoId !== null) {
    s1.addImage(logoId, { tl: { col: 0.15, row: 1.15 }, ext: { width: 42, height: 42 } })
  }

  s1.getCell('B5').value = 'Período'
  s1.getCell('C5').value = `${periodLabel} — ${range.label}`
  s1.getCell('B6').value = 'Generado'
  s1.getCell('C6').value = generatedAt(settings)
  s1.getCell('B7').value = 'Movimientos'
  s1.getCell('C7').value = summary.count
  ;['B5', 'B6', 'B7'].forEach((r) => (s1.getCell(r).font = { bold: true, color: { argb: argb(BRAND.navy) } }))

  const headerRow = s1.getRow(9)
  headerRow.values = ['', 'Concepto', 'Monto']
  ;['B9', 'C9'].forEach((ref) => {
    const c = s1.getCell(ref)
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = headFill
    c.border = thinBorder
    c.alignment = { horizontal: 'center' }
  })

  const totals: [string, number, string][] = [
    ['Ingresos', summary.income, BRAND.green],
    ['Egresos', summary.expense, BRAND.rose],
    ['Balance', summary.balance, summary.balance >= 0 ? BRAND.teal : BRAND.rose],
  ]
  totals.forEach(([label, value, color], i) => {
    const r = s1.getRow(10 + i)
    r.getCell(2).value = label
    r.getCell(3).value = value
    r.getCell(2).font = { bold: true }
    r.getCell(3).numFmt = currencyFmt
    r.getCell(3).font = { bold: true, color: { argb: argb(color) } }
    r.getCell(2).border = thinBorder
    r.getCell(3).border = thinBorder
  })

  // Desglose por sección
  let row = 15
  if (summary.expenseByCategory.length || summary.incomeByCategory.length) {
    s1.getCell(`B${row}`).value = 'Desglose por sección'
    s1.getCell(`B${row}`).font = { bold: true, size: 12, color: { argb: argb(BRAND.navy) } }
    row += 1
    const hr = s1.getRow(row)
    hr.getCell(2).value = 'Tipo'
    hr.getCell(3).value = 'Sección'
    hr.getCell(4).value = 'Total'
    ;[2, 3, 4].forEach((c) => {
      const cell = hr.getCell(c)
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = headFill
      cell.border = thinBorder
      cell.alignment = { horizontal: 'center' }
    })
    row += 1
    const items = [
      ...summary.expenseByCategory.map((b) => ['Egreso', b.name, b.total] as const),
      ...summary.incomeByCategory.map((b) => ['Ingreso', b.name, b.total] as const),
    ]
    for (const [tipo, name, total] of items) {
      const r = s1.getRow(row)
      r.getCell(2).value = tipo
      r.getCell(3).value = name
      r.getCell(4).value = total
      r.getCell(4).numFmt = currencyFmt
      ;[2, 3, 4].forEach((c) => (r.getCell(c).border = thinBorder))
      r.getCell(2).font = { color: { argb: argb(tipo === 'Ingreso' ? BRAND.green : BRAND.rose) } }
      row += 1
    }
  }

  // ---------- Hoja: Movimientos ----------
  const s2 = wb.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] })
  s2.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Cuenta', key: 'cuenta', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Sección', key: 'seccion', width: 30 },
    { header: 'Descripción', key: 'desc', width: 34 },
    { header: 'Método', key: 'metodo', width: 14 },
    { header: 'Banco', key: 'banco', width: 22 },
    { header: 'Nota', key: 'nota', width: 26 },
    { header: 'Ingreso', key: 'ingreso', width: 14 },
    { header: 'Egreso', key: 'egreso', width: 14 },
  ]
  const h2 = s2.getRow(1)
  h2.height = 22
  h2.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = thinBorder
  })

  summary.transactions.forEach((t) => {
    const r = s2.addRow({
      fecha: new Date(t.date + 'T00:00:00'),
      cuenta: t.account === 'oficina' ? 'Oficina' : 'Proyectos',
      tipo: t.type === 'income' ? 'Ingreso' : 'Egreso',
      seccion: categoryPath(categories, t.categoryId),
      desc: t.description,
      metodo: t.paymentMethod ? (t.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia') : '',
      banco: t.bank ?? '',
      nota: t.note ?? '',
      ingreso: t.type === 'income' ? t.amount : null,
      egreso: t.type === 'expense' ? t.amount : null,
    })
    r.getCell('fecha').numFmt = 'dd/mm/yyyy'
    r.getCell('ingreso').numFmt = currencyFmt
    r.getCell('egreso').numFmt = currencyFmt
    r.getCell('tipo').font = { color: { argb: argb(t.type === 'income' ? BRAND.green : BRAND.rose) } }
    r.eachCell((cell) => (cell.border = thinBorder))
  })

  // Fila de totales
  const totalRowNum = s2.rowCount + 1
  const tr = s2.getRow(totalRowNum)
  tr.getCell(8).value = 'TOTALES'
  tr.getCell(9).value = { formula: `SUM(I2:I${totalRowNum - 1})` }
  tr.getCell(10).value = { formula: `SUM(J2:J${totalRowNum - 1})` }
  ;[8, 9, 10].forEach((c) => {
    const cell = tr.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.teal) } }
    cell.border = thinBorder
  })
  tr.getCell(9).numFmt = currencyFmt
  tr.getCell(10).numFmt = currencyFmt
  s2.autoFilter = { from: 'A1', to: `J${Math.max(1, totalRowNum - 1)}` }

  const buf = await wb.xlsx.writeBuffer()
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `GeoCiv_reporte_${slug(scopeLabel)}_${periodLabel}_${stamp()}.xlsx`,
  )
}

// ---------- Respaldo / restauración completa (JSON) ----------

export interface BackupFile {
  app: 'geociv-cuentas'
  version: 1
  exportedAt: string
  settings: Settings | undefined
  categories: Category[]
  transactions: Transaction[]
}

export function exportBackup(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings | undefined,
): void {
  const data: BackupFile = {
    app: 'geociv-cuentas',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    categories,
    transactions,
  }
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `GeoCiv_respaldo_${stamp()}.json`,
  )
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as BackupFile
  if (data.app !== 'geociv-cuentas' || !Array.isArray(data.transactions)) {
    throw new Error('El archivo no es un respaldo válido de GeoCiv Cuentas.')
  }
  return data
}
