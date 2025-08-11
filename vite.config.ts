import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { overlay: false },
    proxy: {
      // Proxy LM Studio to avoid CORS in browser dev
      '/lm': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/lm/, ''),
      },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/lm': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/lm/, ''),
      },
    },
  },
})
