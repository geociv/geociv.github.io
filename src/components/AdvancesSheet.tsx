import { useState } from 'react'
import { useAppData } from '../state/AppData'
import { addAdvance, deleteAdvance } from '../db/repo'
import { fmtDate, todayISO } from '../lib/dates'
import { formatMoney, parseAmount, sanitizeAmountInput } from '../lib/money'
import { IconClose, IconPlus, IconTrash } from './Icons'

export function AdvancesSheet({ onClose }: { onClose: () => void }) {
  const { advances, activeAccount, settings } = useAppData()
  const money = (n: number) => formatMoney(n, settings)

  const [worker, setWorker] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const total = advances.reduce((s, a) => s + a.amount, 0)
  const sorted = [...advances].sort((a, b) => (a.date < b.date ? 1 : -1))

  async function add() {
    const value = parseAmount(amount)
    if (!worker.trim()) return setError('Escribe el nombre del trabajador.')
    if (!Number.isFinite(value) || value <= 0) return setError('Ingresa un monto válido.')
    await addAdvance({ account: activeAccount, worker: worker.trim(), amount: value, date, note })
    setWorker('')
    setAmount('')
    setNote('')
    setDate(todayISO())
    setError('')
  }

  async function quitar(id: string, w: string, amt: number) {
    if (confirm(`¿Quitar el adelanto de ${w} por ${money(amt)}? Se marcará como liquidado.`)) {
      await deleteAdvance(id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl safe-bottom dark:bg-navy-850 sm:rounded-3xl"
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-navy-800 dark:text-white">Adelantos a trabajadores</h2>
            <p className="text-xs text-slate-400">No afectan el balance. Pendiente: {money(total)}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cerrar">
            <IconClose width={20} height={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Registrar nuevo adelanto */}
          <div className="mb-4 space-y-2.5 rounded-2xl border border-black/5 p-3 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registrar adelanto</p>
            <input value={worker} onChange={(e) => { setWorker(e.target.value); setError('') }} placeholder="Nombre del trabajador" className="field" />
            <div className="grid grid-cols-2 gap-2.5">
              <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(sanitizeAmountInput(e.target.value)); setError('') }} placeholder="Monto" className="field font-semibold tabular-nums" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="field" />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button onClick={add} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 font-semibold text-white hover:bg-teal-600">
              <IconPlus width={18} height={18} /> Agregar adelanto
            </button>
          </div>

          {/* Lista de pendientes */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pendientes ({sorted.length})
          </p>
          {sorted.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-navy-600">
              No hay adelantos pendientes.
            </p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-900">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.worker}</p>
                    <p className="truncate text-xs text-slate-400">
                      {fmtDate(a.date)}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-copper-500">{money(a.amount)}</span>
                  <button
                    onClick={() => quitar(a.id, a.worker, a.amount)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/20"
                  >
                    <IconTrash width={14} height={14} /> Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
