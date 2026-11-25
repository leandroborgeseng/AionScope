/**
 * Trava opcional do proxy /api/pbi. Sem `AIONSCOPE_PBI_TOKEN`, nada muda.
 * Com o valor definido, a rota exige o mesmo token no header, além da sessão.
 * Os dois lados viram SHA-256 antes do timingSafeEqual, então o tamanho
 * do token apresentado não entra na comparação. Bearer e X-PBI-Token
 * são sempre comparados, mesmo quando um deles vem vazio.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const PBI_TOKEN_ENV = "AIONSCOPE_PBI_TOKEN";

function digest(valor: string) {
  return createHash("sha256").update(valor, "utf8").digest();
}

export function pbiTokenExigido() {
  return (process.env[PBI_TOKEN_ENV] ?? "").trim().length > 0;
}

export function pbiTokenConfere(request: Request) {
  const esperado = (process.env[PBI_TOKEN_ENV] ?? "").trim();
  if (!esperado) return true;
  const header = (request.headers.get("x-pbi-token") ?? "").trim();
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)\s*$/i.exec(authorization)?.[1] ?? "";
  const peloHeader = timingSafeEqual(digest(header), digest(esperado));
  const peloBearer = timingSafeEqual(digest(bearer), digest(esperado));
  return peloHeader || peloBearer;
}

export function recusarPbiToken() {
  return Response.json(
    { ok: false, message: "Não autenticado." },
    { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
