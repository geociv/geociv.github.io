import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { Table } from 'dexie'
import { db } from '../db/database'
import { SUPABASE_ANON_KEY, SUPABASE_URL, SYNC_CONFIGURED, SYNC_WORKSPACE } from '../config'
import type { Advance, Category, Pending, Transaction } from '../db/types'

/**
 * Sincronización con Supabase. Viene HORNEADA (ver config.ts) — el cliente no
 * la configura. Estrategia: last-write-wins por `updatedAt`.
 * - Sondeo (push + pull) al abrir, tras cambios, al volver online y cada 45s.
 * - Realtime (websocket): aplica al instante los cambios que llegan de otros
 *   dispositivos, sin esperar al sondeo. Si no está configurada, la app es local.
 */

const WATERMARK_KEY = 'geociv-sync-watermark'

export type SyncState = 'off' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  state: SyncState
  lastSync?: string
  message?: string
}

let client: SupabaseClient | null = null
function getClient(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

export function isSyncConfigured(): boolean {
  return SYNC_CONFIGURED
}

interface RemoteRow {
  updatedAt: number
  [key: string]: unknown
}

export interface SyncResult {
  pushed: number
  pulled: number
  at: string
}

let inFlight: Promise<SyncResult> | null = null

export async function syncNow(): Promise<SyncResult> {
  if (!SYNC_CONFIGURED) throw new Error('Sincronización no configurada.')
  // Evita solapar dos sincronizaciones
  if (inFlight) return inFlight
  inFlight = doSync().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function doSync(): Promise<SyncResult> {
  const sb = getClient()
  // Marca SOLO para el push: como usa el reloj local (consistente consigo mismo),
  // sirve para no reenviar todo. El PULL NO usa marca (traía de menos por relojes
  // desincronizados entre equipos) — trae todo y fusiona por "el más nuevo gana".
  const pushWatermark = Number(localStorage.getItem(WATERMARK_KEY) ?? 0)
  const ws = SYNC_WORKSPACE
  let pushed = 0
  let pulled = 0

  // PUSH: lo que cambió localmente desde la última marca (reloj local)
  const localTx = await db.transactions.where('updatedAt').above(pushWatermark).toArray()
  const localCat = await db.categories.where('updatedAt').above(pushWatermark).toArray()

  if (localCat.length) {
    const { error } = await sb.from('categories').upsert(localCat.map((c) => ({ ...c, workspace: ws })))
    if (error) throw new Error(`Enviar categorías: ${error.message}`)
    pushed += localCat.length
  }
  if (localTx.length) {
    const { error } = await sb.from('transactions').upsert(localTx.map((t) => ({ ...t, workspace: ws })))
    if (error) throw new Error(`Enviar movimientos: ${error.message}`)
    pushed += localTx.length
  }

  // PULL: TODO lo del workspace (sin filtro de reloj). El merge aplica solo lo
  // más nuevo, así que es idempotente y barato para el tamaño de estos datos.
  const { data: remoteCat, error: e2 } = await sb.from('categories').select('*').eq('workspace', ws)
  if (e2) throw new Error(`Traer categorías: ${e2.message}`)

  const { data: remoteTx, error: e1 } = await sb.from('transactions').select('*').eq('workspace', ws)
  if (e1) throw new Error(`Traer movimientos: ${e1.message}`)

  pulled += await mergeRemote<Category>(remoteCat as RemoteRow[], db.categories)
  pulled += await mergeRemote<Transaction>(remoteTx as RemoteRow[], db.transactions)

  // ADELANTOS y SALDOS PENDIENTES: tolerantes a fallos (la tabla en Supabase
  // puede no existir aún). Si fallan, no rompen la sincronización principal.
  const advResult = await syncOptionalTable<Advance>(sb, ws, 'advances', db.advances, pushWatermark)
  const pendResult = await syncOptionalTable<Pending>(sb, ws, 'pendings', db.pendings, pushWatermark)
  pushed += advResult.pushed + pendResult.pushed
  pulled += advResult.pulled + pendResult.pulled

  const now = Date.now()
  localStorage.setItem(WATERMARK_KEY, String(now))
  return { pushed, pulled, at: new Date(now).toISOString() }
}

interface SyncTable<T> {
  get: (id: string) => Promise<T | undefined>
  put: (v: T) => Promise<unknown>
}

/** Aplica una fila remota solo si es más nueva que la local (last-write-wins). */
async function applyRemoteRow<T extends { id: string; updatedAt: number }>(
  table: SyncTable<T>,
  row: RemoteRow,
): Promise<boolean> {
  const rest: Record<string, unknown> = { ...row }
  delete rest.workspace
  const incoming = rest as unknown as T
  if (!incoming.id) return false
  const local = await table.get(incoming.id)
  if (!local || incoming.updatedAt > local.updatedAt) {
    await table.put(incoming)
    return true
  }
  return false
}

async function mergeRemote<T extends { id: string; updatedAt: number }>(
  rows: RemoteRow[] | null,
  table: SyncTable<T>,
): Promise<number> {
  if (!rows?.length) return 0
  let n = 0
  for (const row of rows) {
    if (await applyRemoteRow(table, row)) n++
  }
  return n
}

/**
 * Sincroniza una tabla "opcional" (adelantos, saldos pendientes). Si su SQL aún
 * no se corrió en Supabase, se omite con un aviso en consola en vez de tumbar
 * la sincronización de movimientos y secciones.
 */
async function syncOptionalTable<T extends { id: string; updatedAt: number }>(
  sb: SupabaseClient,
  ws: string,
  name: string,
  table: Table<T, string>,
  pushWatermark: number,
): Promise<{ pushed: number; pulled: number }> {
  try {
    let pushed = 0
    const local = await table.where('updatedAt').above(pushWatermark).toArray()
    if (local.length) {
      const { error } = await sb.from(name).upsert(local.map((r) => ({ ...r, workspace: ws })))
      if (error) throw new Error(error.message)
      pushed = local.length
    }
    const { data, error } = await sb.from(name).select('*').eq('workspace', ws)
    if (error) throw new Error(error.message)
    return { pushed, pulled: await mergeRemote<T>(data as RemoteRow[], table) }
  } catch (e) {
    console.warn(`Sync "${name}" omitido:`, (e as Error).message)
    return { pushed: 0, pulled: 0 }
  }
}

// ===== Orquestación automática =====

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let notify: (s: SyncStatus) => void = () => {}
let lastSync: string | undefined

export function onSyncStatus(cb: (s: SyncStatus) => void): void {
  notify = cb
  cb({ state: SYNC_CONFIGURED ? 'idle' : 'off', lastSync })
}

async function runSync(): Promise<void> {
  if (!SYNC_CONFIGURED || !navigator.onLine) return
  notify({ state: 'syncing', lastSync })
  try {
    const r = await syncNow()
    lastSync = r.at
    notify({ state: 'idle', lastSync })
  } catch (e) {
    notify({ state: 'error', lastSync, message: (e as Error).message })
  }
}

/** Pide una sincronización tras un cambio local (agrupa ráfagas ~1.2s). */
export function requestSync(): void {
  if (!SYNC_CONFIGURED) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void runSync(), 1200)
}

// ===== Realtime (websocket): cambios de otros dispositivos, al instante =====

let channel: RealtimeChannel | null = null

/**
 * Se suscribe a los cambios remotos (INSERT/UPDATE) de nuestro workspace y los
 * aplica localmente en cuanto llegan. El borrado es lógico (deleted=true), así
 * que viaja como UPDATE con la fila completa: se puede aplicar directo.
 */
function startRealtime(): () => void {
  const sb = getClient()
  const ws = SYNC_WORKSPACE
  const filter = `workspace=eq.${ws}`

  const apply = async <T extends { id: string; updatedAt: number }>(table: SyncTable<T>, row: unknown) => {
    const r = row as RemoteRow | undefined
    if (!r || r.workspace !== ws) return
    const changed = await applyRemoteRow(table, r)
    if (changed) {
      lastSync = new Date().toISOString()
      notify({ state: 'idle', lastSync })
    }
  }

  channel = sb
    .channel(`geociv-sync-${ws}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter }, (p) =>
      apply(db.categories, p.new),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter }, (p) =>
      apply(db.transactions, p.new),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'advances', filter }, (p) =>
      apply(db.advances, p.new),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pendings', filter }, (p) =>
      apply(db.pendings, p.new),
    )
    .subscribe()

  return () => {
    if (channel) {
      void sb.removeChannel(channel)
      channel = null
    }
  }
}

/** Arranca la sincronización automática (sondeo + realtime). Devuelve limpieza. */
export function startAutoSync(): () => void {
  if (!SYNC_CONFIGURED) return () => {}
  void runSync()
  const stopRealtime = startRealtime()
  // Sondeo de respaldo por si el websocket se cae (cada 20s)
  const interval = setInterval(() => void runSync(), 20_000)
  const onOnline = () => void runSync()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void runSync()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(interval)
    stopRealtime()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
