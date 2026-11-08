import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  '/api': { target: 'http://localhost:3000', changeOrigin: true },
  '/health': { target: 'http://localhost:3000', changeOrigin: true },
  '/ready': { target: 'http://localhost:3000', changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: apiProxy,
  },
  // `vite preview` does not inherit the development server proxy. Keep the
  // built-site workflow functional for public links and authenticated API calls.
  preview: { proxy: apiProxy },
});
