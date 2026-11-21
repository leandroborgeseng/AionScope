/**
 * Login único na frente do site. Runtime Node: o logout grava um corte no SQLite
 * e esta verificação precisa lê-lo. A assinatura do cookie continua em Web Crypto.
 * Não há matcher de exclusão — o que não está na allowlist de `painel-guard` não abre.
 */
import type { NextRequest } from "next/server";
import { decidirPainel } from "@/lib/auth/painel-guard";

export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  return decidirPainel(request);
}
