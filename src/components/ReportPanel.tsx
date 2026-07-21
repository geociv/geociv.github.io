import { useMemo, useState } from 'react'
import { addDays, addMonths, addWeeks, addYears } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category, Settings, Transaction } from '../db/types'
import { rangeFor, type Period } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { seriesFor, summarize, type MethodBreakdown } from '../lib/reports'
import { exportReportExcel, exportReportPDF } from '../lib/export'
import { IconBank, IconCash, IconChevronLeft, IconChevronRight, IconExcel, IconPdf } from './Icons'

const PERIOD_LABEL: Record<Period, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

interface Props {
  transactions: Transaction[]
  categories: Category[]
  settings: Settings
  /** Etiqueta del alcance (ej. "Oficina", "Proyecto 1", "General – Empresa"). */
  scopeLabel: string
}

export function ReportPanel({ transactions, categories, settings, scopeLabel }: Props) {
  const money = (n: number) => formatMoney(n, settings)
  const [period, setPeriod] = useState<Period>('monthly')
  const [ref, setRef] = useState<Date>(new Date())
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  const range = useMemo(() => rangeFor(period, ref, settings.weekStartsOn), [period, ref, settings.weekStartsOn])
  const summary = useMemo(() => summarize(transactions, categories, range), [transactions, categories, range])
  const series = useMemo(() => seriesFor(transactions, range, period), [transactions, range, period])

  function shift(dir: -1 | 1) {
    if (period === 'daily') setRef((d) => addDays(d, dir))
    else if (period === 'weekly') setRef((d) => addWeeks(d, dir))
    else if (period === 'monthly') setRef((d) => addMonths(d, dir))
    else setRef((d) => addYears(d, dir))
  }

  return (
    <div className="space-y-4">
      {/* Selector de período */}
      <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-navy-900">
        {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
              period === p ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 dark:text-silver-400'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Navegación de rango */}
      <div className="card flex items-center justify-between px-2 py-2">
        <button onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Anterior">
          <IconChevronLeft width={20} height={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-navy-800 dark:text-white">{range.label}</p>
          <button onClick={() => setRef(new Date())} className="text-xs font-medium text-teal-500 hover:underline">Ir a hoy</button>
        </div>
        <button onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Siguiente">
          <IconChevronRight width={20} height={20} />
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryCard label="Ingresos" value={money(summary.income)} className="text-emerald-600" />
        <SummaryCard label="Egresos" value={money(summary.expense)} className="text-rose-500" />
        <SummaryCard label="Balance" value={money(summary.balance)} className={summary.balance >= 0 ? 'text-teal-600' : 'text-rose-500'} />
      </div>

      {/* Gráfica de barras */}
      {series.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Ingresos vs Egresos</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="expense" name="Egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {summary.income > 0 && <MethodCard title="Ingresos por método de pago" data={summary.incomeByMethod} money={money} />}
      {summary.expenseByCategory.length > 0 && <CategoryChart title="Egresos por sección" data={summary.expenseByCategory} money={money} />}
      {summary.incomeByCategory.length > 0 && <CategoryChart title="Ingresos por sección" data={summary.incomeByCategory} money={money} />}

      {summary.count === 0 && <div className="card p-8 text-center text-sm text-slate-400">No hay movimientos en este período.</div>}

      {/* Exportar */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={async () => {
            setExporting('pdf')
            try {
              await exportReportPDF(summary, categories, settings, range, PERIOD_LABEL[period], scopeLabel)
            } finally {
              setExporting(null)
            }
          }}
          disabled={summary.count === 0 || exporting !== null}
          className="flex items-center justify-center gap-2 rounded-xl bg-navy-800 py-3 font-medium text-white transition hover:bg-navy-700 disabled:opacity-40"
        >
          <IconPdf width={18} height={18} /> {exporting === 'pdf' ? 'Generando…' : 'PDF'}
        </button>
        <button
          onClick={async () => {
            setExporting('excel')
            try {
              await exportReportExcel(summary, categories, PERIOD_LABEL[period], scopeLabel, settings, range)
            } finally {
              setExporting(null)
            }
          }}
          disabled={summary.count === 0 || exporting !== null}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-40"
        >
          <IconExcel width={18} height={18} /> {exporting === 'excel' ? 'Generando…' : 'Excel'}
        </button>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  )
}

function MethodCard({ title, data, money }: { title: string; data: MethodBreakdown; money: (n: number) => string }) {
  const total = data.efectivo + data.transferencia + data.otro
  const rows = [
    { key: 'efectivo', label: 'Efectivo', value: data.efectivo, icon: <IconCash width={16} height={16} />, color: '#16a34a' },
    { key: 'transferencia', label: 'Transferencia', value: data.transferencia, icon: <IconBank width={16} height={16} />, color: '#1ba3a3' },
    { key: 'otro', label: 'Sin especificar', value: data.otro, icon: null, color: '#94a3b8' },
  ].filter((r) => r.value > 0)

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
          return (
            <div key={r.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-silver-300">
                  <span style={{ color: r.color }}>{r.icon}</span>
                  {r.label}
                </span>
                <span className="font-medium tabular-nums text-slate-500">
                  {money(r.value)} <span className="text-xs text-slate-400">· {pct}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-900">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface BreakItem {
  categoryId: string
  name: string
  color: string
  total: number
}

function CategoryChart({ title, data, money }: { title: string; data: BreakItem[]; money: (n: number) => string }) {
  return (
    <div className="card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="45%" height={140}>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius={32} outerRadius={62} paddingAngle={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.categoryId} fill={d.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip formatter={(v) => money(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-1.5 text-sm">
          {data.slice(0, 6).map((d) => (
            <li key={d.categoryId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="truncate text-slate-600 dark:text-silver-300">{d.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-slate-500">{money(d.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
