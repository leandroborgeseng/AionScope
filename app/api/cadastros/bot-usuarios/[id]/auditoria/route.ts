import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import { diasVisiveisAuditoria } from "@/lib/bot/auditoria";
import { MSG_GRAVACAO, MSG_NAO_ENCONTRADO } from "@/lib/bot/mensagens";
import { listarAuditoria, obterUsuario } from "@/lib/bot/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Trilha visível (padrão 90 dias). Sem telefone, e-mail, setor ou corpo. */
export async function GET(request: Request, context: Ctx) {
  const recusa = exigirSessaoAdmin(request);
  if (recusa) return recusa;
  const { id } = await context.params;
  if (!obterUsuario(id)) return Response.json({ ok: false, message: MSG_NAO_ENCONTRADO }, { status: 404 });
  try {
    return Response.json({ ok: true, data: listarAuditoria(id), dias: diasVisiveisAuditoria() });
  } catch {
    return Response.json({ ok: false, message: MSG_GRAVACAO }, { status: 500 });
  }
}
