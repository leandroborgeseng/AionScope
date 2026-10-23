import { gravarValorParque } from "@/lib/cadastros/parque-historico";
import type { ParqueMeta } from "@/lib/cadastros/types";
import { fetchPbi } from "@/lib/pbi/client";
import { startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams } from "@/lib/pbi/filters";
import type { resumirValorParqueApi } from "@/lib/pbi/parque-valor";
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

  return gravarValorParque(result.data, { origem: "manual", atualizadoPor: opts?.atualizadoPor ?? null });
}
