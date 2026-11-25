/**
 * Página de /os e de /os/por-setor. Mesmos nomes, limites e cursor.
 * `limit` ou `pageSize` (1 a 100, padrão 20). `offset` ou `cursor` (base64url do offset).
 * Os dois nomes de limite têm de ser iguais se vierem juntos. Offset e cursor juntos recusam.
 */
export function lerPaginacao(params: URLSearchParams): { ok: true; limit: number; offset: number } | { ok: false; message: string } {
  const temLimit = params.has("limit");
  const temPage = params.has("pageSize");
  if (temLimit && temPage && params.get("limit") !== params.get("pageSize")) {
    return { ok: false, message: "Parâmetros de página inválidos." };
  }
  const bruto = temLimit ? params.get("limit") : temPage ? params.get("pageSize") : null;
  let limit = 20;
  if (bruto != null) {
    if (!/^\d+$/.test(bruto)) return { ok: false, message: "Parâmetros de página inválidos." };
    limit = Number(bruto);
    if (limit < 1 || limit > 100) return { ok: false, message: "Limite máximo é 100." };
  }
  if (params.has("offset") && params.has("cursor")) return { ok: false, message: "Parâmetros de página inválidos." };
  let offset = 0;
  if (params.has("cursor")) {
    const textoCursor = Buffer.from(params.get("cursor") ?? "", "base64url").toString("utf8");
    if (!/^\d+$/.test(textoCursor)) return { ok: false, message: "Parâmetros de página inválidos." };
    offset = Number(textoCursor);
  } else if (params.has("offset")) {
    const brutoOffset = params.get("offset") ?? "";
    if (!/^\d+$/.test(brutoOffset)) return { ok: false, message: "Parâmetros de página inválidos." };
    offset = Number(brutoOffset);
  }
  if (!Number.isSafeInteger(offset)) return { ok: false, message: "Parâmetros de página inválidos." };
  return { ok: true, limit, offset };
}

export function cursorDaPagina(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}
