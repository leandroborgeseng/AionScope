import { origemPainelPermitida } from "@/lib/auth/painel-origem";
import { cookiePainelApagar } from "@/lib/auth/painel-sessao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Apaga o cookie do painel. Não exige sessão válida: um cookie expirado também sai. */
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
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Cache-Control": "private, no-store",
      "Set-Cookie": cookiePainelApagar(),
    },
  });
}
