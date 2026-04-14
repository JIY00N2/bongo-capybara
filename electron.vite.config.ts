import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['ws'] })],
    build: {
      rollupOptions: {
        external: ['bufferutil', 'utf-8-validate']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    publicDir: resolve(__dirname, 'assets')  // assets/ 폴더를 /body/, /hands/, /mouth/ 로 서빙
  }
})