import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANTE: usa el nombre EXACTO del repositorio, con mayúsculas/minúsculas tal cual
export default defineConfig({
  base: '/Calculadora-Modelos-de-Markov-y-Teoria-de-Colas/',
  plugins: [react()],
})
