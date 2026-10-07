import fs from 'fs';

/**
 * Escreve JSON de forma atômica: grava em `<arquivo>.tmp` e renomeia por cima.
 *
 * Um crash ou queda de energia no meio da escrita deixa o arquivo original
 * intacto, nunca um JSON pela metade. `mode` vale para o arquivo novo; o
 * `rename` preserva a permissão do temporário.
 */
export function writeJsonAtomic(file: string, data: unknown, mode?: number): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    ...(mode !== undefined ? { mode } : {}),
  });
  fs.renameSync(tmp, file);
}
