import { useRef, useState } from 'react'
import { useAppData } from '../state/AppData'
import { ACCOUNTS, type AccountId } from '../db/types'
import { commitImport, downloadTemplate, parseWorkbook, TEMPLATE_SPEC, type ParsedImport } from '../lib/import'
import { exportBackup } from '../lib/export'
import { formatMoney } from '../lib/money'
import { fmtDate } from '../lib/dates'
import { IconDownload, IconFolder, IconUpload, IconWallet } from './Icons'

export function ImportExcel() {
  const { settings, allTransactions, allCategories } = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [account, setAccount] = useState<AccountId>('oficina')
  const [dayFirst, setDayFirst] = useState(true)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)

  const money = (n: number) => formatMoney(n, settings)
  const spec = TEMPLATE_SPEC[account]

  function reset() {
    setParsed(null)
    setBuffer(null)
    setFileName('')
  }

  async function onFile(file: File) {
    const buf = await file.arrayBuffer()
    setBuffer(buf)
    setFileName(file.name)
    setParsed(parseWorkbook(buf, account, dayFirst))
    setStatus('')
  }

  function reparse(nextAccount = account, nextDayFirst = dayFirst) {
    if (buffer) setParsed(parseWorkbook(buffer, nextAccount, nextDayFirst))
  }

  async function confirmImport() {
    if (!parsed?.rows.length) return
    setBusy(true)
    try {
      const n = await commitImport(parsed.rows)
      setStatus(`✓ Se importaron ${n} movimientos a ${account === 'oficina' ? 'Oficina' : 'Proyectos'}.`)
      reset()
    } catch (e) {
      setStatus(`✕ Error al importar: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-silver-400">
        Sube el histórico desde Excel. <b>Oficina y Proyectos se suben por separado</b>, cada uno con su plantilla.
      </p>

      {/* 1. Qué cuenta */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-500">1. ¿Qué vas a importar?</span>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNTS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAccount(a.id)
                reset()
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
                account === a.id
                  ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-300'
                  : 'border-slate-200 text-slate-500 dark:border-navy-600 dark:text-silver-400'
              }`}
            >
              {a.id === 'oficina' ? <IconWallet width={17} height={17} /> : <IconFolder width={17} height={17} />}
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Plantilla */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-500">2. Usa la plantilla obligatoria</span>
        <button
          onClick={() => downloadTemplate(account)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-navy-600 dark:hover:bg-white/5"
        >
          <IconDownload width={16} height={16} /> Plantilla de {account === 'oficina' ? 'Oficina' : 'Proyectos'}
        </button>
        <p className="mt-1.5 text-xs text-slate-400">
          Columnas obligatorias: <b>{spec.required.join(', ')}</b>. Opcionales: {spec.optional.join(', ')}.
        </p>
      </div>

      {/* 3. Formato de fecha + archivo */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Formato de fecha</span>
          <select
            value={dayFirst ? 'dmy' : 'mdy'}
            onChange={(e) => {
              const v = e.target.value === 'dmy'
              setDayFirst(v)
              reparse(account, v)
            }}
            className="field"
          >
            <option value="dmy">Día/Mes/Año (15/01/2026)</option>
            <option value="mdy">Mes/Día/Año (01/15/2026)</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600"
          >
            <IconUpload width={16} height={16} /> 3. Elegir archivo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {fileName && <p className="text-xs text-slate-400">Archivo: {fileName}</p>}

      {/* Error de formato */}
      {parsed?.formatError && (
        <div className="rounded-xl border border-rose-300/60 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <b>Formato incorrecto.</b> {parsed.formatError}
        </div>
      )}

      {/* Vista previa */}
      {parsed && !parsed.formatError && (
        <div className="space-y-3 rounded-xl border border-black/5 p-3 dark:border-white/10">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600">
              {parsed.rows.length} listos para importar
            </span>
            {parsed.errors.length > 0 && (
              <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600">
                {parsed.errors.length} con problemas (se omiten)
              </span>
            )}
          </div>

          {parsed.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1 pr-2">Fecha</th>
                    <th className="py-1 pr-2">Tipo</th>
                    <th className="py-1 pr-2">{account === 'oficina' ? 'Sección' : 'Proyecto'}</th>
                    <th className="py-1 pr-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 8).map((r) => (
                    <tr key={r.rowNumber} className="border-t border-black/5 dark:border-white/5">
                      <td className="whitespace-nowrap py-1 pr-2">{fmtDate(r.date)}</td>
                      <td className={`py-1 pr-2 ${r.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {r.type === 'income' ? 'Ingreso' : 'Egreso'}
                      </td>
                      <td className="py-1 pr-2">
                        {r.section}
                        {r.subsection ? ` › ${r.subsection}` : ''}
                      </td>
                      <td className="py-1 pr-2 text-right tabular-nums">{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 8 && <p className="mt-1 text-xs text-slate-400">…y {parsed.rows.length - 8} más.</p>}
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Revisa que las <b>fechas</b> sean correctas. Si están cambiadas, ajusta el formato arriba.
              </p>
            </div>
          )}

          {parsed.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-amber-600">Ver filas con problemas</summary>
              <ul className="mt-1 space-y-0.5 text-slate-500">
                {parsed.errors.slice(0, 10).map((e) => (
                  <li key={e.rowNumber}>
                    Fila {e.rowNumber}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportBackup(allTransactions, allCategories, settings)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-navy-600 dark:hover:bg-white/5"
            >
              Respaldar antes
            </button>
            <button
              onClick={confirmImport}
              disabled={busy || parsed.rows.length === 0}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
            >
              {busy ? 'Importando…' : `Importar ${parsed.rows.length} a ${account === 'oficina' ? 'Oficina' : 'Proyectos'}`}
            </button>
            <button onClick={reset} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status && <p className="text-sm">{status}</p>}
    </div>
  )
}
