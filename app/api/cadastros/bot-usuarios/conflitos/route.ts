import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import { MSG_CORPO_CADASTRO, MSG_GRAVACAO } from "@/lib/bot/mensagens";
import { listarConflitoPorId } from "@/lib/bot/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Conflito pelo id do cadastro. O telefone não entra na query, para não ir aos logs. */
export async function GET(request: Request) {
  const recusa = exigirSessaoAdmin(request);
  if (recusa) return recusa;
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return Response.json({ ok: false, message: MSG_CORPO_CADASTRO }, { status: 400 });
  try {
    const resultado = listarConflitoPorId(id);
    if (!resultado.ok) return Response.json({ ok: false, message: resultado.message }, { status: resultado.status });
    return Response.json({ ok: true, data: resultado.data });
  } catch {
    return Response.json({ ok: false, message: MSG_GRAVACAO }, { status: 500 });
  }
}
