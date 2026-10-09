import { format } from "date-fns";
import { fetchPbi } from "@/lib/pbi/client";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "@/lib/pbi/filters";
import {
  montarEvolucaoHistorica,
  type EvolucaoHistorica,
} from "@/lib/pbi/evolucao-historica";
import type { EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";

const CACHE_MS = 5 * 60_000;

const cache = {
  expira: 0,
  valor: null as EvolucaoHistorica | null,
};

export function invalidarCacheEvolucao() {
  cache.expira = 0;
  cache.valor = null;
}

function empresaIds(): string[] {
  const ids = (process.env.PBI_DEFAULT_EMPRESA_IDS ?? "2")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length ? ids : ["2"];
}

function filtrosBase(agora: Date): DashboardFilters {
  return {
    ...EMPTY_FILTERS,
    from: format(new Date(agora.getFullYear() - 20, 0, 1), "yyyy-MM-dd"),
    to: format(agora, "yyyy-MM-dd"),
    tipoManutencao: "Todos",
    somenteMedicos: false,
    empresaIds: empresaIds(),
  };
}

async function buscarOsHistorico(base: DashboardFilters): Promise<{
  os: OsAnaliticoItem[];
  periodo: string;
  avisos: string[];
}> {
  const avisos: string[] = [];
  const tentativas: Array<{ periodo: string; label: string }> = [
    { periodo: "Todos", label: "Todos" },
    { periodo: "DoisAnosAtuais", label: "DoisAnosAtuais" },
  ];

  for (const tentativa of tentativas) {
    const result = await fetchPbi<OsAnaliticoItem[]>(
      "os-analitico",
      toUpstreamParams("os-analitico", base, {
        periodo: tentativa.periodo,
        qtdPorPagina: "100000",
      }),
    );
    if (result.ok && Array.isArray(result.data)) {
      if (tentativa.periodo !== "Todos") {
        avisos.push(
          `API de OS respondeu com período ${tentativa.label} (histórico completo indisponível).`,
        );
      }
      return { os: result.data, periodo: tentativa.periodo, avisos };
    }
    avisos.push(
      `Falha ao buscar OS com período ${tentativa.label}: ${result.ok ? "payload inválido" : result.message}`,
    );
  }

  return { os: [], periodo: "indisponivel", avisos };
}

export async function carregarEvolucaoHistorica(): Promise<EvolucaoHistorica> {
  if (cache.valor && cache.expira > Date.now()) return cache.valor;

  const agora = nowInSaoPaulo();
  const base = filtrosBase(agora);
  const [equipamentos, osHist] = await Promise.all([
    fetchPbi<EquipamentoItem[]>(
      "equipamentos",
      toUpstreamParams("equipamentos", base, {
        apenasAtivos: "false",
        incluirComponentes: "false",
        incluirCustoSubstituicao: "true",
      }),
    ),
    buscarOsHistorico(base),
  ]);

  const avisos = [...osHist.avisos];
  const eqs = equipamentos.ok && Array.isArray(equipamentos.data) ? equipamentos.data : [];
  if (!equipamentos.ok) {
    avisos.push(`Falha ao buscar equipamentos: ${equipamentos.message}`);
  }

  const snap = montarEvolucaoHistorica({
    equipamentos: eqs,
    os: osHist.os,
    chamadosPeriodoApi: osHist.periodo,
    hoje: agora,
    avisos,
  });

  cache.valor = snap;
  cache.expira = Date.now() + CACHE_MS;
  return snap;
}
