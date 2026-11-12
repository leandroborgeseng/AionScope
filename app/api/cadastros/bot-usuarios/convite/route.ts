import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import { definirValidadeDias, emitirConviteGrupo, lerConviteGrupo, revogarConviteAtivo } from "@/lib/bot/convite";
import { MSG_CORPO_CADASTRO, MSG_GRAVACAO, MSG_JSON } from "@/lib/bot/mensagens";
import { exigirMutacaoAdmin } from "@/lib/bot/origem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const recusa = exigirSessaoAdmin(request);
  if (recusa) return recusa;
  try {
    return Response.json({ ok: true, data: lerConviteGrupo() });
  } catch {
    return json(500, MSG_GRAVACAO);
  }
}

/** Gerar revoga o link anterior na hora. A resposta traz a URL para o admin copiar, sem auditoria. */
export async function POST(request: Request) {
  const recusa = exigirMutacaoAdmin(request);
  if (recusa) return recusa;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, MSG_JSON);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, MSG_JSON);
  const dados = body as Record<string, unknown>;
  const chaves = Object.keys(dados).sort();
  const acao = dados.acao;
  try {
    if (acao === "gerar" && chaves.length === 1) {
      const emitido = emitirConviteGrupo();
      if (!emitido.ok) return json(emitido.status, emitido.message);
      return Response.json({ ok: true, data: lerConviteGrupo() });
    }
    if (acao === "revogar" && chaves.length === 1) {
      const revogado = revogarConviteAtivo();
      if (!revogado.ok) return json(revogado.status, revogado.message);
      return Response.json({ ok: true, data: revogado.data });
    }
    if (acao === "validade" && chaves.length === 2 && chaves[1] === "dias") {
      const definido = definirValidadeDias(dados.dias);
      if (!definido.ok) return json(definido.status, definido.message);
      return Response.json({ ok: true, data: definido.data });
    }
    return json(400, MSG_CORPO_CADASTRO);
  } catch {
    return json(500, MSG_GRAVACAO);
  }
}
