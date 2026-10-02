import type { AccountId, Fund, FundKind } from '../db/types'

/**
 * Id fijo por cuenta y lugar. Si fuera aleatorio, la PC y el celular crearían
 * cada uno su propia fila de "Efectivo" y se verían dos.
 */
export function fundId(account: AccountId, kind: FundKind, name: string): string {
  return kind === 'efectivo' ? `${account}:efectivo` : `${account}:banco:${name.trim().toLowerCase()}`
}

export interface FundPlace {
  id: string
  kind: FundKind
  name: string
  /** Valor guardado; vacío si nunca se escribió. */
  fund?: Fund
}

/**
 * Lugares donde hay dinero: Efectivo, los bancos de Ajustes y los que ya tengan
 * valor aunque no estén en Ajustes (los bancos se guardan por equipo, así que
 * un valor puede llegar del otro dispositivo con un banco que aquí no existe).
 */
export function fundPlaces(account: AccountId, banks: string[], funds: Fund[]): FundPlace[] {
  const byId = new Map(funds.map((f) => [f.id, f]))
  const place = (kind: FundKind, name: string): FundPlace => {
    const id = fundId(account, kind, name)
    return { id, kind, name, fund: byId.get(id) }
  }
  const places = [place('efectivo', 'Efectivo'), ...banks.map((b) => place('banco', b))]
  const seen = new Set(places.map((p) => p.id))
  for (const f of funds) {
    if (!seen.has(f.id)) places.push({ id: f.id, kind: f.kind, name: f.name, fund: f })
  }
  return places
}
