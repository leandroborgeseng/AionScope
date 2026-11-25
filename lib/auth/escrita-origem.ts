/**
 * Escrita autenticada pelo cookie do painel (ou pelo cookie antigo de contratos):
 * primeiro a sessão, depois a mesma origem do cadastro do bot.
 * 401 não revela se a origem passaria.
 */
import { exigirSessaoAdmin, exigirSessaoContratos } from "@/lib/auth/contratos-sessao";
import { exigirOrigemPermitida } from "@/lib/bot/origem";

export async function exigirEscritaContratos(request: Request): Promise<Response | null> {
  const sessao = await exigirSessaoContratos(request);
  if (sessao) return sessao;
  return exigirOrigemPermitida(request);
}

export async function exigirEscritaAdmin(request: Request): Promise<Response | null> {
  const sessao = await exigirSessaoAdmin(request);
  if (sessao) return sessao;
  return exigirOrigemPermitida(request);
}
