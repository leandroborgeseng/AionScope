/**
 * Recortes (drill-down) das telas Envelhecimento, Fluxo e Programadas da Sala.
 *
 * Regra central: cada número exibido nessas telas é o `.length` da lista devolvida
 * por estas funções. O snapshot usa as contagens; /api/sala/recorte usa as listas.
 * Assim a lista do drill sempre bate com o gráfico (C2 / D1) — mesma base
 * (`montarVistasSala`), mesmo filtro de canceladas e o mesmo relógio America/Sao_Paulo.
 */
import { format } from "date-fns";
import { parsePbiDate } from "@/lib/pbi/dates";
import { buildOficinasPlanoComparativo } from "@/lib/pbi/oficinas-plano-comparativo";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import {
  OFICINAS_VOLUME_PLANO,
  currentCalendarYearRange,
  filterOsOficinaEquals,
  filterOsOficinaEqualsIn,
  osDataFechadaIndicador,
  semOsCanceladas,
  volumeEcDoMes,
} from "@/lib/pbi/volume-ec";
import { ETAPAS } from "./etapas";
import { diasDesde, FAIXAS_IDADE, faixaIdadeDias } from "./envelhecimento";
import type { OsVista } from "./montar-snapshot";
import { montarOsDetalhe, type OsDetalheSnapshot } from "./os-detalhe";
import { osExecutadasPlanoMes, type TipoPlanoTv } from "./programadas-mes";
import { classeDemanda, semAcento, texto } from "./texto";

export function slugRecorte(valor: string) {
  return semAcento(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mesmaData(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function porAberturaAsc(a: OsVista, b: OsVista) {
  return (a.abertura?.getTime() ?? 0) - (b.abertura?.getTime() ?? 0);
}

/** OS de demanda abertas (sem canceladas — `encerrada` já cobre `isOsCancelada`). */
export function demandaAbertaSala(vistas: OsVista[]) {
  return vistas.filter((item) => !item.encerrada && classeDemanda(item.classe));
}

export function diasSemMovimento(item: OsVista, agora: Date) {
  const ancora = item.atendimento ?? item.abertura;
  return ancora ? diasDesde(ancora, agora) : null;
}

// ---------------------------------------------------------------- Envelhecimento

export function recortesEnvelhecimento(vistas: OsVista[], agora: Date) {
  const demanda = demandaAbertaSala(vistas);
  // Agrupa na ordem da carga (mantém a ordem dos segmentos do gráfico — R1); as listas saem ordenadas.
  const comAbertura = demanda.filter((item) => item.abertura);
  const abertas = [...comAbertura].sort(porAberturaAsc);
  const faixas = FAIXAS_IDADE.map((faixa) => {
    const grupo = comAbertura.filter((item) => faixaIdadeDias(diasDesde(item.abertura as Date, agora)) === faixa.id);
    const partesMap = new Map<string, OsVista[]>();
    for (const item of grupo) partesMap.set(item.etapa, [...(partesMap.get(item.etapa) ?? []), item]);
    return {
      id: faixa.id,
      label: faixa.label,
      itens: [...grupo].sort(porAberturaAsc),
      partes: [...partesMap.entries()].map(([etapa, lista]) => ({ etapa, itens: [...lista].sort(porAberturaAsc) })),
    };
  });
  return {
    abertas,
    faixas,
    aguardandoTerceiros: demanda
      .filter((item) => item.etapa === "Reparo externo" || item.etapa === "Contrato/assistência")
      .sort(porAberturaAsc),
    semMovimentoMais7: abertas.filter((item) => {
      const dias = diasSemMovimento(item, agora);
      return dias != null && dias > 7;
    }),
    pendenciaSemMotivo: demanda
      .filter((item) => semAcento(item.os.SituacaoDaOS) === "PENDENTE" && !texto(item.os.Pendencia))
      .sort(porAberturaAsc),
  };
}

// ---------------------------------------------------------------- Fluxo

export function recortesFluxo(vistas: OsVista[], agora: Date) {
  const demanda = demandaAbertaSala(vistas);
  const etapas = ETAPAS.filter((etapa) => etapa !== "Encerrada").map((etapa) => ({
    etapa,
    itens: demanda.filter((item) => item.etapa === etapa),
  }));
  const entraram = vistas
    .filter((item) => item.abertura && mesmaData(item.abertura, agora) && classeDemanda(item.classe))
    .sort((a, b) => (b.abertura?.getTime() ?? 0) - (a.abertura?.getTime() ?? 0));
  // Mesma regra de `fechadasNo(mesmaData)` (rodapé "hoje ↓"): fechamento hoje, sem canceladas.
  const encerradas = vistas
    .filter(
      (item) =>
        item.fechamento &&
        osDataFechadaIndicador(item.os) &&
        mesmaData(item.fechamento, agora) &&
        classeDemanda(item.classe),
    )
    .sort((a, b) => (b.fechamento?.getTime() ?? 0) - (a.fechamento?.getTime() ?? 0));
  return { etapas, entraram, encerradas };
}

// ---------------------------------------------------------------- Programadas

export type ModoProgramadas = "abertas" | "fechadas" | "todas";

/** Mesma base do indicador Oficinas · Plano · Abertas × Fechadas (ano civil, sem canceladas). */
export function comparativoProgramadas(os: OsAnaliticoItem[], agora: Date) {
  const range = currentCalendarYearRange(agora);
  return { range, comparativo: buildOficinasPlanoComparativo(os, range) };
}

function osDoEscopo(os: OsAnaliticoItem[], escopo: string) {
  if (escopo === "consolidado") {
    return semOsCanceladas(filterOsOficinaEqualsIn(os, OFICINAS_VOLUME_PLANO.map((item) => item.oficinaEquals)));
  }
  const cfg = OFICINAS_VOLUME_PLANO.find((item) => item.filterKey === escopo);
  return cfg ? semOsCanceladas(filterOsOficinaEquals(os, cfg.oficinaEquals)) : [];
}

/** Lista do recorte oficina × mês × movimento — igual ao drill do indicador. */
export function recorteProgramadasMes(
  os: OsAnaliticoItem[],
  escopo: string,
  year: number,
  month: number,
  modo: ModoProgramadas,
): OsAnaliticoItem[] {
  const rows = volumeEcDoMes(osDoEscopo(os, escopo), year, month);
  if (modo === "abertas") return rows.filter((r) => r.movimento === "Aberta" || r.movimento === "Ambas");
  if (modo === "fechadas") return rows.filter((r) => r.movimento === "Fechada" || r.movimento === "Ambas");
  return rows;
}

// ---------------------------------------------------------------- Linhas (lista do drill)

export type LinhaRecorte = {
  os: string;
  equipamento: string;
  tag: string;
  setor: string;
  oficina: string;
  tipo: string;
  situacaoOs: string;
  etapa: string;
  prioridade: string;
  /** Selo de 1º atendimento (GRAVE/ATRASADA/…) quando houver. */
  selo?: string;
  /** ISO local (America/Sao_Paulo, sem fuso) para ordenar e filtrar por período. */
  aberturaIso: string | null;
  abertura: string;
  fechamento: string;
  idadeDias: number | null;
  idade: string;
  semMovimento: string;
  /** Hora de abertura/fechamento (Fluxo). */
  hora?: string;
  movimento?: string;
};

function isoLocal(data: Date | null) {
  return data ? format(data, "yyyy-MM-dd'T'HH:mm:ss") : null;
}

export function linhaDeVista(item: OsVista, agora: Date, hora?: "abertura" | "fechamento"): LinhaRecorte {
  const dias = item.abertura ? diasDesde(item.abertura, agora) : null;
  const semMov = diasSemMovimento(item, agora);
  const ref = hora === "fechamento" ? item.fechamento : item.abertura;
  return {
    os: texto(item.os.OS) || "—",
    equipamento: texto(item.os.Equipamento) || "—",
    tag: item.tag,
    setor: texto(item.os.Setor) || "—",
    oficina: texto(item.os.Oficina) || "—",
    tipo: texto(item.os.TipoDeManutencao) || "—",
    situacaoOs: texto(item.os.SituacaoDaOS) || "—",
    etapa: item.etapa,
    prioridade: item.criticidade,
    selo: item.situacao === "ATENDIDA" ? "Atendida" : item.situacao,
    aberturaIso: isoLocal(item.abertura),
    abertura: item.abertura ? format(item.abertura, "dd/MM/yyyy HH:mm") : "—",
    fechamento: item.fechamento ? format(item.fechamento, "dd/MM/yyyy HH:mm") : "—",
    idadeDias: dias,
    idade: dias == null ? "—" : `${dias}d`,
    semMovimento:
      semMov == null ? "—" : item.atendimento ? `${semMov}d desde 1º at.` : `${semMov}d sem 1º at.`,
    hora: hora && ref ? format(ref, "HH:mm") : undefined,
  };
}

export function linhaDeOs(os: OsAnaliticoItem & { movimento?: string }, agora: Date): LinhaRecorte {
  const abertura = parsePbiDate(os.Abertura);
  const fechamento = osDataFechadaIndicador(os);
  const dias = abertura ? diasDesde(abertura, fechamento ?? agora) : null;
  const detalhe = montarOsDetalhe(os);
  return {
    os: texto(os.OS) || "—",
    equipamento: texto(os.Equipamento) || "—",
    tag: texto(os.Tag) || "—",
    setor: texto(os.Setor) || "—",
    oficina: texto(os.Oficina) || "—",
    tipo: texto(os.TipoDeManutencao) || "—",
    situacaoOs: texto(os.SituacaoDaOS) || "—",
    etapa: String(detalhe.etapa),
    prioridade: texto(os.Prioridade) || "—",
    aberturaIso: isoLocal(abertura),
    abertura: abertura ? format(abertura, "dd/MM/yyyy HH:mm") : "—",
    fechamento: fechamento ? format(fechamento, "dd/MM/yyyy HH:mm") : "—",
    idadeDias: dias,
    idade: dias == null ? "—" : `${dias}d`,
    semMovimento: "—",
    movimento: os.movimento,
  };
}

// ---------------------------------------------------------------- Resolver por id

export type RecorteResolvido = {
  id: string;
  titulo: string;
  tela: "envelhecimento" | "fluxo" | "programadas";
  /** Rótulo da faixa vazia (D5). */
  vazio: string;
  linhas: LinhaRecorte[];
  /** Detalhe "do cache" (snapshot) de cada OS da lista — fallback do C11. */
  detalhes: Record<string, OsDetalheSnapshot>;
};

const TIPOS_PLANO: TipoPlanoTv[] = ["Calibração", "Preventiva", "TSE"];

function detalhesDeVistas(itens: OsVista[]) {
  const mapa: Record<string, OsDetalheSnapshot> = {};
  for (const item of itens) {
    const numero = texto(item.os.OS);
    if (!numero) continue;
    mapa[numero] = montarOsDetalhe(item.os, {
      criticidade: item.criticidade,
      etapa: item.etapa,
      aberto: !item.encerrada,
    });
  }
  return mapa;
}

function detalhesDeOs(itens: OsAnaliticoItem[]) {
  const mapa: Record<string, OsDetalheSnapshot> = {};
  for (const item of itens) {
    const numero = texto(item.OS);
    if (numero) mapa[numero] = montarOsDetalhe(item);
  }
  return mapa;
}

const ROTULO_KPI: Record<string, string> = {
  "aguardando-terceiros": "AGUARDANDO TERCEIROS",
  "sem-movimento-7": "SEM MOVIMENTO > 7 DIAS",
  "pendentes-sem-motivo": "PENDENTES SEM MOTIVO",
};

/**
 * Resolve um id de drill (ex.: `envelhecimento.faixa.d8a15.etapa.em-atendimento`)
 * para a lista de OS. Devolve null se o id não existe.
 */
export function resolverRecorte(
  id: string,
  ctx: { vistas: OsVista[]; os: OsAnaliticoItem[]; agora: Date },
): RecorteResolvido | null {
  const { vistas, os, agora } = ctx;
  const partes = id.split(".");
  if (partes[0] === "envelhecimento") {
    const env = recortesEnvelhecimento(vistas, agora);
    if (partes[1] === "faixa") {
      const faixa = env.faixas.find((item) => item.id === partes[2]);
      if (!faixa) return null;
      let itens = faixa.itens;
      let titulo = `IDADE ${faixa.label.toUpperCase()}`;
      if (partes[3] === "etapa") {
        const parte = faixa.partes.find((item) => slugRecorte(item.etapa) === partes[4]);
        const etapa = ETAPAS.find((item) => slugRecorte(item) === partes[4]);
        if (!etapa) return null;
        itens = parte?.itens ?? [];
        titulo = `${titulo} · ${etapa.toUpperCase()}`;
      }
      return {
        id,
        titulo,
        tela: "envelhecimento",
        vazio: "Nenhuma OS nesta faixa agora.",
        linhas: [...itens].sort(porAberturaAsc).map((item) => linhaDeVista(item, agora)),
        detalhes: detalhesDeVistas(itens),
      };
    }
    if (partes[1] === "kpi") {
      const chave = partes[2];
      const itens =
        chave === "aguardando-terceiros"
          ? env.aguardandoTerceiros
          : chave === "sem-movimento-7"
            ? env.semMovimentoMais7
            : chave === "pendentes-sem-motivo"
              ? env.pendenciaSemMotivo
              : null;
      if (!itens) return null;
      return {
        id,
        titulo: ROTULO_KPI[chave],
        tela: "envelhecimento",
        vazio: "Nenhuma OS neste recorte agora.",
        linhas: itens.map((item) => linhaDeVista(item, agora)),
        detalhes: detalhesDeVistas(itens),
      };
    }
    return null;
  }
  if (partes[0] === "fluxo") {
    const fluxo = recortesFluxo(vistas, agora);
    if (partes[1] === "etapa") {
      const etapa = fluxo.etapas.find((item) => slugRecorte(item.etapa) === partes[2]);
      if (!etapa) return null;
      const itens = [...etapa.itens].sort(porAberturaAsc);
      return {
        id,
        titulo: etapa.etapa.toUpperCase(),
        tela: "fluxo",
        vazio: "Nenhuma OS nesta etapa agora.",
        linhas: itens.map((item) => linhaDeVista(item, agora)),
        detalhes: detalhesDeVistas(itens),
      };
    }
    if (partes[1] === "entraram" || partes[1] === "encerradas") {
      const entraram = partes[1] === "entraram";
      const itens = entraram ? fluxo.entraram : fluxo.encerradas;
      return {
        id,
        titulo: entraram ? "ENTRARAM HOJE" : "ENCERRADAS HOJE",
        tela: "fluxo",
        vazio: entraram ? "Nenhuma OS aberta hoje." : "Nenhuma OS encerrada hoje.",
        linhas: itens.map((item) => linhaDeVista(item, agora, entraram ? "abertura" : "fechamento")),
        detalhes: detalhesDeVistas(itens),
      };
    }
    return null;
  }
  if (partes[0] === "programadas") {
    if (partes[1] === "tipo") {
      const tipo = TIPOS_PLANO.find((item) => slugRecorte(item) === partes[2]);
      if (!tipo) return null;
      const itens = osExecutadasPlanoMes(os, agora).get(tipo) ?? [];
      return {
        id,
        titulo: `${tipo.toUpperCase()} · EXECUTADAS NO MÊS`,
        tela: "programadas",
        vazio: "Nenhuma OS deste tipo fechada no mês.",
        linhas: itens.map((item) => linhaDeOs(item, agora)),
        detalhes: detalhesDeOs(itens),
      };
    }
    // programadas.<escopo>.<aaaa-mm>[.<modo>]
    const escopo = partes[1];
    const mes = /^(\d{4})-(\d{2})$/.exec(partes[2] ?? "");
    const modo = (partes[3] ?? "todas") as ModoProgramadas;
    if (!mes || !["abertas", "fechadas", "todas"].includes(modo)) return null;
    const rotulo =
      escopo === "consolidado"
        ? "CONSOLIDADO"
        : OFICINAS_VOLUME_PLANO.find((item) => item.filterKey === escopo)?.chipLabel.toUpperCase();
    if (!rotulo) return null;
    const year = Number(mes[1]);
    const month = Number(mes[2]) - 1;
    const itens = recorteProgramadasMes(os, escopo, year, month, modo);
    const modoLabel = modo === "abertas" ? "ABERTAS" : modo === "fechadas" ? "FECHADAS" : "ABERTAS E FECHADAS";
    return {
      id,
      titulo: `${rotulo} · ${mes[2]}/${mes[1]} · ${modoLabel}`,
      tela: "programadas",
      vazio: "Nenhuma OS neste mês para esta oficina.",
      linhas: itens.map((item) => linhaDeOs(item, agora)),
      detalhes: detalhesDeOs(itens),
    };
  }
  return null;
}
