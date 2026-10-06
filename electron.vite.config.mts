import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const root = import.meta.dirname;

/** Espelha `paths` de tsconfig.base.json e o mapa de `node.loader.ts`. */
const sharedAliases = {
  '@zero/types': resolve(root, 'src/types'),
  '@zero/messages': resolve(root, 'src/messages'),
} as const;

export default defineConfig({
  main: {
    resolve: {
      alias: {
        ...sharedAliases,
        '@zero/main': resolve(root, 'src/main'),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(root, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        ...sharedAliases,
        '@zero/preload': resolve(root, 'src/preload'),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(root, 'src/preload/index.ts'),
        output: {
          // Preload sandboxed não tem loader ESM no Electron: precisa sair como
          // CommonJS (`.cjs`), mesmo com `package.json` em `"type": "module"`.
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    server: {
      fs: {
        // O root do renderer é `src/renderer`; sem liberar a raiz do projeto o
        // Vite recusa (403) os webfonts do FontAwesome em `node_modules` no dev.
        allow: [root],
      },
    },
    resolve: {
      alias: {
        ...sharedAliases,
        '@zero/renderer': resolve(root, 'src/renderer/src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(root, 'src/renderer/index.html'),
      },
    },
  },
});
