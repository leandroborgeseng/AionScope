/**
 * Login único na frente do site. Este arquivo é middleware (runtime Edge):
 * a verificação da sessão fica em Web Crypto. Não há matcher de exclusão —
 * o que não está na allowlist de `painel-guard` não abre.
 */
import type { NextRequest } from "next/server";
import { decidirPainel } from "@/lib/auth/painel-guard";

export async function middleware(request: NextRequest) {
  return decidirPainel(request);
}
