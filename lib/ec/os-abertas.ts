import { addMonths, format } from "date-fns";
import { fetchPbi } from "@/lib/pbi/client";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams } from "@/lib/pbi/filters";
import { isOficinaEngenhariaClinica } from "@/lib/pbi/oficina-ec";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { isOsCancelada, osFechamentoDate } from "@/lib/pbi/volume-ec";
import {
  filtrarOsPorQuery,
  montarOsDetalhe,
  paraSugestao,
  type OsAbertaSugestao,
  type OsDetalheSnapshot,
} from "./os-detalhe";
import { semAcento, texto } from "./texto";

function empresaIds() {
  const ids = (process.env.PBI_DEFAULT_EMPRESA_IDS ?? "2")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length ? ids : ["2"];
}

function osAberta(os: OsAnaliticoItem) {
  if (isOsCancelada(os)) return false;
  if (semAcento(os.SituacaoDaOS) === "FECHADA") return false;
  return osFechamentoDate(os) == null;
}

const cache = {
  expira: 0,
  itens: [] as OsAbertaSugestao[],
  detalhes: new Map<string, OsDetalheSnapshot>(),
};

async function carregarBase() {
  if (cache.expira > Date.now() && cache.itens.length) {
    return { itens: cache.itens, detalhes: cache.detalhes };
  }
  const agora = nowInSaoPaulo();
  const filtros = {
    ...EMPTY_FILTERS,
    from: format(addMonths(agora, -14), "yyyy-MM-dd"),
    to: format(agora, "yyyy-MM-dd"),
    tipoManutencao: "Todos" as const,
    somenteMedicos: false,
    empresaIds: empresaIds(),
  };
  const resultado = await fetchPbi<OsAnaliticoItem[]>(
    "os-analitico",
    toUpstreamParams("os-analitico", filtros, { periodo: "DoisAnosAtuais", qtdPorPagina: "100000" }),
  );
  const raw = resultado.ok && Array.isArray(resultado.data) ? resultado.data : [];
  const detalhes = new Map<string, OsDetalheSnapshot>();
  const abertas: OsAbertaSugestao[] = [];
  for (const os of raw) {
    if (!isOficinaEngenhariaClinica(os.Oficina)) continue;
    const numero = texto(os.OS);
    if (!numero) continue;
    const detalhe = montarOsDetalhe(os);
    detalhes.set(numero, detalhe);
    if (detalhe.aberto || osAberta(os)) {
      abertas.push(paraSugestao(detalhe));
    }
  }
  abertas.sort((a, b) => b.abertura.localeCompare(a.abertura) || a.os.localeCompare(b.os));
  cache.itens = abertas;
  cache.detalhes = detalhes;
  cache.expira = Date.now() + 60_000;
  return { itens: abertas, detalhes };
}

export function invalidarCacheOsAbertas() {
  cache.expira = 0;
  cache.itens = [];
  cache.detalhes = new Map();
}

export async function buscarOsAbertasEc(q = "", limite = 20) {
  const { itens } = await carregarBase();
  return filtrarOsPorQuery(itens, q, limite);
}

export async function obterOsDetalhePorNumero(numeroOs: string) {
  const numero = texto(numeroOs);
  if (!numero) return null;
  const { detalhes, itens } = await carregarBase();
  const hit = detalhes.get(numero);
  if (hit) return hit;
  // Fallback: match sem zeros à esquerda / parcial único
  const termo = semAcento(numero);
  const candidatos = itens.filter((item) => semAcento(item.os) === termo);
  if (candidatos.length === 1) return detalhes.get(candidatos[0].os) ?? null;
  return null;
}
