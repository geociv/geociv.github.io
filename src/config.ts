/**
 * Configuración de la app. La sincronización con Supabase viene HORNEADA:
 * el cliente NO la configura. Los valores se toman de variables de entorno
 * al compilar (.env), con estos nombres:
 *
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 *   VITE_SYNC_WORKSPACE=geociv   (opcional, por defecto "geociv")
 *
 * Ver .env.example. Si no se definen, la app corre 100% local sin sync.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
export const SYNC_WORKSPACE = (import.meta.env.VITE_SYNC_WORKSPACE ?? 'geociv').trim()

export const SYNC_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
