import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
});
