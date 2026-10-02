import { useState } from 'react'
import { useAppData } from '../state/AppData'
import { saveFunds, type FundInput } from '../db/repo'
import { fmtDate } from '../lib/dates'
import { fundPlaces, type FundPlace } from '../lib/funds'
import { formatMoney, parseAmount, sanitizeAmountInput } from '../lib/money'
import { IconBank, IconCash, IconClose } from './Icons'

export function FundsSheet({ onClose }: { onClose: () => void }) {
  const { funds, activeAccount, settings } = useAppData()
  const money = (n: number) => formatMoney(n, settings)
  const places = fundPlaces(activeAccount, settings.banks, funds)

  // Solo lo que el usuario tocó: si mientras tanto llega un valor del otro
  // equipo en un campo que no se editó, se muestra y no se pisa al guardar.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const shown = (p: FundPlace) => edits[p.id] ?? (p.fund ? String(p.fund.amount) : '')
  const total = places.reduce((s, p) => {
    const v = parseAmount(shown(p))
    return shown(p).trim() && Number.isFinite(v) ? s + v : s
  }, 0)

  async function save() {
    const entries: FundInput[] = []
    for (const p of places) {
      const raw = edits[p.id]
      if (raw === undefined) continue
      if (!raw.trim()) {
        entries.push({ kind: p.kind, name: p.name, amount: null })
        continue
      }
      const value = parseAmount(raw)
      if (!Number.isFinite(value)) return setError(`Revisa el valor de ${p.name}.`)
      entries.push({ kind: p.kind, name: p.name, amount: value })
    }
    await saveFunds(activeAccount, entries)
    onClose()
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
            <h2 className="text-lg font-bold text-navy-800 dark:text-white">Dinero disponible</h2>
            <p className="text-xs text-slate-400">Valores escritos a mano. No afectan el balance. Total: {money(total)}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cerrar">
            <IconClose width={20} height={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-2">
            {places.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-900">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-600">
                    {p.kind === 'efectivo' ? <IconCash width={18} height={18} /> : <IconBank width={18} height={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {p.fund ? `Actualizado el ${fmtDate(new Date(p.fund.updatedAt).toISOString())}` : 'Sin valor'}
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <input
                      inputMode="decimal"
                      value={shown(p)}
                      onChange={(e) => {
                        setEdits((cur) => ({ ...cur, [p.id]: sanitizeAmountInput(e.target.value) }))
                        setError('')
                      }}
                      placeholder="0,00"
                      className="field text-right font-semibold tabular-nums"
                    />
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Deja un valor vacío para quitarlo. Para agregar otro banco o cooperativa, ve a Ajustes → Bancos y cooperativas.
          </p>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="border-t border-black/5 px-5 py-4 dark:border-white/10">
          <button onClick={save} className="w-full rounded-xl bg-teal-500 py-3 font-semibold text-white hover:bg-teal-600">
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
