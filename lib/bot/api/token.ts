/**
 * Token de serviço da API do bot. Lido em runtime.
 * Os dois lados viram SHA-256 antes do timingSafeEqual, então o tamanho
 * do token apresentado não entra na comparação.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const BOT_TOKEN_ENV = "AIONSCOPE_BOT_TOKEN";
const TOKEN_MIN = 32;
const TOKEN_MAX = 512;

function digest(valor: string) {
  return createHash("sha256").update(valor, "utf8").digest();
}

export function tokenConfigurado() {
  return (process.env[BOT_TOKEN_ENV] ?? "").trim().length >= TOKEN_MIN;
}

export function bearerConfere(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const apresentado = match?.[1] ?? "";
  const esperado = (process.env[BOT_TOKEN_ENV] ?? "").trim();
  const mesmo = timingSafeEqual(digest(apresentado), digest(esperado));
  return tokenConfigurado() && apresentado.length > 0 && apresentado.length <= TOKEN_MAX && mesmo;
}

/** Identificador estável do token, sem gravar o segredo. */
export function botIdAtual() {
  if (!tokenConfigurado()) return null;
  return digest((process.env[BOT_TOKEN_ENV] ?? "").trim()).toString("hex").slice(0, 12);
}
