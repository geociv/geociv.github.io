import { useEffect, useMemo, useState } from 'react'
import { addBank, addPending, addTransaction, updateTransaction } from '../db/repo'
import { type Category, type PaymentMethod, type Transaction, type TxType } from '../db/types'
import { useAppData } from '../state/AppData'
import { sectionsFor, subsectionsOf } from '../lib/categories'
import { todayISO } from '../lib/dates'
import { parseAmount, roundMoney, sanitizeAmountInput } from '../lib/money'
import { IconArrowDown, IconArrowUp, IconBank, IconCash, IconChevronDown, IconChevronUp, IconClock, IconClose } from './Icons'

interface Props {
  categories: Category[]
  editing?: Transaction | null
  onClose: () => void
}

export function AddTransactionSheet({ categories, editing, onClose }: Props) {
  const { activeAccount, account, settings } = useAppData()
  const allowsIncome = account.allowsIncome

  const [type, setType] = useState<TxType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')

  const editingLeaf = editing ? categories.find((c) => c.id === editing.categoryId) : undefined
  const [sectionId, setSectionId] = useState(editingLeaf?.parentId ?? editingLeaf?.id ?? '')
  const [subId, setSubId] = useState(editingLeaf?.parentId ? editingLeaf.id : '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(editing?.paymentMethod ?? '')
  const [bank, setBank] = useState(editing?.bank ?? '')
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [description, setDescription] = useState(editing?.description ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState('')

  // Saldo por cobrar: el resto que queda cuando se cobra un abono inicial.
  // Solo al crear un ingreso nuevo (al editar no, para no duplicar pendientes).
  const [pendingAmount, setPendingAmount] = useState('')
  const [pendingClient, setPendingClient] = useState('')
  const [pendingDate, setPendingDate] = useState(editing?.date ?? todayISO())
  const askPending = !editing && allowsIncome && type === 'income'

  const sections = useMemo(() => sectionsFor(categories, type, activeAccount), [categories, type, activeAccount])
  const subs = useMemo(() => (sectionId ? subsectionsOf(categories, sectionId, type) : []), [categories, sectionId, type])

  // Al cambiar el tipo, si la sección/subsección ya no aplica, se limpia
  useEffect(() => {
    if (sectionId && !sections.some((s) => s.id === sectionId)) {
      setSectionId('')
      setSubId('')
    } else if (subId && !subs.some((s) => s.id === subId)) {
      setSubId('')
    }
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sube o baja el monto (nunca por debajo de 0)
  function step(delta: number) {
    const current = parseAmount(amount)
    const base = Number.isFinite(current) ? current : 0
    const next = Math.max(0, roundMoney(base + delta))
    setAmount(String(next))
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('Ingresa un monto válido mayor a 0.')
    if (!sectionId) return setError('Selecciona una sección.')
    if (subs.length > 0 && !subId) return setError('Selecciona una subsección.')
    if (paymentMethod === 'transferencia' && !bank.trim())
      return setError('Indica el banco o cooperativa de la transferencia.')

    const payload = {
      account: activeAccount,
      type: allowsIncome ? type : 'expense',
      amount: value,
      categoryId: subId || sectionId,
      date,
      description: description.trim(),
      paymentMethod: paymentMethod || undefined,
      bank,
      note,
    }
    if (editing) {
      await updateTransaction(editing.id, payload)
    } else {
      const txId = await addTransaction(payload)
      const rest = parseAmount(pendingAmount)
      if (askPending && Number.isFinite(rest) && rest > 0) {
        await addPending({
          account: activeAccount,
          client: pendingClient.trim() || description.trim() || 'Sin nombre',
          amount: rest,
          date: pendingDate,
          categoryId: subId || sectionId,
          sourceTxId: txId,
          note: note.trim() || undefined,
        })
      }
    }
    if (paymentMethod === 'transferencia') await addBank(bank)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl safe-bottom dark:bg-navy-850 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-800 dark:text-white">
              {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
            </h2>
            <p className="text-xs text-slate-400">Cuenta: {account.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Cerrar"
          >
            <IconClose width={20} height={20} />
          </button>
        </div>

        {/* Tipo: botones cuadrados (solo si la cuenta permite ingresos) */}
        {allowsIncome ? (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <TypeTile active={type === 'income'} onClick={() => setType('income')} color="emerald" icon={<IconArrowUp width={24} height={24} />} label="Ingreso" />
            <TypeTile active={type === 'expense'} onClick={() => setType('expense')} color="rose" icon={<IconArrowDown width={24} height={24} />} label="Egreso" />
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-300">
            <IconArrowDown width={18} height={18} /> Gasto de oficina
          </div>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Monto</span>
          <div className="relative">
            <input
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
              placeholder="0.00"
              className="field !pr-12 !text-2xl !font-bold tabular-nums"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1">
              <button
                type="button"
                onClick={() => step(1)}
                className="grid h-6 w-8 place-items-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-teal-500 hover:text-white dark:bg-navy-700 dark:text-silver-300"
                aria-label="Subir monto"
              >
                <IconChevronUp width={16} height={16} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => step(-1)}
                className="grid h-6 w-8 place-items-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-teal-500 hover:text-white dark:bg-navy-700 dark:text-silver-300"
                aria-label="Bajar monto"
              >
                <IconChevronDown width={16} height={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>
          <span className="mt-1 block text-xs text-slate-400">Solo positivos, máximo 2 decimales. Usa ▲▼ para ajustar.</span>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Sección</span>
          <select
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value)
              setSubId('')
            }}
            className="field"
          >
            <option value="">— Selecciona —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {subs.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Subsección</span>
            <select value={subId} onChange={(e) => setSubId(e.target.value)} className="field">
              <option value="">— Selecciona —</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Método de pago */}
        <div className="mb-3">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Método de pago <span className="font-normal text-slate-400">(opcional)</span>
          </span>
          <div className="grid grid-cols-2 gap-3">
            <PayTile active={paymentMethod === 'efectivo'} onClick={() => setPaymentMethod((m) => (m === 'efectivo' ? '' : 'efectivo'))} icon={<IconCash width={20} height={20} />} label="Efectivo" />
            <PayTile active={paymentMethod === 'transferencia'} onClick={() => setPaymentMethod((m) => (m === 'transferencia' ? '' : 'transferencia'))} icon={<IconBank width={20} height={20} />} label="Transferencia" />
          </div>
        </div>

        {paymentMethod === 'transferencia' && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Banco o cooperativa</span>
            <input
              list="banks-list"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Escribe o elige…"
              className="field"
            />
            <datalist id="banks-list">
              {settings.banks.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <span className="mt-1 block text-xs text-slate-400">Si escribes uno nuevo, se guarda para la próxima vez.</span>
          </label>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Concepto del movimiento"
            className="field"
          />
        </label>

        {/* Saldo por cobrar: el 50% (o lo que sea) que falta */}
        {askPending && (
          <div className="mb-4 space-y-2.5 rounded-xl border border-amber-400/40 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <IconClock width={16} height={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">¿Queda un saldo por cobrar?</span>
            </div>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={pendingAmount}
                onChange={(e) => setPendingAmount(sanitizeAmountInput(e.target.value))}
                placeholder="Monto que falta (opcional)"
                className="field flex-1 tabular-nums"
              />
              <button
                type="button"
                onClick={() => setPendingAmount(amount)}
                disabled={!amount}
                className="shrink-0 rounded-lg border border-amber-400/60 px-3 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/10 disabled:opacity-40 dark:text-amber-400"
                title="El resto es igual a lo cobrado ahora"
              >
                Falta el 50%
              </button>
            </div>
            {parseAmount(pendingAmount) > 0 && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  value={pendingClient}
                  onChange={(e) => setPendingClient(e.target.value)}
                  placeholder="Cliente u obra"
                  className="field"
                />
                <input type="date" value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} className="field" />
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-silver-400">
              No suma al balance: queda anotado en <b>Saldos por cobrar</b> hasta que lo cobres.
            </p>
          </div>
        )}

        <label className="mb-5 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Información extra <span className="font-normal text-slate-400">(opcional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Nº de factura, obra, proveedor, observaciones…"
            className="field resize-none"
          />
        </label>

        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10">{error}</p>}

        <button
          type="submit"
          className={`w-full rounded-xl py-3.5 font-semibold text-white shadow-md transition active:scale-[0.99] ${
            allowsIncome && type === 'income'
              ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700'
              : 'bg-teal-500 shadow-teal-500/20 hover:bg-teal-600'
          }`}
        >
          {editing ? 'Guardar cambios' : 'Registrar movimiento'}
        </button>
      </form>
    </div>
  )
}

function TypeTile({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  color: 'emerald' | 'rose'
  icon: React.ReactNode
  label: string
}) {
  const on =
    color === 'emerald'
      ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
      : 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/20'
  const off = 'border-slate-200 bg-slate-50 text-slate-500 dark:border-navy-600 dark:bg-navy-900 dark:text-silver-400'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 font-semibold transition ${
        active ? on : off
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function PayTile({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-300'
          : 'border-slate-200 bg-white text-slate-500 dark:border-navy-600 dark:bg-navy-900 dark:text-silver-400'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
