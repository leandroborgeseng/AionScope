import { cookieSessao } from "@/lib/auth/contratos-sessao";
import { prepararRevogacao } from "@/lib/auth/painel-revogacao";
import { cookiePainelApagar } from "@/lib/auth/painel-sessao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Encerra só a sessão apresentada. Sem sessão válida, 401 e nenhum efeito. */
export async function POST(request: Request) {
  const pronto = await prepararRevogacao(request);
  if (!pronto.ok) {
    return new Response(JSON.stringify({ ok: false, message: pronto.message }), {
      status: pronto.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }
  const headers = new Headers({
    Location: "/login",
    "Cache-Control": "private, no-store",
  });
  headers.append("Set-Cookie", cookiePainelApagar());
  headers.append("Set-Cookie", cookieSessao("", 0));
  return new Response(null, { status: 303, headers });
}
