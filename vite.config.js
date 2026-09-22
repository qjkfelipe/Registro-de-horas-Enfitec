import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// A base do site vem de VITE_BASE (definido no .env.production, para deploy em
// subdiretório). Em dev fica '/', então nada muda no localhost. Ler do .env evita
// a conversão de caminho do Git Bash que mangleia "VITE_BASE=/x/y" inline no Windows.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
    },
  }
})
