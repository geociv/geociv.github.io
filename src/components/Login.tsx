import { useState } from 'react'
import { useAppData } from '../state/AppData'
import type { Role } from '../db/types'
import { Logo } from './Logo'
import { IconChart, IconSettings } from './Icons'

export function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const { settings } = useAppData()
  const [role, setRole] = useState<Role>('admin')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const expected = role === 'admin' ? settings.adminPin : settings.viewerPin
    if (pin === expected) {
      onLogin(role)
    } else {
      setError('Clave incorrecta.')
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="mb-4 h-24 w-24 shadow-xl ring-1 ring-white/10" />
        <h1 className="text-2xl font-bold text-white">GeoCiv Cuentas</h1>
        <p className="mt-1 text-sm text-silver-400">Ingresa para continuar</p>
      </div>

      <form onSubmit={submit} className="card w-full space-y-4 p-6">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-navy-900">
          <button
            type="button"
            onClick={() => {
              setRole('admin')
              setError('')
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
              role === 'admin' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 dark:text-silver-400'
            }`}
          >
            <IconSettings width={16} height={16} /> Administrador
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('viewer')
              setError('')
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
              role === 'viewer' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 dark:text-silver-400'
            }`}
          >
            <IconChart width={16} height={16} /> Solo reportes
          </button>
        </div>

        <p className="text-xs text-slate-400">
          {role === 'admin'
            ? 'Acceso completo: registrar, editar y configurar.'
            : 'Acceso de solo lectura a los reportes.'}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError('')
            }}
            placeholder="Ingresa tu contraseña"
            className="field"
          />
        </label>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10">{error}</p>}

        <button type="submit" className="w-full rounded-xl bg-teal-500 py-3.5 font-semibold text-white shadow-md shadow-teal-500/20 transition hover:bg-teal-600 active:scale-[0.99]">
          Ingresar
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">GeoCiv · Control de ingresos y egresos</p>
    </div>
  )
}
