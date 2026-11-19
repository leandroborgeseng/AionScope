/**
 * Idade da cópia por recurso. Não dispara atualização.
 */
import { STALE_MAX_MS } from "@/lib/pbi/cache-policy";
import { copiaVencida, frescorDos } from "./copia";
import { json } from "./http";

const RECURSOS = [
  "os-analitico",
  "os-resumida",
  "equipamentos",
  "cronograma",
  "monitor-reacao",
  "monitor-atendimento",
] as const;

export function consultarFreshness(agora = Date.now()) {
  const recursos = frescorDos(RECURSOS, agora);
  const vencido = recursos.find(copiaVencida);
  if (vencido) {
    return json(503, {
      ok: false,
      message: "Cópia com mais de 7 dias e a última atualização falhou.",
      recursos,
      limiteSegundos: Math.floor(STALE_MAX_MS / 1000),
    });
  }
  return json(200, { ok: true, recursos });
}
