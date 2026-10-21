/**
 * Mensagem de erro de uma consulta PBI considerando os dois caminhos de falha:
 * payload `{ ok: false }` (erro da API) e erro do react-query (rede, timeout, fetch rejeitado).
 */
export function queryErrorMessage(
  data: { ok: boolean; message?: string } | undefined,
  error: unknown,
  fallback = "falha ao consultar a fonte de dados",
): string | null {
  if (data && !data.ok) return data.message || fallback;
  if (error) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
  }
  return null;
}
