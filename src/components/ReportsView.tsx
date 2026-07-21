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
  const { transactions, categories, settings, account, activeAccount } = useAppData()

  const projects = useMemo(
    () => (account.allowsIncome ? sectionsOfAccount(categories, activeAccount) : []),
    [categories, activeAccount, account.allowsIncome],
  )

  const filtered = useMemo(() => {
    if (!projectId) return transactions
    return transactions.filter((t) => rootSectionId(categories, t.categoryId) === projectId)
  }, [transactions, categories, projectId])

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

      <ReportPanel transactions={filtered} categories={categories} settings={settings} scopeLabel={scopeLabel} />
    </div>
  )
}
