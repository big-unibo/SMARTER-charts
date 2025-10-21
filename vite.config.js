import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'smarter-charts',
      fileName: (format) => `smarter-charts.${format}.js`
    }
  },
  rollupOptions: {
    external: ['vue'], // Exclude vue from the bundle
    output: {
      globals: {
        vue: 'Vue'
      }
    }
  }
})