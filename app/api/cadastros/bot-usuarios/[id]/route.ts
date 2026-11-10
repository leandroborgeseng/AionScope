import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import { MSG_GRAVACAO, MSG_JSON, MSG_NAO_ENCONTRADO } from "@/lib/bot/mensagens";
import { aplicarAcao, obterUsuario } from "@/lib/bot/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const recusa = exigirSessaoAdmin(request);
  if (recusa) return recusa;
  const { id } = await context.params;
  const usuario = obterUsuario(id);
  if (!usuario) return Response.json({ ok: false, message: MSG_NAO_ENCONTRADO }, { status: 404 });
  return Response.json({ ok: true, data: usuario });
}

/** Aprovar, recusar, inativar ou reativar. Não altera telefone, papel, e-mail, setor nem outros_setores. */
export async function PATCH(request: Request, context: Ctx) {
  const recusa = exigirSessaoAdmin(request);
  if (recusa) return recusa;
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: MSG_JSON }, { status: 400 });
  }
  try {
    const resultado = aplicarAcao(id, body);
    if (!resultado.ok) return Response.json({ ok: false, message: resultado.message }, { status: resultado.status });
    return Response.json({ ok: true, data: resultado.data });
  } catch {
    return Response.json({ ok: false, message: MSG_GRAVACAO }, { status: 500 });
  }
}
