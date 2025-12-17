import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Firebase into its own chunk (loaded dynamically)
          firebase: ['firebase/app', 'firebase/firestore'],
          // Split Recharts into its own chunk
          recharts: ['recharts']
        }
      }
    }
  }
})
