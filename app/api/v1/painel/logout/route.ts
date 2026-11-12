import { cookiePainelApagar } from "@/lib/auth/painel-sessao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Apaga o cookie do painel. Não exige sessão válida: um cookie expirado também sai. */
export async function POST() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Cache-Control": "private, no-store",
      "Set-Cookie": cookiePainelApagar(),
    },
  });
}
