import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildTime = new Date().toLocaleString('zh-CN', {
  timeZone: 'Atlantic/Canary',
  hour12: false,
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// GitHub Pages 地址是 https://weijzzz.github.io/xunlian/
export default defineConfig({
  base: '/xunlian/',
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // 有新版本时让用户点「更新」，训练中不会被自动刷新打断
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '训练记录',
        short_name: '训练',
        description: '徒手训练记录（个人自用）',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
