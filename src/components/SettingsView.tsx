import { useRef, useState } from 'react'
import { useAppData } from '../state/AppData'
import { db } from '../db/database'
import { addBank, addCategory, deleteCategory, removeBank, updateCategory, updateSettings } from '../db/repo'
import type { AccountId, Category, Settings, TxType } from '../db/types'
import { sectionsOfAccount, subsectionsOf } from '../lib/categories'
import { exportBackup, parseBackup } from '../lib/export'
import { ImportExcel } from './ImportExcel'
import { isSyncConfigured } from '../lib/sync'
import { IconArrowDown, IconArrowUp, IconBank, IconCloud, IconDownload, IconFolder, IconPlus, IconTrash, IconUpload } from './Icons'

export function SettingsView() {
  const { allCategories, settings, allTransactions, activeAccount, account } = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')

  async function onImport(file: File) {
    try {
      const backup = parseBackup(await file.text())
      if (!confirm('Esto reemplazará los datos actuales con los del respaldo. ¿Continuar?')) return
      await db.transaction('rw', db.transactions, db.categories, db.settings, async () => {
        await db.transactions.clear()
        await db.categories.clear()
        await db.transactions.bulkPut(backup.transactions)
        await db.categories.bulkPut(backup.categories)
        if (backup.settings) await db.settings.put(backup.settings)
      })
      setStatus('✓ Respaldo restaurado correctamente.')
    } catch (e) {
      setStatus(`✕ ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sincronización (solo lectura) */}
      <Section title="Sincronización">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${isSyncConfigured() ? 'bg-teal-500/10 text-teal-600' : 'bg-slate-500/10 text-slate-400'}`}>
            <IconCloud width={18} height={18} />
          </span>
          <div className="text-sm">
            {isSyncConfigured() ? (
              <>
                <p className="font-medium text-navy-800 dark:text-white">Nube activa</p>
                <p className="text-slate-500 dark:text-silver-400">Los datos se sincronizan automáticamente entre la PC y el celular.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-navy-800 dark:text-white">Modo local</p>
                <p className="text-slate-500 dark:text-silver-400">Los datos se guardan en este dispositivo. Usa el respaldo para pasarlos a otro equipo.</p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* Empresa */}
      <EmpresaSettings settings={settings} />

      {/* Acceso / usuarios */}
      <AccesoSettings settings={settings} />

      {/* Secciones de la cuenta activa */}
      <Section title={`Secciones · ${account.name}`}>
        <p className="text-sm text-slate-500 dark:text-silver-400">
          Estás editando la cuenta <b>{account.name}</b>. Cambia de cuenta con el selector de arriba.
        </p>
        <SectionManager categories={allCategories} account={activeAccount} allowsIncome={account.allowsIncome} />
      </Section>

      {/* Importar desde Excel */}
      <Section title="Importar desde Excel">
        <ImportExcel />
      </Section>

      {/* Bancos / cooperativas */}
      <Section title="Bancos y cooperativas">
        <BankManager banks={settings.banks} />
      </Section>

      {/* Respaldo */}
      <Section title="Respaldo de datos">
        <p className="text-sm text-slate-500 dark:text-silver-400">Guarda una copia de todos los movimientos (de ambas cuentas), como copia de seguridad o para pasar datos entre equipos.</p>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => exportBackup(allTransactions, allCategories, settings)} className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600">
            <IconDownload width={16} height={16} /> Exportar respaldo
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-navy-600 dark:hover:bg-white/5">
            <IconUpload width={16} height={16} /> Restaurar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
        </div>
        {status && <p className="text-sm">{status}</p>}
      </Section>

      <p className="pb-2 text-center text-xs text-slate-400">GeoCiv Cuentas · funciona sin internet</p>
    </div>
  )
}

function SectionManager({ categories, account, allowsIncome }: { categories: Category[]; account: AccountId; allowsIncome: boolean }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#1ba3a3')
  const sections = sectionsOfAccount(categories, account)

  async function addSection() {
    if (!name.trim()) return
    await addCategory({ account, name: name.trim(), scope: allowsIncome ? 'both' : 'expense', color })
    setName('')
  }

  return (
    <div className="space-y-3">
      {sections.length === 0 && <p className="text-sm text-slate-400">Aún no hay secciones. Crea la primera abajo.</p>}

      <ul className="space-y-2.5">
        {sections.map((s) => (
          <SectionRow key={s.id} section={s} categories={categories} allowsIncome={allowsIncome} />
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t border-black/5 pt-3 dark:border-white/5">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Color" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSection()}
          placeholder={allowsIncome ? 'Nuevo proyecto / sección' : 'Nueva categoría de gasto'}
          className="field flex-1 !py-2"
        />
        <button onClick={addSection} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-500 text-white hover:bg-teal-600" aria-label="Agregar sección">
          <IconPlus width={18} height={18} />
        </button>
      </div>
    </div>
  )
}

function SectionRow({ section, categories, allowsIncome }: { section: Category; categories: Category[]; allowsIncome: boolean }) {
  const subs = subsectionsOf(categories, section.id)
  const [sub, setSub] = useState('')
  const [subScope, setSubScope] = useState<TxType>('expense')

  async function addSub() {
    if (!sub.trim()) return
    await addCategory({ account: section.account, name: sub.trim(), scope: allowsIncome ? subScope : 'expense', color: section.color, parentId: section.id })
    setSub('')
  }

  return (
    <li className="rounded-xl border border-black/5 p-3 dark:border-white/10">
      <div className="flex items-center gap-2">
        <input type="color" value={section.color} onChange={(e) => updateCategory(section.id, { color: e.target.value })} className="h-7 w-7 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Color" />
        <IconFolder width={16} height={16} style={{ color: section.color }} className="shrink-0" />
        <input defaultValue={section.name} onBlur={(e) => updateCategory(section.id, { name: e.target.value.trim() || section.name })} className="field flex-1 !py-1.5 font-medium" />
        <button
          onClick={() => {
            if (confirm(`¿Eliminar "${section.name}" y sus subsecciones?`)) deleteCategory(section.id)
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          aria-label="Eliminar sección"
        >
          <IconTrash width={15} height={15} />
        </button>
      </div>

      {/* Subsecciones */}
      <div className="mt-2 space-y-1.5 pl-5">
        {subs.map((ss) => (
          <div key={ss.id} className="flex items-center gap-2">
            <span className={ss.scope === 'income' ? 'text-emerald-500' : 'text-rose-400'}>
              {ss.scope === 'income' ? <IconArrowUp width={13} height={13} /> : <IconArrowDown width={13} height={13} />}
            </span>
            <input defaultValue={ss.name} onBlur={(e) => updateCategory(ss.id, { name: e.target.value.trim() || ss.name })} className="field flex-1 !py-1.5 text-sm" />
            <button onClick={() => deleteCategory(ss.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Eliminar subsección">
              <IconTrash width={14} height={14} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          {allowsIncome && (
            <button
              type="button"
              onClick={() => setSubScope((s) => (s === 'expense' ? 'income' : 'expense'))}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                subScope === 'income' ? 'border-emerald-500 text-emerald-500' : 'border-rose-400 text-rose-400'
              }`}
              title={subScope === 'income' ? 'Ingreso' : 'Egreso'}
            >
              {subScope === 'income' ? <IconArrowUp width={14} height={14} /> : <IconArrowDown width={14} height={14} />}
            </button>
          )}
          <input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="Agregar subsección" className="field flex-1 !py-1.5 text-sm" />
          <button onClick={addSub} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-navy-700 dark:text-silver-300" aria-label="Agregar subsección">
            <IconPlus width={15} height={15} />
          </button>
        </div>
      </div>
    </li>
  )
}

function BankManager({ banks }: { banks: string[] }) {
  const [name, setName] = useState('')

  return (
    <div className="space-y-2.5">
      <p className="text-sm text-slate-500 dark:text-silver-400">Sugerencias que aparecen al registrar una transferencia. Puedes añadir las que uses.</p>
      <ul className="space-y-1.5">
        {banks.map((b) => (
          <li key={b} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-navy-900">
            <IconBank width={15} height={15} className="shrink-0 text-teal-500" />
            <span className="flex-1">{b}</span>
            <button onClick={() => removeBank(b)} className="grid h-6 w-6 shrink-0 place-items-center rounded text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Eliminar banco">
              <IconTrash width={13} height={13} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-black/5 pt-3 dark:border-white/5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              void addBank(name)
              setName('')
            }
          }}
          placeholder="Nuevo banco o cooperativa"
          className="field flex-1 !py-2"
        />
        <button
          onClick={() => {
            if (name.trim()) {
              void addBank(name)
              setName('')
            }
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-500 text-white hover:bg-teal-600"
          aria-label="Agregar banco"
        >
          <IconPlus width={18} height={18} />
        </button>
      </div>
    </div>
  )
}

function SaveButton({ dirty, saved, onSave }: { dirty: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        onClick={onSave}
        disabled={!dirty}
        className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-40"
      >
        Guardar
      </button>
      {saved && !dirty && <span className="text-sm font-medium text-emerald-600">✓ Guardado</span>}
      {dirty && <span className="text-sm text-amber-500">Cambios sin guardar</span>}
    </div>
  )
}

function EmpresaSettings({ settings }: { settings: Settings }) {
  const [companyName, setCompanyName] = useState(settings.companyName)
  const [currency, setCurrency] = useState(settings.currency)
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol)
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(settings.weekStartsOn)
  const [saved, setSaved] = useState(false)

  const dirty =
    companyName !== settings.companyName ||
    currency !== settings.currency ||
    currencySymbol !== settings.currencySymbol ||
    weekStartsOn !== settings.weekStartsOn

  async function save() {
    await updateSettings({
      companyName: companyName.trim() || 'GeoCiv',
      currency: currency.trim().toUpperCase() || 'USD',
      currencySymbol: currencySymbol.trim() || '$',
      weekStartsOn,
    })
    setSaved(true)
  }

  return (
    <Section title="Empresa">
      <Field label="Nombre">
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="field" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código de moneda">
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className="field" />
        </Field>
        <Field label="Símbolo">
          <input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} placeholder="$" className="field" />
        </Field>
      </div>
      <Field label="La semana empieza en">
        <select value={String(weekStartsOn)} onChange={(e) => setWeekStartsOn(Number(e.target.value) as 0 | 1)} className="field">
          <option value="1">Lunes</option>
          <option value="0">Domingo</option>
        </select>
      </Field>
      <SaveButton dirty={dirty} saved={saved} onSave={save} />
    </Section>
  )
}

function AccesoSettings({ settings }: { settings: Settings }) {
  const [adminPin, setAdminPin] = useState(settings.adminPin)
  const [viewerPin, setViewerPin] = useState(settings.viewerPin)
  const [current, setCurrent] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const changed = adminPin !== settings.adminPin || viewerPin !== settings.viewerPin
  const valid = adminPin.trim().length >= 4 && viewerPin.trim().length >= 4
  const dirty = changed && valid && current.length > 0

  async function save() {
    if (!changed) return
    if (!valid) {
      setError('Las contraseñas deben tener al menos 4 caracteres.')
      return
    }
    if (current !== settings.adminPin) {
      setError('La contraseña actual del administrador no es correcta.')
      return
    }
    await updateSettings({ adminPin: adminPin.trim(), viewerPin: viewerPin.trim() })
    setCurrent('')
    setError('')
    setSaved(true)
  }

  return (
    <Section title="Acceso (usuarios)">
      <p className="text-sm text-slate-500 dark:text-silver-400">
        Contraseñas para ingresar. El <b>Administrador</b> edita todo; el usuario de <b>Solo reportes</b> solo consulta.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Contraseña Administrador">
          <input
            value={adminPin}
            onChange={(e) => {
              setAdminPin(e.target.value)
              setError('')
            }}
            className="field"
          />
        </Field>
        <Field label="Contraseña Solo reportes">
          <input
            value={viewerPin}
            onChange={(e) => {
              setViewerPin(e.target.value)
              setError('')
            }}
            className="field"
          />
        </Field>
      </div>

      {changed && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <Field label="Confirma con la contraseña actual del Administrador">
            <input
              type="password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value)
                setError('')
              }}
              placeholder="Contraseña actual"
              className="field"
              autoComplete="current-password"
            />
          </Field>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-silver-400">
            Por seguridad, para cambiar las contraseñas debes reescribir la del Administrador.
          </p>
        </div>
      )}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10">{error}</p>}

      <SaveButton dirty={dirty} saved={saved} onSave={save} />
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold text-navy-800 dark:text-white">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}
