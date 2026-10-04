import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src/renderer/src'),
      electron: resolve(__dirname, 'tests/mocks/electron.ts'),
    },
  },
  test: {
    name: 'webtoons-biblioteca',
    root: __dirname,
    environment: 'jsdom',
    pool: 'forks',
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
