/**
 * Loader de resolução ESM do projeto.
 *
 * Resolve os aliases `@zero/*` (definidos em `tsconfig.base.json`) quando o
 * Node executa arquivos TypeScript direto, sem bundler — ou seja, fora do
 * electron-vite (build) e do vitest (testes).
 *
 * Uso (registrado com `--import`, antes de qualquer código da aplicação):
 *   node --import ./src/node.loader.ts caminho/para/arquivo.ts
 *
 * API: `module.registerHooks()` (hooks síncronos, na mesma thread) — estável
 * desde o Node 22.15/23.5 e recomendada pela documentação. O caminho antigo,
 * `module.register()` com hooks assíncronos em thread separada (o antigo
 * `--experimental-loader`), está deprecado desde o Node 25.9.
 */
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Raiz do repositório (pasta que contém `src/`). */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

type Alias = readonly [prefix: string, target: string];

/** Espelha `compilerOptions.paths` de tsconfig.base.json. */
const ALIASES: readonly Alias[] = [
  ['@zero/types', 'src/types'],
  ['@zero/main', 'src/main'],
  ['@zero/preload', 'src/preload'],
  ['@zero/renderer', 'src/renderer/src'],
];

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.json'] as const;

function isFile(candidate: string): boolean {
  return existsSync(candidate) && statSync(candidate).isFile();
}

/** Tenta `base`, `base.<ext>` e `base/index.<ext>` (padrão de bundler). */
function resolveFile(base: string): string | null {
  if (isFile(base)) return base;
  for (const ext of EXTENSIONS) {
    const withExt = `${base}${ext}`;
    if (isFile(withExt)) return withExt;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, `index${ext}`);
    if (isFile(index)) return index;
  }
  return null;
}

function resolveAlias(specifier: string): string | null {
  for (const [prefix, target] of ALIASES) {
    if (specifier !== prefix && !specifier.startsWith(`${prefix}/`)) continue;
    const rest = specifier === prefix ? '' : specifier.slice(prefix.length + 1);
    return resolveFile(path.join(ROOT, target, rest));
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const aliased = resolveAlias(specifier);
    if (aliased !== null) {
      return nextResolve(pathToFileURL(aliased).href, context);
    }
    return nextResolve(specifier, context);
  },
});
