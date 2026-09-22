import { useMemo, useState } from 'react'
import { useAppData } from '../state/AppData'
import { addPending, deletePending, settlePending } from '../db/repo'
import type { PaymentMethod, Pending } from '../db/types'
import { leafOptionsFor } from '../lib/categories'
import { fmtDate, todayISO } from '../lib/dates'
import { formatMoney, parseAmount, sanitizeAmountInput } from '../lib/money'
import { IconCheck, IconClock, IconClose, IconPlus, IconTrash } from './Icons'

/**
 * Saldos por cobrar: el porcentaje que falta cuando se cobra un abono inicial.
 * No suman al balance; al cobrarlos se convierten en un ingreso real.
 */
export function PendingsSheet({ onClose }: { onClose: () => void }) {
  const { pendings, categories, activeAccount, settings } = useAppData()
  const money = (n: number) => formatMoney(n, settings)

  const options = useMemo(() => leafOptionsFor(categories, 'income', activeAccount), [categories, activeAccount])

  const [client, setClient] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  /** Pendiente que se está cobrando (panel desplegado). */
  const [settling, setSettling] = useState<Pending | null>(null)

  const total = pendings.reduce((s, p) => s + p.amount, 0)
  const sorted = [...pendings].sort((a, b) => (a.date < b.date ? 1 : -1))

  async function add() {
    const value = parseAmount(amount)
    if (!client.trim()) return setError('Escribe el cliente u obra.')
    if (!Number.isFinite(value) || value <= 0) return setError('Ingresa un monto válido.')
    await addPending({
      account: activeAccount,
      client: client.trim(),
      amount: value,
      date,
      categoryId: categoryId || undefined,
      note,
    })
    setClient('')
    setAmount('')
    setNote('')
    setDate(todayISO())
    setError('')
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
            <h2 className="text-lg font-bold text-navy-800 dark:text-white">Saldos por cobrar</h2>
            <p className="text-xs text-slate-400">No suman al balance hasta cobrarse. Total: {money(total)}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cerrar">
            <IconClose width={20} height={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Registrar nuevo saldo pendiente */}
          <div className="mb-4 space-y-2.5 rounded-2xl border border-black/5 p-3 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registrar saldo por cobrar</p>
            <input
              value={client}
              onChange={(e) => {
                setClient(e.target.value)
                setError('')
              }}
              placeholder="Cliente u obra"
              className="field"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(sanitizeAmountInput(e.target.value))
                  setError('')
                }}
                placeholder="Monto por cobrar"
                className="field font-semibold tabular-nums"
              />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
            </div>
            {options.length > 0 && (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field">
                <option value="">Sección al cobrar (opcional)</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="field" />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button onClick={add} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 font-semibold text-white hover:bg-teal-600">
              <IconPlus width={18} height={18} /> Agregar saldo pendiente
            </button>
          </div>

          {/* Lista de pendientes */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Por cobrar ({sorted.length})
          </p>
          {sorted.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-navy-600">
              No hay saldos por cobrar.
            </p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((p) => (
                <li key={p.id} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-500">
                      <IconClock width={16} height={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.client}</p>
                      <p className="truncate text-xs text-slate-400">
                        {fmtDate(p.date)}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-amber-500">{money(p.amount)}</span>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setSettling(settling?.id === p.id ? null : p)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20"
                    >
                      <IconCheck width={14} height={14} /> Cobrar
                    </button>
                    <button
                      onClick={() => void deletePending(p.id)}
                      className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/20"
                    >
                      <IconTrash width={14} height={14} /> Anular
                    </button>
                  </div>

                  {settling?.id === p.id && (
                    <SettleForm pending={p} options={options} onDone={() => setSettling(null)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Panel para cobrar: elige sección, fecha y método; crea el ingreso real. */
function SettleForm({
  pending,
  options,
  onDone,
}: {
  pending: Pending
  options: { id: string; label: string }[]
  onDone: () => void
}) {
  const valid = (id?: string) => Boolean(id && options.some((o) => o.id === id))
  const [categoryId, setCategoryId] = useState(valid(pending.categoryId) ? pending.categoryId! : '')
  const [date, setDate] = useState(todayISO())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!categoryId) return setError('Elige la sección donde entra el ingreso.')
    setBusy(true)
    try {
      await settlePending(pending.id, { categoryId, date, paymentMethod: paymentMethod || undefined })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="text-xs text-slate-500 dark:text-silver-400">
        Al confirmar se registra un <b>ingreso</b> por este monto y el saldo deja de estar pendiente.
      </p>
      <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setError('') }} className="field">
        <option value="">— Sección del ingreso —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2.5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')} className="field">
          <option value="">Método (opcional)</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-amber-600">
          No hay secciones de ingreso todavía. Crea una en Ajustes → Secciones.
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={busy}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? 'Registrando…' : 'Confirmar cobro'}
        </button>
        <button onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
          Cancelar
        </button>
      </div>
    </div>
  )
}
