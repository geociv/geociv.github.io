import { ACCOUNTS, type AccountId } from '../db/types'
import { Logo } from './Logo'
import { IconChart, IconChevronRight, IconFolder, IconWallet } from './Icons'

interface Props {
  onPickAccount: (id: AccountId) => void
  onOpenReports: () => void
  onLogout: () => void
}

export function Landing({ onPickAccount, onOpenReports, onLogout }: Props) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="mb-4 h-24 w-24 shadow-xl ring-1 ring-white/10" />
        <h1 className="text-2xl font-bold text-white">GeoCiv Cuentas</h1>
        <p className="mt-1 text-sm text-silver-400">Selecciona una cuenta para continuar</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {ACCOUNTS.map((a) => (
          <button
            key={a.id}
            onClick={() => onPickAccount(a.id)}
            className="group card flex items-center gap-4 p-6 text-left transition hover:-translate-y-0.5 hover:ring-2 hover:ring-teal-500/60 sm:flex-col sm:items-start sm:gap-5 sm:p-7"
          >
            <span
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg ${
                a.id === 'oficina'
                  ? 'bg-gradient-to-br from-copper-500 to-copper-600 shadow-copper-500/30'
                  : 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-teal-500/30'
              }`}
            >
              {a.id === 'oficina' ? <IconWallet width={26} height={26} /> : <IconFolder width={26} height={26} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h2 className="text-lg font-bold text-navy-800 dark:text-white">{a.name}</h2>
                <IconChevronRight width={18} height={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-500" />
              </div>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-silver-400">{a.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Reportes generales */}
      <button
        onClick={onOpenReports}
        className="group card mt-4 flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:ring-2 hover:ring-teal-500/60"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-navy-700 to-navy-800 text-teal-300 shadow-lg ring-1 ring-white/10">
          <IconChart width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h2 className="text-base font-bold text-navy-800 dark:text-white">Reportes generales</h2>
            <IconChevronRight width={18} height={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-500" />
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-silver-400">General de la empresa, por oficina o por proyecto · anual</p>
        </div>
      </button>

      <button onClick={onLogout} className="mt-8 text-xs font-medium text-silver-400 underline-offset-2 hover:text-white hover:underline">
        Cerrar sesión
      </button>
      <p className="mt-4 text-xs text-slate-500">GeoCiv · Control de ingresos y egresos</p>
    </div>
  )
}
