import { MSG_GRAVACAO } from "@/lib/bot/mensagens";
import { exigirMutacaoAdmin } from "@/lib/bot/origem";
import { revelarTelefone } from "@/lib/bot/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Revela o E.164 para a sessão de administrador e grava auditoria sem o número. */
export async function POST(request: Request, context: Ctx) {
  const recusa = exigirMutacaoAdmin(request);
  if (recusa) return recusa;
  const { id } = await context.params;
  try {
    const resultado = revelarTelefone(id);
    if (!resultado.ok) return Response.json({ ok: false, message: resultado.message }, { status: resultado.status });
    return Response.json({ ok: true, data: resultado.data });
  } catch {
    return Response.json({ ok: false, message: MSG_GRAVACAO }, { status: 500 });
  }
}
