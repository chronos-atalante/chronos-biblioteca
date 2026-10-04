/**
 * Leitura tipada de corpos JSON das APIs do Google.
 *
 * `Response.json()` devolve `Promise<any>`; este é o único ponto do módulo
 * `drive/` que converte esse `any` em um tipo declarado. Os chamadores passam
 * a forma esperada como parâmetro de tipo e continuam validando a forma
 * mínima antes de usar (ver `isWorkArray` em `backup.ts`, `isTokens` em
 * `state.ts`).
 */
export async function parseJson<T>(res: Response): Promise<T> {
  const data: unknown = await res.json();
  return data as T;
}
