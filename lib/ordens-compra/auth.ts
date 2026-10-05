import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const ORDENS_COMPRA_API_KEY_ENV = "ORDENS_COMPRA_API_KEY";

function chaveConfigurada() {
  return process.env[ORDENS_COMPRA_API_KEY_ENV]?.trim() ?? "";
}

function iguais(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function bearerValido(request: Request) {
  const esperado = chaveConfigurada();
  if (!esperado) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(header);
  if (!match) return false;
  return iguais(match[1], esperado);
}

export function recusarNaoAutorizado() {
  return NextResponse.json(
    { erro: "não autorizado" },
    { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}

/** Health não usa. Demais rotas /api/v1/ordens-compra exigem Bearer. */
export function exigirBearerOrdens(request: Request) {
  if (bearerValido(request)) return null;
  return recusarNaoAutorizado();
}
