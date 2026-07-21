/** Colores de marca GeoCiv usados en PDF y Excel. */
export const BRAND = {
  navy: '#0A1C2B',
  navyRGB: [10, 28, 43] as [number, number, number],
  teal: '#1BA3A3',
  tealRGB: [27, 163, 163] as [number, number, number],
  copper: '#C07F3C',
  green: '#16A34A',
  greenRGB: [22, 163, 74] as [number, number, number],
  rose: '#E11D48',
  roseRGB: [225, 29, 72] as [number, number, number],
  grayRGB: [100, 116, 139] as [number, number, number],
}

/** ARGB sin '#', como lo pide ExcelJS. */
export const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase()

let logoCache: string | null | undefined

/** Carga ./logo.png como dataURL (para incrustarlo en PDF/Excel). Cachea el resultado. */
export async function loadLogoDataUrl(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache
  try {
    const res = await fetch('./logo.png')
    if (!res.ok) throw new Error('no logo')
    const blob = await res.blob()
    logoCache = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('read error'))
      fr.readAsDataURL(blob)
    })
  } catch {
    logoCache = null
  }
  return logoCache
}
