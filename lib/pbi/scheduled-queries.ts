/** Consultas padrão das telas de indicadores (o período que cada tela abre por padrão). Renovadas sempre. */
import type { PbiResource } from "./catalog";
import { SCHEDULED_RESOURCES } from "./cache-policy";
import { startOfMonthISO, todayISO } from "./dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "./filters";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API } from "./volume-ec";

function keyOf(resource: string, params: URLSearchParams) {
  return `${resource}:${params.toString()}`;
}

/** Consultas padrão das telas de indicadores (mesmos parâmetros que os hooks enviam). */
export function defaultScheduledQueries(): Array<{ resource: PbiResource; params: URLSearchParams }> {
  const mes: DashboardFilters = { ...EMPTY_FILTERS, from: startOfMonthISO(), to: todayISO(), tipoManutencao: "Todos", somenteMedicos: false };
  const out: Array<{ resource: PbiResource; params: URLSearchParams }> = [];
  for (const resource of SCHEDULED_RESOURCES) out.push({ resource, params: toUpstreamParams(resource, mes) });
  // Indicador custo/parque e OS (ano): OS analítica como em useOsAnaliticoRollingYear.
  out.push({
    resource: "os-analitico",
    params: toUpstreamParams("os-analitico", { ...mes, tipoManutencao: VOLUME_EC_TIPO_API }, { periodo: VOLUME_EC_PERIODO_API, qtdPorPagina: "100000" }),
  });
  // Equipamentos como em useMedicalIndex e no card custo/parque.
  for (const extras of [
    { apenasAtivos: "false", incluirComponentes: "false", incluirCustoSubstituicao: "false" },
    { apenasAtivos: "true", incluirComponentes: "false", incluirCustoSubstituicao: "true" },
  ]) {
    out.push({ resource: "equipamentos", params: toUpstreamParams("equipamentos", mes, extras) });
  }
  return out;
}

export function defaultScheduledKeys(): Set<string> {
  return new Set(defaultScheduledQueries().map((q) => keyOf(q.resource, q.params)));
}
