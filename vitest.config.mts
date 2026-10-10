import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Espelha `paths` de tsconfig.base.json e o mapa de `node.loader.ts`. */
const aliases = {
  '@zero/types': resolve(import.meta.dirname, 'src/types'),
  '@zero/messages': resolve(import.meta.dirname, 'src/messages'),
  '@zero/main': resolve(import.meta.dirname, 'src/main'),
  '@zero/preload': resolve(import.meta.dirname, 'src/preload'),
  '@zero/renderer': resolve(import.meta.dirname, 'src/renderer/src'),
  electron: resolve(import.meta.dirname, 'tests/mocks/electron.ts'),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: aliases,
  },
  test: {
    name: 'cronologia',
    root: import.meta.dirname,
    environment: 'jsdom',
    pool: 'forks',
    // Com 21 forks abrindo jsdom em paralelo, testes que rodam em <1s isolados
    // já estouraram os 5s padrão e flakaram sob carga; 15s dá folga sem esconder
    // teste travado (o failure ainda aparece no timeout).
    testTimeout: 15_000,
    // O registro de IPC/scheme do processo main acontece no import; limpar mocks
    // antes de cada teste apagaria essas chamadas e quebraria os asserts.
    clearMocks: false,
    setupFiles: ['tests/setup-env.ts', 'tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/renderer/src/global.d.ts', 'src/renderer/index.html'],
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 50,
        branches: 50,
      },
    },
  },
});
