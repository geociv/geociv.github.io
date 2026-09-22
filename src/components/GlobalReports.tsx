import { useMemo, useState } from 'react'
import { useAppData } from '../state/AppData'
import { rootSectionId, sectionsOfAccount } from '../lib/categories'
import { Logo } from './Logo'
import { ReportPanel } from './ReportPanel'
import { IconChevronDown } from './Icons'

export function GlobalReports({ onExit, exitLabel = 'Cambiar' }: { onExit: () => void; exitLabel?: string }) {
  const { allTransactions, allCategories, allPendings, settings } = useAppData()
  const [scope, setScope] = useState('general')

  const projects = useMemo(() => sectionsOfAccount(allCategories, 'proyectos'), [allCategories])

  const { filtered, filteredPendings, scopeLabel } = useMemo(() => {
    if (scope === 'general')
      return { filtered: allTransactions, filteredPendings: allPendings, scopeLabel: 'General – Empresa' }
    if (scope === 'oficina')
      return {
        filtered: allTransactions.filter((t) => t.account === 'oficina'),
        filteredPendings: allPendings.filter((p) => p.account === 'oficina'),
        scopeLabel: 'Oficina',
      }
    if (scope === 'proyectos')
      return {
        filtered: allTransactions.filter((t) => t.account === 'proyectos'),
        filteredPendings: allPendings.filter((p) => p.account === 'proyectos'),
        scopeLabel: 'Proyectos (todos)',
      }
    // un proyecto específico
    const name = projects.find((p) => p.id === scope)?.name ?? 'Proyecto'
    return {
      filtered: allTransactions.filter((t) => t.account === 'proyectos' && rootSectionId(allCategories, t.categoryId) === scope),
      filteredPendings: allPendings.filter(
        (p) => p.account === 'proyectos' && p.categoryId && rootSectionId(allCategories, p.categoryId) === scope,
      ),
      scopeLabel: name,
    }
  }, [scope, allTransactions, allCategories, allPendings, projects])

  return (
    <div className="relative z-10 mx-auto flex h-[100dvh] max-w-2xl flex-col overflow-hidden bg-navy-950/80 shadow-2xl ring-1 ring-white/5 backdrop-blur-sm">
      <header className="safe-top shrink-0 border-b border-white/5 bg-navy-900/95 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight text-white">Reportes generales</p>
              <p className="text-xs text-silver-400">Toda la empresa</p>
            </div>
          </div>
          <button onClick={onExit} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-silver-300 transition hover:bg-white/15">
            {exitLabel}
            <IconChevronDown width={14} height={14} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Alcance del reporte</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="field">
            <option value="general">🏢 General – Toda la empresa</option>
            <option value="oficina">Oficina</option>
            <option value="proyectos">Proyectos (todos)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                — {p.name}
              </option>
            ))}
          </select>
        </label>

        <ReportPanel
          transactions={filtered}
          categories={allCategories}
          settings={settings}
          scopeLabel={scopeLabel}
          pendings={filteredPendings}
        />
      </main>
    </div>
  )
}
