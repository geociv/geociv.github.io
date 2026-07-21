import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Ruta base: relativa por defecto (local/túnel); en GitHub Pages se pasa
  // VITE_BASE=/geociv-cuentas/ para que funcione bajo ese subpath.
  base: process.env.VITE_BASE || './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'GeoCiv Cuentas',
        short_name: 'GeoCiv',
        description: 'Control de ingresos y egresos con reportes diarios, semanales y mensuales.',
        theme_color: '#0a1c2b',
        background_color: '#06121d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  server: {
    host: true, // expone en la red local (para probar en el celular por WiFi)
  },
})
