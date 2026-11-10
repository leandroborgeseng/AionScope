import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import { MSG_GRAVACAO, MSG_JSON } from "@/lib/bot/mensagens";
import { criarUsuario, listarUsuarios } from "@/lib/bot/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function semSessao(request: Request) {
  return exigirSessaoAdmin(request);
}

export async function GET(request: Request) {
  const recusa = semSessao(request);
  if (recusa) return recusa;
  const url = new URL(request.url);
  return Response.json({
    ok: true,
    data: listarUsuarios({
      situacao: url.searchParams.get("situacao"),
      papel: url.searchParams.get("papel"),
    }),
  });
}

export async function POST(request: Request) {
  const recusa = semSessao(request);
  if (recusa) return recusa;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: MSG_JSON }, { status: 400 });
  }
  try {
    const resultado = criarUsuario(body);
    if (!resultado.ok) return Response.json({ ok: false, message: resultado.message }, { status: resultado.status });
    return Response.json({ ok: true, data: resultado.data }, { status: 201 });
  } catch {
    return Response.json({ ok: false, message: MSG_GRAVACAO }, { status: 500 });
  }
}
