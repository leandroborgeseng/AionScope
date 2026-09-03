import { readParqueMeta, writeParqueMeta } from "@/lib/cadastros/store";
import type { ParqueMeta } from "@/lib/cadastros/types";
import { fetchPbi } from "@/lib/pbi/client";
import { startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams } from "@/lib/pbi/filters";
import { resumirValorParqueApi } from "@/lib/pbi/parque-valor";
import type { EquipamentoItem } from "@/lib/pbi/types";

/** Reconsulta equipamentos e grava valorApi (soma substituição de TODOS). */
export async function atualizarParqueDaApi(opts?: {
  atualizadoPor?: string | null;
}): Promise<
  | { meta: ParqueMeta; resumo: ReturnType<typeof resumirValorParqueApi> }
  | { error: string; status: number }
> {
  const filters = {
    ...EMPTY_FILTERS,
    from: startOfMonthISO(),
    to: todayISO(),
    tipoManutencao: "Todos" as const,
    somenteMedicos: false,
  };
  const params = toUpstreamParams("equipamentos", filters, {
    apenasAtivos: "true",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "true",
  });

  const result = await fetchPbi<EquipamentoItem[]>("equipamentos", params);
  if (!result.ok || !Array.isArray(result.data)) {
    const failure = result.ok
      ? { message: "Resposta inválida da API de equipamentos.", status: 502 }
      : { message: result.message ?? "Falha ao consultar equipamentos.", status: result.status ?? 502 };
    return { error: failure.message, status: failure.status };
  }

  const resumo = resumirValorParqueApi(result.data);
  const valorApi = Math.round(resumo.substituicao.todos.total * 100) / 100;
  const current = readParqueMeta();
  const temManual =
    current.valorSubstituicaoManual != null && current.valorSubstituicaoManual > 0;
  const meta = writeParqueMeta({
    valorApi,
    fonte: temManual ? "manual" : "api",
    escopo: "todos",
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: opts?.atualizadoPor ?? null,
    valorManualReferencia: current.valorManualReferencia ?? 57_000_000,
    notas: `Soma ValorDeSubstituicao de todos os equipamentos (${resumo.nTotal} itens, ${resumo.substituicao.todos.pctPreenchidos.toFixed(1)}% preenchidos). Médicos (auditoria): ${resumo.substituicao.medicos.total}.`,
  });

  return { meta, resumo };
}
