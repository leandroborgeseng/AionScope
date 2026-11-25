import { cookieSessao } from "@/lib/auth/contratos-sessao";
import { origemPainelPermitida } from "@/lib/auth/painel-origem";
import { revogarSessaoPainelDoPedido } from "@/lib/auth/painel-revogacao";
import { cookiePainelApagar } from "@/lib/auth/painel-sessao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Revoga só o jti deste cookie, apaga o cookie do painel e o da sessão antiga de contratos. */
export async function POST(request: Request) {
  if (!origemPainelPermitida(request)) {
    return new Response(JSON.stringify({ ok: false, message: "Origem não permitida." }), {
      status: 403,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }
  await revogarSessaoPainelDoPedido(request);
  const headers = new Headers({
    Location: "/login",
    "Cache-Control": "private, no-store",
  });
  headers.append("Set-Cookie", cookiePainelApagar());
  headers.append("Set-Cookie", cookieSessao("", 0));
  return new Response(null, { status: 303, headers });
}
