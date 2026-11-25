import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// data.json (floor plans + walkable grid) is ~700 kB on its own, hence the higher limit.
export default defineConfig({ plugins: [react()], build: { chunkSizeWarningLimit: 1200 } })
