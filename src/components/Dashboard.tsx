import { useMemo } from 'react'
import { useAppData } from '../state/AppData'
import { rangeFor, fmtDateShort } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { summarize, totalBalance } from '../lib/reports'
import { categoryPath, rootSectionId, sectionsOfAccount } from '../lib/categories'
import { IconArrowDown, IconArrowUp, IconChevronRight, IconFolder, IconPlus, IconWallet } from './Icons'

export function Dashboard({ onAdd, onOpenProject }: { onAdd: () => void; onOpenProject: (id: string) => void }) {
  const { transactions, categories, settings, account, activeAccount } = useAppData()
  const money = (n: number) => formatMoney(n, settings)
  const allowsIncome = account.allowsIncome

  // Totales por proyecto (solo cuenta Proyectos)
  const projects = useMemo(() => {
    if (!allowsIncome) return []
    const sections = sectionsOfAccount(categories, activeAccount)
    return sections
      .map((s) => {
        let income = 0
        let expense = 0
        for (const t of transactions) {
          if (rootSectionId(categories, t.categoryId) !== s.id) continue
          if (t.type === 'income') income += t.amount
          else expense += t.amount
        }
        return { id: s.id, name: s.name, color: s.color, income, expense, balance: income - expense, count: income || expense ? 1 : 0 }
      })
      .sort((a, b) => b.balance - a.balance)
  }, [transactions, categories, activeAccount, allowsIncome])

  const total = useMemo(() => totalBalance(transactions), [transactions])
  const today = useMemo(
    () => summarize(transactions, categories, rangeFor('daily', new Date(), settings.weekStartsOn)),
    [transactions, categories, settings.weekStartsOn],
  )
  const month = useMemo(
    () => summarize(transactions, categories, rangeFor('monthly', new Date(), settings.weekStartsOn)),
    [transactions, categories, settings.weekStartsOn],
  )

  const catName = (id: string) => categoryPath(categories, id)
  const recent = transactions.slice(0, 6)

  return (
    <div className="space-y-5">
      {/* Balance total */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-2xl" />
        <div className="flex items-center gap-2 text-silver-400">
          <IconWallet width={18} height={18} />
          <p className="text-sm">{allowsIncome ? 'Balance total' : 'Total de gastos'}</p>
        </div>
        <p className="mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums">
          {money(allowsIncome ? total.balance : total.expense)}
        </p>
        {allowsIncome ? (
          <div className="mt-4 flex gap-3">
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm text-emerald-300">
              <IconArrowUp width={15} height={15} /> {money(total.income)}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1 text-sm text-rose-300">
              <IconArrowDown width={15} height={15} /> {money(total.expense)}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-silver-400">{transactions.length} movimientos registrados</p>
        )}
      </div>

      {/* Hoy y Este mes */}
      <div className="grid grid-cols-2 gap-3">
        <MiniCard
          label={allowsIncome ? 'Hoy' : 'Gastos hoy'}
          value={money(allowsIncome ? today.balance : today.expense)}
          sub={`${today.count} movimientos`}
          positive={allowsIncome ? today.balance >= 0 : false}
        />
        <MiniCard
          label={allowsIncome ? 'Este mes' : 'Gastos del mes'}
          value={money(allowsIncome ? month.balance : month.expense)}
          sub={`${month.count} movimientos`}
          positive={allowsIncome ? month.balance >= 0 : false}
        />
      </div>

      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-3.5 font-semibold text-white shadow-md shadow-teal-500/20 transition hover:bg-teal-600 active:scale-[0.99]"
      >
        <IconPlus width={20} height={20} strokeWidth={2.2} /> Registrar movimiento
      </button>

      {/* Proyectos (solo cuenta Proyectos) */}
      {allowsIncome && projects.length > 0 && (
        <div>
          <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Proyectos</h2>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onOpenProject(p.id)}
                  className="card flex w-full items-center gap-3 p-4 text-left transition hover:ring-2 hover:ring-teal-500/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: p.color }}>
                    <IconFolder width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-800 dark:text-white">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      <span className="text-emerald-600">↑ {money(p.income)}</span>{' '}
                      <span className="text-rose-500">↓ {money(p.expense)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-bold tabular-nums ${p.balance >= 0 ? 'text-teal-600' : 'text-rose-500'}`}>
                      {money(p.balance)}
                    </span>
                    <IconChevronRight width={16} height={16} className="text-slate-300" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Últimos movimientos */}
      <div>
        <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Últimos movimientos
        </h2>
        {recent.length === 0 ? (
          <div className="card grid place-items-center gap-1 p-8 text-center">
            <p className="text-sm text-slate-400">Aún no hay movimientos registrados</p>
            <p className="text-xs text-slate-400">Toca “Registrar movimiento” para empezar</p>
          </div>
        ) : (
          <ul className="card divide-y divide-black/5 overflow-hidden dark:divide-white/5">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    t.type === 'income'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {t.type === 'income' ? <IconArrowUp width={17} height={17} /> : <IconArrowDown width={17} height={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.description || catName(t.categoryId)}</p>
                  <p className="truncate text-xs text-slate-400">
                    {catName(t.categoryId)} · {fmtDateShort(t.date)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {money(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function MiniCard({ label, value, sub, positive }: { label: string; value: string; sub: string; positive: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${positive ? 'text-navy-800 dark:text-white' : 'text-rose-500'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  )
}
