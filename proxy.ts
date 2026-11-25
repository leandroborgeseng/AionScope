/**
 * Login único na frente do site. No Next 16 este arquivo é proxy (runtime Node):
 * a assinatura da sessão continua em Web Crypto, e a revogação do `jti` lê o SQLite.
 * Não há matcher de exclusão — o que não está na allowlist de `painel-guard` não abre.
 */
import type { NextRequest } from "next/server";
import { decidirPainel } from "@/lib/auth/painel-guard";

export async function proxy(request: NextRequest) {
  return decidirPainel(request);
}
