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
import { exigirOrigemPermitida } from "@/lib/bot/origem";
import { revogarSessaoPainelDoPedido } from "@/lib/auth/painel-revogacao";
import { cookiePainelApagar } from "@/lib/auth/painel-sessao";

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
 * Sair do admin: revoga a sessão do painel (o mesmo efeito do logout)
 * e apaga os dois cookies. Origem estranha não revoga nem apaga.
 */
export async function DELETE(request: Request) {
  const origem = exigirOrigemPermitida(request);
  if (origem) return origem;
  await revogarSessaoPainelDoPedido(request);
  const headers = new Headers();
  headers.append("Set-Cookie", cookiePainelApagar());
  headers.append("Set-Cookie", cookieSessao("", 0));
  return Response.json({ ok: true, data: { autenticado: false } }, { headers });
}
