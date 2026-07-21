import { useState } from 'react'

/**
 * Muestra el logo real de GeoCiv desde /logo.png.
 * Si el archivo no existe todavía, cae al emblema de marca /icon.svg.
 */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? './icon.svg' : './logo.png'
  return (
    <img
      src={src}
      alt="GeoCiv"
      onError={() => setFailed(true)}
      className={`${className} rounded-lg object-contain`}
    />
  )
}
