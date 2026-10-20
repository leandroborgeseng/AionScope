import {
  authContratosConfigurada,
  cookieSessao,
  criarTokenSessao,
  limparFalhas,
  loginBloqueado,
  registrarFalha,
  senhaConfere,
  sessaoContratosValida,
} from "@/lib/auth/contratos-sessao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ipDe(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Status da sessão de escrita (não revela nada da configuração além de "habilitado"). */
export async function GET(request: Request) {
  return Response.json({
    ok: true,
    data: { autenticado: sessaoContratosValida(request), habilitado: authContratosConfigurada() },
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

/** Logout. */
export async function DELETE() {
  return Response.json({ ok: true, data: { autenticado: false } }, { headers: { "Set-Cookie": cookieSessao("", 0) } });
}
