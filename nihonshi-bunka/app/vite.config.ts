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
    // M2-16 補修: content/works/ を writer が並行して増やし続けるため、全作品×全seedを
    // 回す realdata プロパティテスト（combos.test.ts・newTypes.realdata.test.ts・
    // pairsOrder.realdata.test.ts 等）が既定の 5000ms を超えることがある（full suite 実行時は
    // 他ファイルとの CPU 競合でさらに伸びる。2026-09-04 実測、works 173→208+件の増加中）。
    // 個別の it() に timeout を足していくと今後増える realdata テストの度に同じ対応が要るため、
    // ここで既定値を底上げする。
    testTimeout: 20000,
  },
})
