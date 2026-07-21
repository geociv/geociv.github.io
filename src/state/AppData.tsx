import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, ensureSeed } from '../db/database'
import { liveCategories, liveTransactions } from '../db/repo'
import { accountById, DEFAULT_ADMIN_PIN, DEFAULT_BANKS, DEFAULT_VIEWER_PIN, type AccountDef, type Category, type Settings, type Transaction } from '../db/types'

const ACTIVE_KEY = 'geociv-active-account'

interface AppDataValue {
  /** Todas las transacciones (todas las cuentas). */
  allTransactions: Transaction[]
  allCategories: Category[]
  /** Filtradas por la cuenta activa. */
  transactions: Transaction[]
  categories: Category[]
  settings: Settings
  activeAccount: string
  account: AccountDef
  setActiveAccount: (id: string) => void
  ready: boolean
}

const AppDataContext = createContext<AppDataValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void ensureSeed()
  }, [])

  const [activeAccount, setActive] = useState<string>(
    () => localStorage.getItem(ACTIVE_KEY) ?? 'oficina',
  )

  const setActiveAccount = (id: string) => {
    localStorage.setItem(ACTIVE_KEY, id)
    setActive(id)
  }

  const allTransactions = useLiveQuery(liveTransactions, [], undefined)
  const allCategories = useLiveQuery(liveCategories, [], undefined)
  const settings = useLiveQuery(() => db.settings.get('app'), [], undefined)

  const ready =
    allTransactions !== undefined && allCategories !== undefined && settings !== undefined

  const txs = allTransactions ?? []
  const cats = allCategories ?? []

  const transactions = useMemo(() => txs.filter((t) => t.account === activeAccount), [txs, activeAccount])
  const categories = useMemo(() => cats.filter((c) => c.account === activeAccount), [cats, activeAccount])

  const value: AppDataValue = {
    allTransactions: txs,
    allCategories: cats,
    transactions,
    categories,
    settings: settings
      ? {
          ...settings,
          banks: settings.banks ?? DEFAULT_BANKS,
          adminPin: settings.adminPin ?? DEFAULT_ADMIN_PIN,
          viewerPin: settings.viewerPin ?? DEFAULT_VIEWER_PIN,
        }
      : DEFAULT_SETTINGS,
    activeAccount,
    account: accountById(activeAccount),
    setActiveAccount,
    ready,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de <AppDataProvider>')
  return ctx
}
