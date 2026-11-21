import {
  authContratosConfigurada,
  cookieSessao,
  ipDe,
  criarTokenSessao,
  limparFalhas,
  loginBloqueado,
  registrarFalha,
  senhaConfere,
  sessaoContratosValida,
} from "@/lib/auth/contratos-sessao";
import { origemPainelPermitida } from "@/lib/auth/painel-origem";
import { cookiePainelApagar } from "@/lib/auth/painel-sessao";
import { revogarSessoesPainel } from "@/lib/auth/painel-revogacao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";



/** Status da sessão de escrita (não revela nada da configuração além de "habilitado"). */
export async function GET(request: Request) {
  return Response.json({
    ok: true,
    data: { autenticado: await sessaoContratosValida(request), habilitado: authContratosConfigurada() },
  });
}

/** Login: { senha }. A senha nunca é logada. */
export async function POST(request: Request) {
  const ip = ipDe(request);
  if (!authContratosConfigurada()) {
    return Response.json({ ok: false, message: "Login de administrador não configurado neste ambiente." }, { status: 401 });
  }
  if (loginBloqueado(ip)) {
    return Response.json({ ok: false, message: "Muitas tentativas. Tente de novo em alguns minutos." }, { status: 429 });
  }
  let senha: unknown;
  try {
    senha = ((await request.json()) as { senha?: unknown }).senha;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }
  if (!senhaConfere(senha)) {
    registrarFalha(ip);
    return Response.json({ ok: false, message: "Senha incorreta." }, { status: 401 });
  }
  limparFalhas(ip);
  return Response.json(
    { ok: true, data: { autenticado: true } },
    { headers: { "Set-Cookie": cookieSessao(criarTokenSessao()) } },
  );
}

/**
 * Sair do admin. Com a sessão única, apagar só o cookie antigo de contratos
 * deixava o painel aberto. Encerra os dois cookies e revoga o que já foi emitido.
 */
export async function DELETE(request: Request) {
  if (!origemPainelPermitida(request)) {
    return Response.json(
      { ok: false, message: "Origem não permitida." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  revogarSessoesPainel();
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
  });
  headers.append("Set-Cookie", cookiePainelApagar());
  headers.append("Set-Cookie", cookieSessao("", 0));
  return new Response(JSON.stringify({ ok: true, data: { autenticado: false } }), { status: 200, headers });
}
