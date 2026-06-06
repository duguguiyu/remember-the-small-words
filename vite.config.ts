import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { existsSync, renameSync } from 'fs'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'rename-index-html',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        const src = resolve(distDir, 'index.html')
        const dest = resolve(distDir, 'remember_words.html')
        if (existsSync(src)) {
          renameSync(src, dest)
        }
      },
    },
  ],
  base: './',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: ['.'],
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'remember_words/[name]-[hash].js',
        chunkFileNames: 'remember_words/[name]-[hash].js',
        assetFileNames: 'remember_words/[name]-[hash].[ext]',
      },
    },
  },
})
