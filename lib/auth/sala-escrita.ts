/**
 * Escritas da Sala (/api/sala/*, métodos != GET) exigem a sessão de administrador
 * (`sessaoContratosValida`: contratos ou painel). As leituras (GET) seguem abertas: a TV só lê.
 */
import { sessaoContratosValida } from "@/lib/auth/contratos-sessao";
import { exigirOrigemPermitida } from "@/lib/bot/origem";

export const MSG_LOGIN_SALA = "Para alterar, entre como administrador em /cadastros/contratos e tente de novo.";

/** null = autorizado. Sessão primeiro (401); origem da allowlist em seguida (403). */
export async function exigirSessaoEscritaSala(request: Request): Promise<Response | null> {
  if (!(await sessaoContratosValida(request))) {
    return Response.json({ ok: false, message: MSG_LOGIN_SALA }, { status: 401 });
  }
  return exigirOrigemPermitida(request);
}
