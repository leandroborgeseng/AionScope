import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import { MSG_GRAVACAO } from "@/lib/bot/mensagens";
import { listarConflito, listarConflitoPorId } from "@/lib/bot/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lista pendentes e aprovados do mesmo telefone normalizado. Só a sessão de administrador. */
export async function GET(request: Request) {
  const recusa = exigirSessaoAdmin(request);
  if (recusa) return recusa;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    const resultado = id ? listarConflitoPorId(id) : listarConflito(url.searchParams.get("telefone") ?? "");
    if (!resultado.ok) return Response.json({ ok: false, message: resultado.message }, { status: resultado.status });
    return Response.json({ ok: true, data: resultado.data });
  } catch {
    return Response.json({ ok: false, message: MSG_GRAVACAO }, { status: 500 });
  }
}
