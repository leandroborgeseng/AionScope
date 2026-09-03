import type { TipoManutencaoFiltro } from "./catalog";
import { mapDateRangeToPeriodo, toApiDateTime } from "./dates";

export type DashboardFilters = {
  from: string;
  to: string;
  empresas: string[];
  empresaIds: string[];
  setores: string[];
  oficinas: string[];
  criticidades: string[];
  fabricantes: string[];
  modelos: string[];
  tipoManutencao: TipoManutencaoFiltro;
  somenteMedicos: boolean;
  medicalTags?: Set<string>;
  medicalIds?: Set<number>;
};

export const EMPTY_FILTERS: Omit<DashboardFilters, "from" | "to" | "tipoManutencao" | "somenteMedicos"> = {
  empresas: [],
  empresaIds: [],
  setores: [],
  oficinas: [],
  criticidades: [],
  fabricantes: [],
  modelos: [],
};

export function csvList(values: string[]): string {
  return values.filter(Boolean).join(",");
}

export function fromCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export function inList(value: string | null | undefined, selected: string[]) {
  if (!selected.length) return true;
  const current = (value ?? "").trim();
  return selected.some((item) => item.toLocaleLowerCase("pt-BR") === current.toLocaleLowerCase("pt-BR"));
}

export function matchesTextFilters<T extends Record<string, unknown>>(
  row: T,
  filters: Pick<DashboardFilters, "empresas" | "setores" | "oficinas" | "criticidades" | "fabricantes" | "modelos">,
  map: Partial<Record<keyof typeof filters, keyof T | (keyof T)[]>>,
) {
  const checks: Array<[string[], unknown]> = [
    [filters.empresas, pick(row, map.empresas)],
    [filters.setores, pick(row, map.setores)],
    [filters.oficinas, pick(row, map.oficinas)],
    [filters.criticidades, pick(row, map.criticidades)],
    [filters.fabricantes, pick(row, map.fabricantes)],
    [filters.modelos, pick(row, map.modelos)],
  ];
  return checks.every(([selected, value]) => {
    if (!selected.length) return true;
    if (Array.isArray(value)) return value.some((item) => inList(String(item ?? ""), selected));
    return inList(value == null ? "" : String(value), selected);
  });
}

function pick<T extends Record<string, unknown>>(row: T, keys?: keyof T | (keyof T)[]) {
  if (!keys) return "";
  if (Array.isArray(keys)) return keys.map((key) => row[key]);
  return row[keys];
}

export function isPreventiva(tipo: string | null | undefined) {
  const value = (tipo ?? "").toLocaleUpperCase("pt-BR");
  return value.includes("PREVENT");
}

export function isCorretiva(tipo: string | null | undefined) {
  const value = (tipo ?? "").toLocaleUpperCase("pt-BR");
  return value.includes("CORRET");
}

export function matchesTipoManutencao(tipo: string | null | undefined, filtro: TipoManutencaoFiltro) {
  if (filtro === "Todos") return true;
  if (filtro === "ApenasPreventiva") return isPreventiva(tipo);
  return isCorretiva(tipo);
}

export function toUpstreamParams(
  resource: string,
  filters: DashboardFilters,
  extras?: Record<string, string>,
): URLSearchParams {
  const params = new URLSearchParams(extras);
  const periodo = mapDateRangeToPeriodo(filters.from, filters.to);
  const dataInicio = toApiDateTime(filters.from);
  const dataFim = toApiDateTime(filters.to, true);

  const appendAll = (key: string, values: string[]) => {
    for (const value of values) params.append(key, value);
  };

  switch (resource) {
    case "cronograma":
    case "tmef":
    case "tpm":
    case "disp-equipamento":
    case "monitor-reacao":
    case "monitor-atendimento":
      params.set("dataInicio", extras?.dataInicio ?? dataInicio);
      params.set("dataFim", extras?.dataFim ?? dataFim);
      appendAll(resource.startsWith("monitor") ? "listCompanyId" : "listaEmpresaId", filters.empresaIds);
      break;
    case "tipo-manutencao":
      params.set("apenasAtivos", extras?.apenasAtivos ?? "true");
      params.set("tipo", filters.tipoManutencao);
      break;
    case "os-analitico":
    case "os-resumida":
      params.set("tipoManutencao", filters.tipoManutencao);
      params.set("periodo", extras?.periodo ?? periodo);
      appendAll("listaEmpresaId", filters.empresaIds);
      appendAll("oficinas", filters.oficinas);
      if (extras?.pagina) params.set("pagina", extras.pagina);
      if (extras?.qtdPorPagina) params.set("qtdPorPagina", extras.qtdPorPagina);
      break;
    case "equipamentos":
      params.set("apenasAtivos", extras?.apenasAtivos ?? "true");
      params.set("incluirComponentes", extras?.incluirComponentes ?? "false");
      params.set("incluirCustoSubstituicao", extras?.incluirCustoSubstituicao ?? "false");
      appendAll("listaEmpresaId", filters.empresaIds);
      break;
    case "disp-equipamento-mes":
      appendAll("empresasId", filters.empresaIds);
      params.set("dataInicio", dataInicio);
      params.set("dataFim", dataFim);
      params.set("periodo", extras?.periodo ?? periodo);
      appendAll("criticidadeIds", []);
      if (extras?.incluirComponentes) params.set("incluirComponentes", extras.incluirComponentes);
      break;
    case "oficina":
      if (filters.empresaIds[0]) params.set("companyId", filters.empresaIds[0]);
      params.set("apenasAtivos", "true");
      break;
    default:
      break;
  }

  return params;
}
