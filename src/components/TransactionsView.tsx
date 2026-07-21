import { useMemo, useState } from 'react'
import { useAppData } from '../state/AppData'
import { deleteTransaction } from '../db/repo'
import type { Transaction, TxType } from '../db/types'
import { fmtDate } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { categoryPath } from '../lib/categories'
import { AddTransactionSheet } from './AddTransactionSheet'
import { IconArrowDown, IconArrowUp, IconBank, IconCash, IconEdit, IconSearch, IconTrash } from './Icons'

type Filter = 'all' | TxType

export function TransactionsView() {
  const { transactions, categories, settings } = useAppData()
  const money = (n: number) => formatMoney(n, settings)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const path = (id: string) => categoryPath(categories, id)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false
      if (!q) return true
      return (
        t.description.toLowerCase().includes(q) ||
        (t.note ?? '').toLowerCase().includes(q) ||
        (t.bank ?? '').toLowerCase().includes(q) ||
        path(t.categoryId).toLowerCase().includes(q)
      )
    })
  }, [transactions, filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onDelete(t: Transaction) {
    if (confirm(`¿Eliminar este movimiento de ${money(t.amount)}?`)) {
      await deleteTransaction(t.id)
    }
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'income', label: 'Ingresos' },
    { id: 'expense', label: 'Egresos' },
  ]

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripción, nota o categoría…"
          className="field !pl-10 text-sm"
        />
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.id
                ? 'bg-teal-500 text-white shadow-sm'
                : 'card text-slate-500 dark:text-silver-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">No hay movimientos que coincidan.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    t.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {t.type === 'income' ? <IconArrowUp width={17} height={17} /> : <IconArrowDown width={17} height={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.description || path(t.categoryId)}</p>
                  <p className="truncate text-xs text-slate-400">
                    {path(t.categoryId)} · {fmtDate(t.date)}
                  </p>
                  {t.paymentMethod && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/5 dark:text-silver-400">
                      {t.paymentMethod === 'efectivo' ? <IconCash width={12} height={12} /> : <IconBank width={12} height={12} />}
                      {t.paymentMethod === 'transferencia' ? t.bank || 'Transferencia' : 'Efectivo'}
                    </span>
                  )}
                  {t.note && <p className="mt-1 line-clamp-2 text-xs italic text-slate-400">{t.note}</p>}
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {money(t.amount)}
                </span>
              </div>
              <div className="mt-2 flex justify-end gap-1 border-t border-black/5 pt-2 dark:border-white/5">
                <button
                  onClick={() => setEditing(t)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <IconEdit width={14} height={14} /> Editar
                </button>
                <button
                  onClick={() => onDelete(t)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <IconTrash width={14} height={14} /> Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AddTransactionSheet categories={categories} editing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
