import { fileURLToPath, URL } from 'node:url'

import { appConfig } from './src/config/app'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBase = env.APP_BASE || '/'
  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: appConfig.name,
          short_name: appConfig.name,
          description: appConfig.description,
          lang: 'zh-TW',
          start_url: appBase,
          scope: appBase,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#a66a3f',
          background_color: '#fffdf8',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
      }),
    ],
    base: appBase,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
