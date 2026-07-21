import { useEffect, useState } from 'react'
import { AppDataProvider, useAppData } from './state/AppData'
import { Dashboard } from './components/Dashboard'
import { TransactionsView } from './components/TransactionsView'
import { ReportsView } from './components/ReportsView'
import { SettingsView } from './components/SettingsView'
import { AddTransactionSheet } from './components/AddTransactionSheet'
import { Landing } from './components/Landing'
import { GlobalReports } from './components/GlobalReports'
import { Login } from './components/Login'
import { Logo } from './components/Logo'
import { IconChart, IconChevronDown, IconHome, IconList, IconPlus, IconSettings } from './components/Icons'
import { onSyncStatus, startAutoSync, type SyncStatus } from './lib/sync'
import type { AccountId, Role } from './db/types'

type Tab = 'inicio' | 'movimientos' | 'reportes' | 'ajustes'

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'inicio', label: 'Inicio', Icon: IconHome },
  { id: 'movimientos', label: 'Movimientos', Icon: IconList },
  { id: 'reportes', label: 'Reportes', Icon: IconChart },
  { id: 'ajustes', label: 'Ajustes', Icon: IconSettings },
]

const TITLES: Record<Tab, string> = {
  inicio: 'Resumen',
  movimientos: 'Movimientos',
  reportes: 'Reportes',
  ajustes: 'Ajustes',
}

function SyncDot({ status }: { status: SyncStatus }) {
  if (status.state === 'off') return null
  const map: Record<string, { c: string; t: string }> = {
    idle: { c: 'bg-emerald-400', t: 'Sincronizado' },
    syncing: { c: 'bg-teal-300 animate-pulse', t: 'Sincronizando…' },
    error: { c: 'bg-amber-400', t: 'Sin conexión' },
  }
  const s = map[status.state] ?? map.idle
  return (
    <span className="flex items-center gap-1.5 text-xs text-silver-400" title={status.message ?? s.t}>
      <span className={`h-2 w-2 rounded-full ${s.c}`} />
    </span>
  )
}

/** Fondo de marca: llena el espacio (sobre todo los lados en escritorio) con el logo. */
function BrandBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-navy-950">
      <img
        src="./logo.png"
        alt=""
        className="absolute left-1/2 top-1/2 h-[min(92vh,92vw)] w-[min(92vh,92vw)] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.13]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-transparent to-navy-950/70" />
    </div>
  )
}

interface ShellProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
  onExit: () => void
  onOpenProject: (id: string) => void
  reportProject: string
  setReportProject: (id: string) => void
}

function Shell({ tab, onTabChange, onExit, onOpenProject, reportProject, setReportProject }: ShellProps) {
  const { categories, account, ready } = useAppData()
  const [adding, setAdding] = useState(false)
  const [sync, setSync] = useState<SyncStatus>({ state: 'off' })

  useEffect(() => {
    onSyncStatus(setSync)
    return startAutoSync()
  }, [])

  // Al cambiar de sección (incluye el botón atrás), cierra el formulario si estaba abierto
  useEffect(() => {
    setAdding(false)
  }, [tab])

  if (!ready) return null

  return (
    <div className="relative z-10 mx-auto flex h-[100dvh] max-w-2xl flex-col overflow-hidden bg-navy-950/80 shadow-2xl ring-1 ring-white/5 backdrop-blur-sm">
      {/* Encabezado */}
      <header className="safe-top shrink-0 border-b border-white/5 bg-navy-900/95 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight text-white">{account.name}</p>
              <p className="text-xs text-silver-400">{TITLES[tab]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SyncDot status={sync} />
            <button
              onClick={onExit}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-silver-300 transition hover:bg-white/15"
            >
              Cambiar
              <IconChevronDown width={14} height={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-5 pb-6">
        {tab === 'inicio' && <Dashboard onAdd={() => setAdding(true)} onOpenProject={onOpenProject} />}
        {tab === 'movimientos' && <TransactionsView />}
        {tab === 'reportes' && <ReportsView projectId={reportProject} onProjectChange={setReportProject} />}
        {tab === 'ajustes' && <SettingsView />}
      </main>

      {/* Botón flotante para agregar */}
      {tab !== 'ajustes' && (
        <button
          onClick={() => setAdding(true)}
          className="absolute bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/30 ring-1 ring-teal-400/40 transition hover:bg-teal-600 active:scale-95"
          aria-label="Agregar movimiento"
        >
          <IconPlus width={26} height={26} strokeWidth={2.2} />
        </button>
      )}

      {/* Navegación inferior */}
      <nav className="safe-bottom shrink-0 flex border-t border-white/10 bg-navy-900/95">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active ? 'text-teal-400' : 'text-silver-400'
              }`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-400" />}
              <Icon width={22} height={22} strokeWidth={active ? 2.1 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>

      {adding && <AddTransactionSheet categories={categories} onClose={() => setAdding(false)} />}
    </div>
  )
}

// ===== Navegación por pila, integrada con el botón "atrás" del sistema =====

type Screen = { t: 'landing' } | { t: 'account'; tab: Tab } | { t: 'reports' }

function baseStack(role: Role): Screen[] {
  return role === 'viewer' ? [{ t: 'reports' }] : [{ t: 'landing' }]
}

function Root() {
  const { ready, setActiveAccount } = useAppData()
  const [role, setRole] = useState<Role | null>(() => (sessionStorage.getItem('geociv-role') as Role | null) ?? null)
  const [stack, setStack] = useState<Screen[]>([{ t: 'landing' }])
  const [reportProject, setReportProject] = useState('')

  const current = stack[stack.length - 1]

  function login(r: Role) {
    sessionStorage.setItem('geociv-role', r)
    setRole(r)
    setStack(baseStack(r))
  }
  function logout() {
    sessionStorage.removeItem('geociv-role')
    setRole(null)
    setStack([{ t: 'landing' }])
  }
  const push = (s: Screen) => setStack((prev) => [...prev, s])
  const resetToBase = () => setStack(baseStack(role ?? 'admin'))
  const back = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))

  // Botón atrás del sistema: navega hacia atrás DENTRO de la app y nunca la cierra.
  useEffect(() => {
    if (!role) return
    window.history.pushState({ geociv: true }, '')
    const onPop = () => {
      back()
      window.history.pushState({ geociv: true }, '') // re-arma para atrapar el siguiente "atrás"
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [role])

  if (!ready) {
    return (
      <div className="relative min-h-screen">
        <BrandBackground />
        <div className="relative z-10 grid min-h-screen place-items-center gap-3 text-silver-400">
          <Logo className="h-14 w-14" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <BrandBackground />
      {!role ? (
        <Login onLogin={login} />
      ) : current.t === 'reports' ? (
        <GlobalReports
          onExit={role === 'viewer' ? logout : resetToBase}
          exitLabel={role === 'viewer' ? 'Salir' : 'Cambiar'}
        />
      ) : current.t === 'account' ? (
        <Shell
          tab={current.tab}
          onTabChange={(t) => push({ t: 'account', tab: t })}
          onExit={resetToBase}
          onOpenProject={(id) => {
            setReportProject(id)
            push({ t: 'account', tab: 'reportes' })
          }}
          reportProject={reportProject}
          setReportProject={setReportProject}
        />
      ) : (
        <Landing
          onPickAccount={(id: AccountId) => {
            setActiveAccount(id)
            push({ t: 'account', tab: 'inicio' })
          }}
          onOpenReports={() => push({ t: 'reports' })}
          onLogout={logout}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <Root />
    </AppDataProvider>
  )
}
