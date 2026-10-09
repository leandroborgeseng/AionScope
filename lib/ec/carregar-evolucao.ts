import { format } from "date-fns";
import { fetchPbi } from "@/lib/pbi/client";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "@/lib/pbi/filters";
import {
  montarEvolucaoHistorica,
  type EvolucaoHistorica,
} from "@/lib/pbi/evolucao-historica";
import type { EquipamentoItem, OsAnaliticoItem, OsResumidaItem } from "@/lib/pbi/types";

const CACHE_MS = 5 * 60_000;
const PAGE_SIZE = 5000;
const MAX_PAGES = 80;

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
    // API traz o parque completo; o recorte médico+ativo é aplicado em montarEvolucaoHistorica
    // (isEquipamentoMedico + Status/DataDeInativação), igual ao snapshot da Sala.
    somenteMedicos: false,
    empresaIds: empresaIds(),
  };
}

/** Campos mínimos para agregar chamados EC por ano. */
function resumidaParaAnalitico(item: OsResumidaItem): OsAnaliticoItem {
  return {
    CodigoSerialOS: item.CodigoSerialOS,
    Empresa: item.Empresa,
    OS: item.OS,
    Oficina: item.Oficina,
    Responsavel: item.Responsavel,
    Tipo: item.Tipo,
    Prioridade: item.Prioridade,
    TipoDeManutencao: item.TipoDeManutencao,
    SituacaoDaOS: item.SituacaoDaOS,
    ComplexidadeDaOS: item.ComplexidadeDaOS,
    PlanoDeManutencao: item.PlanoDeManutencao,
    Tag: "",
    Equipamento: item.Equipamento,
    Modelo: item.Modelo,
    Fabricante: item.Fabricante,
    Setor: item.Setor,
    CentroDeCusto: "",
    Abertura: item.Abertura,
    Parada: "",
    Funcionamento: "",
    Fechamento: item.Fechamento,
    Ocorrencia: item.Ocorrencia,
    Causa: item.Causa,
    Pendencia: "",
    PendenciaAberta: item.PendenciaAberta,
    PrazoDeEncerramentoOs: "",
    Servico: "",
    HorasTrabalhadas: "",
    TecnicoResolvedor: "",
    Custo: "",
    Deslocamento: "",
    SLAAtendimento: "",
    Status: item.Status,
    DataLimiteDoAtendimento: "",
    DataDoAtendimento: "",
    DataLimiteDaSolucao: "",
    DataDaSolucao: item.DataDaSolucao,
    Avaliacao: "",
    Seguro: "",
    LiberadoParaUso: "",
    JustificativaEncerramento: "",
  };
}

async function buscarOsResumidaPaginado(
  base: DashboardFilters,
  periodo: string,
): Promise<{ os: OsAnaliticoItem[]; ok: boolean; message?: string; paginas: number }> {
  const acumulado: OsAnaliticoItem[] = [];
  let totalEsperado: number | null = null;

  for (let pagina = 0; pagina < MAX_PAGES; pagina += 1) {
    const result = await fetchPbi<OsResumidaItem[]>(
      "os-resumida",
      toUpstreamParams("os-resumida", base, {
        periodo,
        pagina: String(pagina),
        qtdPorPagina: String(PAGE_SIZE),
      }),
    );
    if (!result.ok || !Array.isArray(result.data)) {
      return {
        os: acumulado,
        ok: false,
        message: result.ok ? "payload inválido" : result.message,
        paginas: pagina,
      };
    }
    if (result.total != null) totalEsperado = result.total;
    for (const item of result.data) acumulado.push(resumidaParaAnalitico(item));
    if (result.data.length < PAGE_SIZE) break;
    if (totalEsperado != null && acumulado.length >= totalEsperado) break;
  }

  return { os: acumulado, ok: true, paginas: Math.ceil(acumulado.length / PAGE_SIZE) || 1 };
}

async function buscarOsAnaliticoPaginado(
  base: DashboardFilters,
  periodo: string,
): Promise<{ os: OsAnaliticoItem[]; ok: boolean; message?: string }> {
  const acumulado: OsAnaliticoItem[] = [];

  for (let pagina = 0; pagina < MAX_PAGES; pagina += 1) {
    const result = await fetchPbi<OsAnaliticoItem[]>(
      "os-analitico",
      toUpstreamParams("os-analitico", base, {
        periodo,
        pagina: String(pagina),
        qtdPorPagina: String(PAGE_SIZE),
      }),
    );
    if (!result.ok || !Array.isArray(result.data)) {
      return {
        os: acumulado,
        ok: false,
        message: result.ok ? "payload inválido" : result.message,
      };
    }
    acumulado.push(...result.data);
    if (result.data.length < PAGE_SIZE) break;
  }

  return { os: acumulado, ok: true };
}

async function buscarOsHistorico(base: DashboardFilters): Promise<{
  os: OsAnaliticoItem[];
  periodo: string;
  avisos: string[];
}> {
  const avisos: string[] = [];

  // 1) Resumida + Todos (mais leve; costuma aguentar histórico completo com paginação).
  const resumidaTodos = await buscarOsResumidaPaginado(base, "Todos");
  if (resumidaTodos.ok && resumidaTodos.os.length > 0) {
    avisos.push(
      `Chamados via os-resumida período Todos (${resumidaTodos.os.length.toLocaleString("pt-BR")} OS · ${resumidaTodos.paginas} pág.).`,
    );
    return { os: resumidaTodos.os, periodo: "Todos", avisos };
  }
  if (!resumidaTodos.ok) {
    avisos.push(`Falha os-resumida/Todos: ${resumidaTodos.message ?? "erro"}`);
  }

  // 2) Analítico + Todos paginado (fallback se resumida falhar).
  const analiticoTodos = await buscarOsAnaliticoPaginado(base, "Todos");
  if (analiticoTodos.ok && analiticoTodos.os.length > 0) {
    avisos.push(
      `Chamados via os-analitico período Todos (${analiticoTodos.os.length.toLocaleString("pt-BR")} OS).`,
    );
    return { os: analiticoTodos.os, periodo: "Todos", avisos };
  }
  if (!analiticoTodos.ok) {
    avisos.push(`Falha os-analitico/Todos: ${analiticoTodos.message ?? "erro"}`);
  }

  // 3) Último recurso: DoisAnosAtuais (série incompleta — avisa na UI).
  const doisAnos = await buscarOsAnaliticoPaginado(base, "DoisAnosAtuais");
  if (doisAnos.ok && doisAnos.os.length > 0) {
    avisos.push(
      "API de OS respondeu só com DoisAnosAtuais (histórico completo indisponível).",
    );
    return { os: doisAnos.os, periodo: "DoisAnosAtuais", avisos };
  }
  if (!doisAnos.ok) {
    avisos.push(`Falha os-analitico/DoisAnosAtuais: ${doisAnos.message ?? "erro"}`);
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
