import { useMemo, useState } from 'react'
import { useAppData } from '../state/AppData'
import { rangeFor, fmtDate, fmtDateShort } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { summarize, totalBalance } from '../lib/reports'
import { categoryPath, rootSectionId, sectionsOfAccount } from '../lib/categories'
import { fundPlaces } from '../lib/funds'
import { IconArrowDown, IconArrowUp, IconBank, IconCash, IconChevronRight, IconClock, IconFolder, IconPlus, IconWallet } from './Icons'
import { AdvancesSheet } from './AdvancesSheet'
import { FundsSheet } from './FundsSheet'
import { PendingsSheet } from './PendingsSheet'

export function Dashboard({ onAdd, onOpenProject }: { onAdd: () => void; onOpenProject: (id: string) => void }) {
  const { transactions, categories, advances, pendings, funds, settings, account, activeAccount } = useAppData()
  const money = (n: number) => formatMoney(n, settings)
  const allowsIncome = account.allowsIncome
  const [showAdvances, setShowAdvances] = useState(false)
  const [showPendings, setShowPendings] = useState(false)
  const [showFunds, setShowFunds] = useState(false)

  const advancesTotal = useMemo(() => advances.reduce((s, a) => s + a.amount, 0), [advances])
  const pendingsTotal = useMemo(() => pendings.reduce((s, p) => s + p.amount, 0), [pendings])
  // Dinero disponible: solo los lugares con valor escrito, en el orden de la hoja
  const fundRows = useMemo(
    () => fundPlaces(activeAccount, settings.banks, funds).filter((p) => p.fund),
    [activeAccount, settings.banks, funds],
  )
  const fundsTotal = useMemo(() => funds.reduce((s, f) => s + f.amount, 0), [funds])
  const fundsUpdatedAt = useMemo(() => Math.max(0, ...funds.map((f) => f.updatedAt)), [funds])

  // Totales por proyecto (solo cuenta Proyectos)
  const projects = useMemo(() => {
    if (activeAccount !== 'proyectos') return []
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

      {/* Dinero disponible: efectivo y bancos escritos a mano (no afectan el balance) */}
      <button
        onClick={() => setShowFunds(true)}
        className="card w-full p-4 text-left transition hover:ring-2 hover:ring-teal-500/40"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/15 text-teal-600">
            <IconCash width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400">Dinero disponible</p>
            <p className="text-lg font-bold tabular-nums text-teal-600">{money(fundsTotal)}</p>
          </div>
          <span className="flex items-center gap-1 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-600">
            {fundRows.length > 0 ? 'Modificar' : 'Registrar'}
            <IconChevronRight width={14} height={14} />
          </span>
        </div>
        {fundRows.length > 0 && (
          <>
            <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3 dark:border-white/10">
              {fundRows.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-silver-300">
                    {p.kind === 'efectivo' ? (
                      <IconCash width={15} height={15} className="shrink-0 text-slate-400" />
                    ) : (
                      <IconBank width={15} height={15} className="shrink-0 text-slate-400" />
                    )}
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-500">{money(p.fund!.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Actualizado el {fmtDate(new Date(fundsUpdatedAt).toISOString())} · no se suma al balance
            </p>
          </>
        )}
      </button>

      {/* Adelantos a trabajadores (no afectan el balance) */}
      <button
        onClick={() => setShowAdvances(true)}
        className="card flex w-full items-center gap-3 p-4 text-left transition hover:ring-2 hover:ring-copper-500/40"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-copper-500/15 text-copper-500">
          <IconWallet width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-400">Adelantos pendientes</p>
          <p className="text-lg font-bold tabular-nums text-copper-500">{money(advancesTotal)}</p>
        </div>
        <span className="flex items-center gap-1 rounded-lg bg-copper-500/10 px-3 py-1.5 text-xs font-semibold text-copper-500">
          {advances.length > 0 ? 'Gestionar / Quitar' : 'Registrar'}
          <IconChevronRight width={14} height={14} />
        </span>
      </button>

      {/* Saldos por cobrar (no suman al balance hasta cobrarse) */}
      <button
        onClick={() => setShowPendings(true)}
        className="card flex w-full items-center gap-3 p-4 text-left transition hover:ring-2 hover:ring-amber-500/40"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
          <IconClock width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-400">Saldos por cobrar</p>
          <p className="text-lg font-bold tabular-nums text-amber-500">{money(pendingsTotal)}</p>
        </div>
        <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500">
          {pendings.length > 0 ? `${pendings.length} pendiente${pendings.length > 1 ? 's' : ''}` : 'Registrar'}
          <IconChevronRight width={14} height={14} />
        </span>
      </button>

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
      {activeAccount === 'proyectos' && projects.length > 0 && (
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

      {showAdvances && <AdvancesSheet onClose={() => setShowAdvances(false)} />}
      {showPendings && <PendingsSheet onClose={() => setShowPendings(false)} />}
      {showFunds && <FundsSheet onClose={() => setShowFunds(false)} />}
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
