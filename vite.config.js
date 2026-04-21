import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  root: path.resolve(__dirname, 'src/develop'),

  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.endsWith('-smarter')
        }
      }
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'smarter-charts',
      fileName: (format) => `smarter-charts.${format}.js`
    },
    rollupOptions: {
      output: {
        globals: {
          vue: 'Vue',
          bootstrap: 'bootstrap'
        }
      }
    }
  },
})