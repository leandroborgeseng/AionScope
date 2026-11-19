/**
 * Escritas da Sala (/api/sala/*, métodos != GET) exigem a sessão de administrador
 * (`sessaoContratosValida`: contratos ou painel). As leituras (GET) seguem abertas: a TV só lê.
 */
import { sessaoContratosValida } from "@/lib/auth/contratos-sessao";

export const MSG_LOGIN_SALA = "Para alterar, entre como administrador em /cadastros/contratos e tente de novo.";

/** null = autorizado; senão 401 sem dados. */
export async function exigirSessaoEscritaSala(request: Request): Promise<Response | null> {
  if (await sessaoContratosValida(request)) return null;
  return Response.json({ ok: false, message: MSG_LOGIN_SALA }, { status: 401 });
}
