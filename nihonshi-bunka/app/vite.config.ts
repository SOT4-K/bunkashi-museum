/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のリポジトリ名サブパスに配信するため、CI からは
// VITE_BASE=/<repo>/ を渡す。ローカル開発・プレビューは '/'。
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icon.svg',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-512-maskable.png',
      ],
      manifest: {
        // id は scope（=base）からの相対値にする（オーナー確認: 実機で id が
        // scope と食い違うと同じアプリとして再認識されないことがある）。
        id: '.',
        lang: 'ja',
        name: '文化史ミュージアム',
        short_name: '文化史ミュージアム',
        description: '日本史文化史（飛鳥〜江戸）の作品を集めて美術館を完成させる画像選択クイズ',
        theme_color: '#15171C',
        background_color: '#15171C',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          // iOS はこの manifest.icons を home screen アイコンに使わない
          // （<link rel="apple-touch-icon"> を見る。index.html 側で PNG を指定）。
          // ここは Android/Chrome 向け。SVG は iOS で読めないため PNG を使う。
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/img/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'work-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    fs: {
      // content/ は app/ の外（work/nihonshi-bunka/content）にあるため許可する
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
