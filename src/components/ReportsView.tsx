import { useMemo } from 'react'
import { useAppData } from '../state/AppData'
import { rootSectionId, sectionsOfAccount } from '../lib/categories'
import { ReportPanel } from './ReportPanel'

interface Props {
  /** Proyecto seleccionado (solo aplica en la cuenta Proyectos). '' = todos. */
  projectId: string
  onProjectChange: (id: string) => void
}

export function ReportsView({ projectId, onProjectChange }: Props) {
  const { transactions, categories, pendings, settings, account, activeAccount } = useAppData()

  const projects = useMemo(
    () => (activeAccount === 'proyectos' ? sectionsOfAccount(categories, activeAccount) : []),
    [categories, activeAccount],
  )

  const filtered = useMemo(() => {
    if (!projectId) return transactions
    return transactions.filter((t) => rootSectionId(categories, t.categoryId) === projectId)
  }, [transactions, categories, projectId])

  // Al filtrar por proyecto, solo los pendientes de ese proyecto
  const filteredPendings = useMemo(() => {
    if (!projectId) return pendings
    return pendings.filter((p) => p.categoryId && rootSectionId(categories, p.categoryId) === projectId)
  }, [pendings, categories, projectId])

  const projectName = projects.find((p) => p.id === projectId)?.name
  const scopeLabel = account.name + (projectName ? ` · ${projectName}` : '')

  return (
    <div className="space-y-4">
      {projects.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Reporte de</span>
          <select value={projectId} onChange={(e) => onProjectChange(e.target.value)} className="field">
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <ReportPanel
        transactions={filtered}
        categories={categories}
        settings={settings}
        scopeLabel={scopeLabel}
        pendings={filteredPendings}
      />
    </div>
  )
}
