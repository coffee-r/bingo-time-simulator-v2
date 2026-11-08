import { defineConfig } from 'vitest/config'

// クライアント（ブラウザ）側のバンドル。サーバー側は wrangler がバンドルする。
export default defineConfig({
  publicDir: false,
  // Worker などの参照を /static/ 配下に向ける
  base: '/static/',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx/dom',
  },
  build: {
    outDir: 'public/static',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: 'src/client/main.tsx',
      output: {
        entryFileNames: 'app.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  worker: {
    format: 'es',
    rollupOptions: { output: { entryFileNames: 'sim.worker.js' } },
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
