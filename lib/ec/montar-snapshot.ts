import { addMonths, format } from "date-fns";
import { extrairSc, m365Configurado } from "@/lib/compras/parse-email";
import { resumoComprasTv, sincronizarCompras } from "@/lib/compras/sync";
import { listarRegistrosSala } from "@/lib/db/sala-registros";
import { fetchPbi } from "@/lib/pbi/client";
import { nowInSaoPaulo, parseBrNumber, parsePbiDate } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "@/lib/pbi/filters";
import { isTipoManutencaoMedica, isEquipamentoMedico } from "@/lib/pbi/medical";
import { isOficinaEngenhariaClinica } from "@/lib/pbi/oficina-ec";
import type { CronogramaItem, DisponibilidadeItem, EquipamentoItem, OsAnaliticoItem, TmefItem } from "@/lib/pbi/types";
import { isOsCancelada, osFechamentoDate } from "@/lib/pbi/volume-ec";
import { ETAPAS, etapaOs, type EtapaOs } from "./etapas";
import { diasDesde, FAIXAS_IDADE, faixaIdadeDias } from "./envelhecimento";
import { ordenarFila } from "./fila";
import { dentroDoExpediente, diffHorasUteis, horarioUtilConfig, type HorarioUtilConfig } from "./horario-util";
import { metaHorasEsforco, rotuloCriticidade } from "./meta";
import { planoAgoraCards, resumoProgramadasMes } from "./programadas-mes";
import { situacaoPrimeiroAtendimento, type SituacaoOs } from "./situacao";
import type { SalaSnapshot, TelaSala } from "./snapshot-tipos";
import { classeDemanda, classeManutencao, parseMoeda, semAcento, texto, type ClasseManutencao } from "./texto";

const FILA_LIMITE = 8;
const FLUXO_LIMITE = 6;
const ANTIGAS_LIMITE = 6;
const SEQUENCIA_PADRAO: TelaSala[] = [
  "agora",
  "fluxo",
  "compras",
  "agora",
  "envelhecimento",
  "programadas",
  "agora",
  "ciclo-de-vida",
  "indicadores",
  "processos",
];

type OsVista = {
  os: OsAnaliticoItem;
  tag: string;
  abertura: Date | null;
  atendimento: Date | null;
  fechamento: Date | null;
  encerrada: boolean;
  classe: ClasseManutencao;
  metaHoras: number | null;
  criticidade: string;
  criticidadeOrdem: number;
  situacao: SituacaoOs;
  etapa: EtapaOs;
  parado: boolean;
  compra: boolean;
};

export type DadosSala = {
  os: OsAnaliticoItem[];
  equipamentos: EquipamentoItem[];
  disponibilidade: DisponibilidadeItem[] | null;
  cronograma: CronogramaItem[];
  tmef: TmefItem[];
  manuais?: ReturnType<typeof listarRegistrosSala>;
  erroOs?: string;
  erroEquipamentos?: string;
  erroDisponibilidade?: string;
  erroCronograma?: string;
  erroTmef?: string;
};

function empresaIds() {
  const ids = (process.env.PBI_DEFAULT_EMPRESA_IDS ?? "2")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length ? ids : ["2"];
}

function filtros(agora: Date): DashboardFilters {
  return {
    ...EMPTY_FILTERS,
    from: format(addMonths(agora, -14), "yyyy-MM-dd"),
    to: format(agora, "yyyy-MM-dd"),
    tipoManutencao: "Todos",
    somenteMedicos: false,
    empresaIds: empresaIds(),
  };
}

function mesmaData(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function mesmoMes(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function inicioDaSemana(dia: Date) {
  const offset = dia.getDay() === 0 ? 6 : dia.getDay() - 1;
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - offset);
}

function dentroDaSemana(dia: Date, agora: Date) {
  const inicio = inicioDaSemana(agora);
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
  return dia.getTime() >= inicio.getTime() && dia.getTime() <= fim.getTime();
}

function ultimos30(dia: Date, agora: Date) {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 29);
  return dia.getTime() >= inicio.getTime() && dia.getTime() <= agora.getTime();
}

function meses(agora: Date) {
  return Array.from({ length: 6 }, (_, index) => new Date(agora.getFullYear(), agora.getMonth() - (5 - index), 1));
}

function formatoMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatoIdade(ms: number) {
  const minutos = Math.max(0, Math.floor(ms / 60_000));
  const dias = Math.floor(minutos / (60 * 24));
  const horas = Math.floor((minutos % (60 * 24)) / 60);
  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
  if (horas > 0) return `${horas}h`;
  return `${minutos}min`;
}

function mediana(valores: number[]) {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function percentual(parte: number, total: number) {
  if (!total) return null;
  return Math.round((parte / total) * 100);
}

function ordemCriticidade(horas: number | null) {
  if (horas == null) return 3;
  if (horas <= 2) return 0;
  if (horas <= 4) return 1;
  return 2;
}

function aberta(os: OsAnaliticoItem) {
  if (isOsCancelada(os)) return false;
  if (semAcento(os.SituacaoDaOS) === "FECHADA") return false;
  return osFechamentoDate(os) == null;
}

export function montarSnapshotDeDados(
  dados: DadosSala,
  agora = nowInSaoPaulo(),
  configBase: HorarioUtilConfig = horarioUtilConfig(),
): SalaSnapshot {
  const manuais = dados.manuais;
  const feriados = new Set([
    ...configBase.feriados,
    ...((manuais?.feriados ?? []).map((item) => item.data)),
  ]);
  const config: HorarioUtilConfig = { ...configBase, feriados };
  const tagsMedicas = new Set(
    dados.equipamentos.filter(isEquipamentoMedico).map((item) => texto(item.Tag)).filter(Boolean),
  );
  const porTag = new Map<string, EquipamentoItem>();
  for (const item of dados.equipamentos) {
    const tag = texto(item.Tag);
    if (tag) porTag.set(tag, item);
  }
  const parados = new Set(
    (dados.disponibilidade ?? [])
      .filter((item) => item.PossuiOSParadaSemFuncionamento)
      .map((item) => texto(item.Tag))
      .filter(Boolean),
  );

  const vistas: OsVista[] = [];
  for (const os of dados.os) {
    const tag = texto(os.Tag);
    if (!tag || !isOficinaEngenhariaClinica(os.Oficina)) continue;
    const noParque = tagsMedicas.size > 0 ? tagsMedicas.has(tag) : isTipoManutencaoMedica(os.TipoDeManutencao);
    if (!noParque) continue;
    const equipamento = porTag.get(tag);
    const classe = classeManutencao(os.TipoDeManutencao);
    const metaHoras = metaHorasEsforco(equipamento?.Criticidade, os.Prioridade);
    const atendimento = parsePbiDate(os.DataDoAtendimento);
    const abertura = parsePbiDate(os.Abertura);
    const fechamento = osFechamentoDate(os);
    const encerrada = !aberta(os);
    const horas = abertura ? diffHorasUteis(abertura, atendimento ?? agora, config) : 0;
    const etapa = etapaOs({
      encerrada,
      classe,
      pendencia: `${os.Pendencia ?? ""} ${os.PendenciaAberta ?? ""}`,
      assistencia: os.Assistencia ?? "",
      observacao: os.ObservacaoDaOS ?? "",
      temAtendimento: Boolean(atendimento),
    });
    vistas.push({
      os,
      tag,
      abertura,
      atendimento,
      fechamento,
      encerrada,
      classe,
      metaHoras,
      criticidade: rotuloCriticidade(equipamento?.Criticidade || os.Prioridade),
      criticidadeOrdem: ordemCriticidade(metaHoras),
      situacao: situacaoPrimeiroAtendimento({
        atendida: Boolean(atendimento),
        horasDecorridas: horas,
        metaHoras,
      }),
      etapa: etapa.etapa,
      parado: parados.has(tag) || (!encerrada && classeDemanda(classe)),
      compra: classe === "compra" || semAcento(`${os.Pendencia ?? ""} ${os.PendenciaAberta ?? ""}`).includes("COMPRA"),
    });
  }

  const demandaAberta = vistas.filter((item) => !item.encerrada && classeDemanda(item.classe));
  const semAtendimento = demandaAberta.filter((item) => !item.atendimento);
  const grave = semAtendimento.filter((item) => item.situacao === "GRAVE");
  const fora = semAtendimento.filter((item) => item.situacao === "GRAVE" || item.situacao === "ATRASADA");

  const filaOrdenada = ordenarFila(
    semAtendimento.map((item) => ({
      item,
      id: item.os.OS,
      tipo: "os" as const,
      situacao: item.situacao,
      criticidadeOrdem: item.criticidadeOrdem,
      parado: item.parado,
      aberturaMs: item.abertura?.getTime() ?? Number.MAX_SAFE_INTEGER,
    })),
  );
  const fila = filaOrdenada.slice(0, FILA_LIMITE).map(({ item }) => ({
    os: texto(item.os.OS) || "—",
    equipamento: texto(item.os.Equipamento) || "—",
    tag: item.tag,
    setor: texto(item.os.Setor) || "—",
    situacao: item.situacao,
    criticidade: item.criticidade,
    parado: item.parado,
    compra: item.compra,
    idade: item.abertura ? formatoIdade(agora.getTime() - item.abertura.getTime()) : "—",
  }));

  const noPrazo30 = vistas.filter(
    (item) =>
      item.atendimento &&
      ultimos30(item.atendimento, agora) &&
      item.metaHoras != null &&
      item.abertura &&
      classeDemanda(item.classe),
  );
  const noPrazo30Ok = noPrazo30.filter((item) => {
    const horas = diffHorasUteis(item.abertura as Date, item.atendimento as Date, config);
    return horas <= (item.metaHoras as number);
  });

  const abertasNo = (predicado: (data: Date) => boolean) =>
    vistas.filter((item) => item.abertura && predicado(item.abertura) && classeDemanda(item.classe)).length;
  const fechadasNo = (predicado: (data: Date) => boolean) =>
    vistas.filter((item) => item.fechamento && !isOsCancelada(item.os) && predicado(item.fechamento) && classeDemanda(item.classe)).length;

  const plantao = !dentroDoExpediente(agora, config);
  const criticos = (dados.disponibilidade ?? []).filter((item) => semAcento(item.Criticidade).includes("ALTA"));
  const disponibilidadeCriticos = criticos.length
    ? Math.round(
        criticos.reduce((soma, item) => soma + (item.DisponibilidadePercentualPeriodo || 0), 0) / criticos.length,
      )
    : null;

  const diasParadoDe = (item: DisponibilidadeItem) => {
    if (item.DiasParado != null) return item.DiasParado;
    const ultimo = [...(item.DisponibilidadeMensal ?? [])].sort((a, b) => a.Ano - b.Ano || a.Mes - b.Mes).at(-1);
    return ultimo?.DiasParado ?? null;
  };
  const paradosPorOs = demandaAberta
    .filter((item) => item.abertura)
    .sort((a, b) => (a.abertura?.getTime() ?? 0) - (b.abertura?.getTime() ?? 0))
    .slice(0, 4)
    .map((item) => ({
      nome: `${texto(item.os.Equipamento) || "Equipamento"} · ${item.tag}`,
      setor: texto(item.os.Setor) || "—",
      // Proxy: início da parada = Abertura da OS (Parada/Funcionamento quase vazios na API).
      tempo: item.abertura ? `${diasDesde(item.abertura, agora)}d desde abertura` : "—",
    }));
  const paradosLista =
    paradosPorOs.length > 0
      ? paradosPorOs
      : (dados.disponibilidade ?? [])
          .filter((item) => item.PossuiOSParadaSemFuncionamento)
          .sort((a, b) => (diasParadoDe(b) ?? 0) - (diasParadoDe(a) ?? 0))
          .slice(0, 4)
          .map((item) => {
            const dias = diasParadoDe(item);
            return {
              nome: `${texto(item.EquipamentoDescricaoCompleta).split(" ").slice(0, 4).join(" ") || "Equipamento"} · ${texto(item.Tag) || "—"}`,
              setor: texto(item.SetorDescricao) || "—",
              tempo: dias != null && dias > 0 ? `${dias}d no mês` : "sem volta",
            };
          });
  const paradosAgora = new Set<string>([
    ...parados,
    ...demandaAberta.map((item) => item.tag).filter(Boolean),
  ]);

  const etapasFluxo = ETAPAS.filter((etapa) => etapa !== "Encerrada").map((etapa) => {
    const grupo = demandaAberta.filter((item) => item.etapa === etapa);
    const maisAntiga = [...grupo].sort((a, b) => (a.abertura?.getTime() ?? 0) - (b.abertura?.getTime() ?? 0))[0];
    return {
      etapa,
      quantidade: grupo.length,
      maisAntiga: maisAntiga?.abertura ? `${diasDesde(maisAntiga.abertura, agora)}d` : "—",
      exemplos: grupo.slice(0, 2).map((item) => {
        const base = `${texto(item.os.Equipamento) || item.tag} · ${texto(item.os.Setor) || "—"}`;
        if (etapa !== "Aguarda peça/compra") return base;
        const sc =
          extrairSc(item.os.ObservacaoDaPendencia ?? "") ||
          extrairSc(item.os.Pendencia ?? "") ||
          extrairSc(item.os.ObservacaoDaOS ?? "");
        return sc ? `${base} · SC ${sc}` : base;
      }),
    };
  });

  const programadasMes = resumoProgramadasMes(dados.cronograma, dados.os, agora);
  const tagsMedicasLista = [...tagsMedicas];
  const tmefValores = dados.tmef
    .filter((item) => {
      const tag = texto(item.Tag);
      return !tagsMedicasLista.length || (tag && tagsMedicas.has(tag));
    })
    .map((item) => parseBrNumber(item.MTBF))
    .filter((valor): valor is number => valor != null && valor > 0);
  const tmefMediana = mediana(tmefValores);

  const entraramHoje = vistas
    .filter((item) => item.abertura && mesmaData(item.abertura, agora) && classeDemanda(item.classe))
    .sort((a, b) => (b.abertura?.getTime() ?? 0) - (a.abertura?.getTime() ?? 0));

  const abertasDemanda = demandaAberta.filter((item) => item.abertura);
  const faixas = FAIXAS_IDADE.map((faixa) => {
    const grupo = abertasDemanda.filter((item) => faixaIdadeDias(diasDesde(item.abertura as Date, agora)) === faixa.id);
    const partesMap = new Map<string, number>();
    for (const item of grupo) partesMap.set(item.etapa, (partesMap.get(item.etapa) ?? 0) + 1);
    return {
      id: faixa.id,
      label: faixa.label,
      total: grupo.length,
      partes: [...partesMap.entries()].map(([etapa, quantidade]) => ({ etapa, quantidade })),
    };
  });
  const idadeMediaDias = abertasDemanda.length
    ? Math.round(
        abertasDemanda.reduce((soma, item) => soma + diasDesde(item.abertura as Date, agora), 0) / abertasDemanda.length,
      )
    : null;

  const ativos = dados.equipamentos.filter((item) => isEquipamentoMedico(item) && semAcento(item.Status) === "ATIVO");
  const inativos = dados.equipamentos.filter((item) => isEquipamentoMedico(item) && semAcento(item.Status) === "INATIVO");
  const corretivasPorTag = new Map<string, { quantidade: number; custo: number }>();
  const limite12 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 365);
  for (const item of vistas) {
    if (item.classe !== "corretiva" || isOsCancelada(item.os) || !item.abertura || item.abertura < limite12) continue;
    const atual = corretivasPorTag.get(item.tag) ?? { quantidade: 0, custo: 0 };
    atual.quantidade += 1;
    atual.custo += parseMoeda(item.os.Custo) ?? 0;
    corretivasPorTag.set(item.tag, atual);
  }

  const faixasIdade = [
    { faixa: "0 a 5 anos", min: 0, max: 5 },
    { faixa: "6 a 10 anos", min: 6, max: 10 },
    { faixa: "11 a 15 anos", min: 11, max: 15 },
    { faixa: "16 a 20 anos", min: 16, max: 20 },
    { faixa: "mais de 20", min: 21, max: 80 },
  ];
  const histograma = faixasIdade.map((faixa) => ({ faixa: faixa.faixa, emVida: 0, alem: 0 }));
  const fimDeVida: SalaSnapshot["ciclo"]["fimDeVida"] = [];
  const maisAntigos: Array<{ tag: string; equipamento: string; idade: string; fim: string; ms: number }> = [];
  let valorParque = 0;
  let valorFimDeVida = 0;
  let emCiclo = 0;
  const anoAtual = agora.getFullYear();
  const previsaoEol = Array.from({ length: 5 }, (_, index) => ({
    ano: String(anoAtual + index),
    quantidade: 0,
  }));
  const limite5Anos = new Date(agora.getFullYear() + 5, agora.getMonth(), agora.getDate());

  for (const item of ativos) {
    const aquisicao = parsePbiDate(item.DataDeAquisicao) || parsePbiDate(item["DataDeInstalação"]);
    const fim = parsePbiDate(item.EndOfLife);
    const fimServico = parsePbiDate(item.EndOfService);
    const substituicao = parseMoeda(item.ValorDeSubstituicao);
    const aquisicaoValor = parseMoeda(item.ValorDeAquisicao);
    const valor = substituicao && substituicao > 0 ? substituicao : aquisicaoValor && aquisicaoValor > 0 ? aquisicaoValor : 0;
    valorParque += valor;
    const idadeAnos = aquisicao ? (agora.getTime() - aquisicao.getTime()) / (365.25 * 24 * 3600 * 1000) : null;
    const alem = Boolean(fim && agora.getTime() >= fim.getTime());
    const semPeca = Boolean(fimServico && agora.getTime() >= fimServico.getTime());
    if (fim && agora.getTime() < fim.getTime()) emCiclo += 1;
    if (fim && agora.getTime() < fim.getTime() && fim.getTime() <= limite5Anos.getTime()) {
      const anoFim = fim.getFullYear();
      const slot = previsaoEol.find((itemAno) => Number(itemAno.ano) === anoFim);
      if (slot) slot.quantidade += 1;
    }
    if (idadeAnos != null) {
      const bucket = faixasIdade.findIndex((faixa) => idadeAnos >= faixa.min && idadeAnos <= faixa.max + 0.999);
      if (bucket >= 0) {
        if (alem) histograma[bucket].alem += 1;
        else histograma[bucket].emVida += 1;
      }
      maisAntigos.push({
        tag: texto(item.Tag),
        equipamento: texto(item.Equipamento) || "—",
        idade: `${Math.floor(idadeAnos)} anos`,
        fim: fim ? format(fim, "dd/MM/yyyy") : "—",
        ms: aquisicao?.getTime() ?? Number.MAX_SAFE_INTEGER,
      });
    }
    const uso = corretivasPorTag.get(texto(item.Tag));
    const criterios: string[] = [];
    if (alem) criterios.push("fim de vida");
    if (semPeca) criterios.push("sem peça / descontinuado");
    if ((uso?.quantidade ?? 0) >= 4) criterios.push("4+ corretivas");
    if (valor > 0 && (uso?.custo ?? 0) >= valor * 0.5) criterios.push("custo ≥ 50%");
    if (criterios.length) {
      valorFimDeVida += valor;
      fimDeVida.push({
        tag: texto(item.Tag),
        equipamento: texto(item.Equipamento) || "—",
        pontos: criterios.length,
        criterios: criterios.join(" · "),
        valorSubstituicao: valor > 0 ? formatoMoeda(valor) : "—",
      });
    }
  }
  fimDeVida.sort((a, b) => b.pontos - a.pontos || a.tag.localeCompare(b.tag));
  maisAntigos.sort((a, b) => a.ms - b.ms);
  const vencem5Anos = previsaoEol.reduce((soma, item) => soma + item.quantidade, 0);

  const listaMeses = meses(agora);
  const serieHoras: Array<number | null> = [];
  const seriePrazo: Array<number | null> = [];
  const serieCausa: Array<number | null> = [];
  const serieCusto: Array<number | null> = [];
  const serieTreino: Array<number | null> = [];
  const serieProgramadas: Array<number | null> = [];
  for (const mes of listaMeses) {
    serieProgramadas.push(resumoProgramadasMes(dados.cronograma, dados.os, mes).percentual);
    const atendidas = vistas.filter(
      (item) =>
        item.atendimento &&
        mesmoMes(item.atendimento, mes) &&
        item.abertura &&
        item.metaHoras != null &&
        item.classe === "corretiva",
    );
    const horas = atendidas.map((item) => diffHorasUteis(item.abertura as Date, item.atendimento as Date, config));
    const media = mediana(horas);
    serieHoras.push(media == null ? null : Math.round(media * 10) / 10);
    seriePrazo.push(percentual(horas.filter((hora, index) => hora <= (atendidas[index].metaHoras as number)).length, atendidas.length));
    const fechadas = vistas.filter(
      (item) => item.fechamento && mesmoMes(item.fechamento, mes) && item.classe === "corretiva" && !isOsCancelada(item.os),
    );
    const semCausa = fechadas.filter((item) => !texto(item.os.Causa)).length;
    serieCausa.push(percentual(semCausa, fechadas.length));
    const custo = fechadas.reduce((soma, item) => soma + (parseMoeda(item.os.Custo) ?? 0), 0);
    serieCusto.push(valorParque > 0 ? Math.round((custo / valorParque) * 1000) / 10 : null);
    serieTreino.push(vistas.filter((item) => item.abertura && mesmoMes(item.abertura, mes) && item.classe === "treinamento").length);
  }

  const foraDoHorario = vistas.filter(
    (item) => item.abertura && mesmoMes(item.abertura, agora) && !dentroDoExpediente(item.abertura, config),
  ).length;

  const rotulosMes = listaMeses.map((mes) => format(mes, "MMM/yy"));
  const ultimo = <T,>(serie: T[]) => serie[serie.length - 1];

  const blocos: SalaSnapshot["blocos"] = [
    { id: "os", fonte: dados.erroOs ? "sem-dados" : "api", erro: dados.erroOs },
    { id: "equipamentos", fonte: dados.erroEquipamentos ? "sem-dados" : "api", erro: dados.erroEquipamentos },
    {
      id: "disponibilidade",
      fonte: dados.erroDisponibilidade || !dados.disponibilidade ? "sem-dados" : "api",
      erro: dados.erroDisponibilidade,
    },
    { id: "tpm", fonte: dados.erroTmef || tmefMediana == null ? "sem-dados" : "api", erro: dados.erroTmef || (tmefMediana == null ? "Sem MTBF no TMEF." : undefined) },
    {
      id: "plano",
      fonte: dados.erroCronograma ? "sem-dados" : programadasMes.previstos ? "api" : "sem-dados",
      erro: dados.erroCronograma || (programadasMes.previstos ? undefined : programadasMes.aviso),
    },
    {
      id: "compras",
      fonte: (() => {
        const resumo = resumoComprasTv(agora);
        if (resumo.pedidos.length || resumo.entreguesMes) return m365Configurado() ? "api" : "manual";
        if (m365Configurado()) return "api";
        return "sem-dados";
      })(),
      erro: undefined,
    },
    { id: "mao-de-obra", fonte: "sem-dados", erro: "A API não traz o lançamento de mão de obra." },
    { id: "manuais", fonte: "manual" },
  ];

  const impedimentos = (manuais?.impedimentos ?? []).map((item) => ({
    tag: item.tag,
    equipamento: item.equipamento || "—",
    motivo: item.motivo,
    novaData: item.nova_data || "—",
  }));
  const treinamentosMes = (manuais?.treinamentos ?? []).filter((item) => {
    const data = parsePbiDate(item.data) || (/^\d{4}-\d{2}-\d{2}$/.test(item.data) ? new Date(`${item.data}T12:00:00`) : null);
    return data && mesmoMes(data, agora);
  });
  const participantesMes = treinamentosMes.reduce((soma, item) => soma + (item.participantes || 0), 0);
  const melhoriasLista = (manuais?.melhorias ?? []).map((item) => ({
    item: item.item,
    status: item.status,
  }));

  return {
    atualizadoEm: new Date().toISOString(),
    relogio: format(agora, "HH:mm"),
    plantao,
    plantaoTexto: plantao
      ? "Fora do horário da EC (7h–17h). Plantão: Manutenção. Prazos voltam às 07:00."
      : "Horário da Engenharia Clínica, 7h às 17h.",
    segundos: Number(process.env.SALA_SEGUNDOS ?? 30) || 30,
    sequencia: sequencia(),
    alertas: [],
    blocos,
    agora: {
      grave: grave.length,
      foraDoPrazo: fora.length,
      semPrimeiro: semAtendimento.length,
      parados: dados.disponibilidade || paradosAgora.size ? paradosAgora.size : null,
      proxyParada:
        "Parada aproximada pela OS (Abertura→Fechamento). Campos Parada/Funcionamento quase vazios na API.",
      plano: planoAgoraCards(programadasMes).map((item) => ({
        tipo: item.tipo,
        faltam: item.faltam,
        percentual: item.percentual,
        executados: programadasMes.porTipo.find((tipo) => tipo.tipo === item.tipo)?.executados ?? null,
        previstos: programadasMes.porTipo.find((tipo) => tipo.tipo === item.tipo)?.previstos ?? null,
      })),
      planoAviso: programadasMes.previstos
        ? `${programadasMes.executados} de ${programadasMes.previstos} no mês · ${programadasMes.percentual ?? "—"}%.`
        : programadasMes.aviso,
      paradosMaisTempo: paradosLista,
      fila,
      filaOcultas: Math.max(0, filaOrdenada.length - FILA_LIMITE),
      hojeAbertas: abertasNo((data) => mesmaData(data, agora)),
      hojeFechadas: fechadasNo((data) => mesmaData(data, agora)),
      semanaAbertas: abertasNo((data) => dentroDaSemana(data, agora)),
      semanaFechadas: fechadasNo((data) => dentroDaSemana(data, agora)),
      primeiroNoPrazo30d: percentual(noPrazo30Ok.length, noPrazo30.length),
      tpm30d: tmefMediana == null ? null : Math.round(tmefMediana),
      disponibilidadeCriticos,
    },
    fluxo: {
      entraramHoje: entraramHoje.length,
      etapas: etapasFluxo,
      encerradasHoje: fechadasNo((data) => mesmaData(data, agora)),
      entraram: entraramHoje.slice(0, FLUXO_LIMITE).map((item) => ({
        hora: item.abertura ? format(item.abertura, "HH:mm") : "—",
        os: texto(item.os.OS) || "—",
        equipamento: texto(item.os.Equipamento) || "—",
        setor: texto(item.os.Setor) || "—",
        prioridade: item.criticidade,
        situacao: item.situacao === "ATENDIDA" ? "Atendida" : item.situacao,
      })),
      entraramOcultas: Math.max(0, entraramHoje.length - FLUXO_LIMITE),
      equipeAviso: "A equipe por lançamento de mão de obra não vem na API.",
    },
    envelhecimento: (() => {
      const diasSemMovimento = (item: (typeof demandaAberta)[number]) => {
        const ancora = item.atendimento ?? item.abertura;
        return ancora ? diasDesde(ancora, agora) : null;
      };
      const maisAntigas = [...abertasDemanda]
        .sort((a, b) => (a.abertura?.getTime() ?? 0) - (b.abertura?.getTime() ?? 0))
        .slice(0, ANTIGAS_LIMITE)
        .map((item) => {
          const dias = diasSemMovimento(item);
          return {
            os: texto(item.os.OS) || "—",
            equipamento: texto(item.os.Equipamento) || "—",
            setor: texto(item.os.Setor) || "—",
            idade: item.abertura ? `${diasDesde(item.abertura, agora)}d` : "—",
            semMovimento:
              dias == null
                ? "—"
                : item.atendimento
                  ? `${dias}d desde 1º at.`
                  : `${dias}d sem 1º at.`,
            etapa: item.etapa,
          };
        });
      const semMovimentoMais7 = abertasDemanda.filter((item) => {
        const dias = diasSemMovimento(item);
        return dias != null && dias > 7;
      }).length;
      return {
        faixas,
        maisAntigas,
        idadeMediaDias,
        aguardandoTerceiros: demandaAberta.filter(
          (item) => item.etapa === "Reparo externo" || item.etapa === "Contrato/assistência",
        ).length,
        semMovimentoMais7,
        pendenciaSemMotivo: demandaAberta.filter(
          (item) => semAcento(item.os.SituacaoDaOS) === "PENDENTE" && !texto(item.os.Pendencia),
        ).length,
        proxy:
          "Sem movimento ≈ dias desde DataDoAtendimento (ou desde Abertura se ainda sem 1º atendimento).",
      };
    })(),
    compras: (() => {
      const resumo = resumoComprasTv(agora);
      const aviso = resumo.pedidos.length
        ? ""
        : resumo.configurado
          ? "Sem pedidos em aberto. Cadastre em /sala/pedidos ou sincronize o Outlook."
          : "Cadastre pedidos em /sala/pedidos (manual) ou configure M365 (docs/sala/m365-setup.md) para importar do e-mail.";
      return {
        aviso,
        configurado: resumo.configurado,
        aguardaSc: resumo.aguardaSc,
        aguardaScMaisAntigo: resumo.aguardaScMaisAntigo,
        aguardaEntrega: resumo.aguardaEntrega,
        aguardaEntregaMaisAntiga: resumo.aguardaEntregaMaisAntiga,
        entreguesMes: resumo.entreguesMes,
        mediaEmailSc: resumo.mediaEmailSc,
        mediaScEntrega: resumo.mediaScEntrega,
        mediaPontaAPonta: resumo.mediaPontaAPonta,
        percentualComOs: resumo.percentualComOs,
        semOs: resumo.semOs,
        pedidos: resumo.pedidos,
      };
    })(),
    programadas: {
      aviso: programadasMes.aviso,
      proxy:
        "Executada = OS de plano fechada no mês. Effort não envia data de laudo — o ciclo da OS (abertura→fechamento) vale como execução.",
      cumprimento: programadasMes.percentual,
      previstos: programadasMes.previstos,
      executados: programadasMes.executados,
      faltam: programadasMes.faltam,
      porTipo: programadasMes.porTipo,
      pendentes: programadasMes.pendentes,
      impedimentos,
    },
    ciclo: {
      trilha: [
        { etapa: "Aquisição", quantidade: manuais?.aquisicoes.length ?? null },
        { etapa: "Recebimento", quantidade: null },
        { etapa: "Em uso", quantidade: ativos.length },
        { etapa: "Fim de vida", quantidade: fimDeVida.length },
        { etapa: "Inservível", quantidade: inativos.length },
      ],
      histograma,
      fimDeVida: fimDeVida.slice(0, 8),
      valorSubstituicaoFimDeVida: valorFimDeVida > 0 ? formatoMoeda(valorFimDeVida) : "—",
      quantidadeFimDeVida: fimDeVida.length,
      avisoDescontinuado:
        "Sem peça / descontinuado = EndOfService já passou. Fim de vida = EndOfLife (Anvisa), inclusive 01/01/2050.",
      maisAntigos: maisAntigos.slice(0, 6).map(({ ms: _ms, ...item }) => item),
      emCiclo,
      vencem5Anos,
      previsaoEol,
    },
    indicadores: {
      meses: rotulosMes,
      cartoes: [
        {
          titulo: "Tempo do 1º atendimento",
          valor: ultimo(serieHoras) == null ? "—" : `${ultimo(serieHoras)} h`,
          detalhe: "Mediana das corretivas do mês, em horas úteis. Data do atendimento no Effort.",
          serie: serieHoras,
          fonte: "api",
        },
        {
          titulo: "% no prazo",
          valor: ultimo(seriePrazo) == null ? "—" : `${ultimo(seriePrazo)}%`,
          detalhe: "Meta lida do texto de criticidade ou da prioridade da OS.",
          serie: seriePrazo,
          fonte: "api",
        },
        {
          titulo: "Programadas no mês",
          valor: ultimo(serieProgramadas) == null ? "—" : `${ultimo(serieProgramadas)}%`,
          detalhe: programadasMes.previstos
            ? `${programadasMes.executados} de ${programadasMes.previstos} no mês corrente (cronograma × OS fechadas).`
            : "Sem plano ancorado neste mês no cronograma.",
          serie: serieProgramadas,
          fonte: dados.erroCronograma ? "sem-dados" : "api",
        },
        {
          titulo: "Corretivas sem causa",
          valor: ultimo(serieCausa) == null ? "—" : `${ultimo(serieCausa)}%`,
          detalhe: "Fechadas no mês com o campo Causa vazio.",
          serie: serieCausa,
          fonte: "api",
        },
        {
          titulo: "Custo de reparo / parque",
          valor: ultimo(serieCusto) == null ? "—" : `${ultimo(serieCusto)}%`,
          detalhe: valorParque
            ? `Só custo de OS ÷ valor de substituição (${formatoMoeda(valorParque)}). Sem contratos.`
            : "Sem valor de parque.",
          serie: serieCusto,
          fonte: "api",
        },
        {
          titulo: "TMEF (em vez de TPM)",
          valor: tmefMediana == null ? "—" : `${Math.round(tmefMediana)} h`,
          detalhe: dados.erroTmef
            ? dados.erroTmef
            : tmefValores.length
              ? `Mediana de MTBF (${tmefValores.length} eq.). A API de TPM continua 404.`
              : "Sem MTBF no TMEF para o parque médico.",
          serie: listaMeses.map((_, index) => (index === listaMeses.length - 1 ? (tmefMediana == null ? null : Math.round(tmefMediana)) : null)),
          fonte: tmefMediana == null ? "sem-dados" : "api",
        },
        {
          titulo: "Disponibilidade dos críticos",
          valor: disponibilidadeCriticos == null ? "—" : `${disponibilidadeCriticos}%`,
          detalhe: criticos.length ? `${criticos.length} equipamentos de criticidade alta no período.` : "Sem disponibilidade.",
          serie: listaMeses.map((_, index) => (index === listaMeses.length - 1 ? disponibilidadeCriticos : null)),
          fonte: dados.disponibilidade ? "api" : "sem-dados",
        },
        {
          titulo: "Capacitação",
          valor: String(participantesMes || ultimo(serieTreino) || 0),
          detalhe: participantesMes
            ? `${treinamentosMes.length} treinamento(s) manuais no mês · ${participantesMes} participantes.`
            : "OS de treinamento no mês. Participantes e evidência vêm do registro manual.",
          serie: serieTreino,
          fonte: participantesMes ? "manual" : "api",
        },
      ],
    },
    processos: {
      // TV: só P01–P03 sustentados por API. P04–P07 ficam em /sala/registros, sem cartão na rotação.
      itens: [
        { id: "P01", nome: "Corretivas abertas", quantidade: String(demandaAberta.length), fonte: "api" },
        {
          id: "P02",
          nome: "Programadas no mês",
          quantidade: programadasMes.previstos
            ? `${programadasMes.executados}/${programadasMes.previstos}`
            : "—",
          fonte: programadasMes.previstos ? "api" : "sem-dados",
        },
        { id: "P03", nome: "Parque em uso", quantidade: String(ativos.length), fonte: "api" },
      ],
      foraDoHorario,
      melhorias: melhoriasLista.length
        ? `${melhoriasLista.filter((item) => item.status !== "feito").length} em aberto de ${melhoriasLista.length}`
        : "Nenhuma melhoria registrada ainda em /sala/registros.",
      melhoriasLista,
    },
  };
}

function sequencia(): TelaSala[] {
  const bruta = (process.env.SALA_SEQUENCIA ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const validas = bruta.filter((item): item is TelaSala => SEQUENCIA_PADRAO.includes(item as TelaSala));
  return validas.length ? validas : SEQUENCIA_PADRAO;
}

const cacheSnapshot = {
  expira: 0,
  valor: null as SalaSnapshot | null,
  graves: new Set<string>(),
};

export function invalidarCacheSnapshot() {
  cacheSnapshot.expira = 0;
  cacheSnapshot.valor = null;
}

export async function carregarSnapshot(): Promise<SalaSnapshot> {
  if (cacheSnapshot.valor && cacheSnapshot.expira > Date.now()) return cacheSnapshot.valor;
  if (m365Configurado()) {
    try {
      await sincronizarCompras();
    } catch {
      // Sync não derruba o snapshot da TV.
    }
  }
  const agora = nowInSaoPaulo();
  const base = filtros(agora);
  const inicioMes = format(new Date(agora.getFullYear(), agora.getMonth(), 1), "yyyy-MM-dd");
  const [os, equipamentos, disponibilidade, cronograma, tmef, manuais] = await Promise.all([
    fetchPbi<OsAnaliticoItem[]>(
      "os-analitico",
      toUpstreamParams("os-analitico", base, { periodo: "DoisAnosAtuais", qtdPorPagina: "100000" }),
    ),
    fetchPbi<EquipamentoItem[]>(
      "equipamentos",
      toUpstreamParams("equipamentos", base, { apenasAtivos: "false", incluirCustoSubstituicao: "true" }),
    ),
    fetchPbi<DisponibilidadeItem[]>(
      "disp-equipamento-mes",
      toUpstreamParams("disp-equipamento-mes", { ...base, from: inicioMes }),
    ),
    fetchPbi<CronogramaItem[]>("cronograma", toUpstreamParams("cronograma", base)),
    fetchPbi<TmefItem[]>("tmef", toUpstreamParams("tmef", base)),
    Promise.resolve(listarRegistrosSala()),
  ]);

  const dados: DadosSala = {
    os: os.ok && Array.isArray(os.data) ? os.data : [],
    equipamentos: equipamentos.ok && Array.isArray(equipamentos.data) ? equipamentos.data : [],
    disponibilidade: disponibilidade.ok && Array.isArray(disponibilidade.data) ? disponibilidade.data : null,
    cronograma: cronograma.ok && Array.isArray(cronograma.data) ? cronograma.data : [],
    tmef: tmef.ok && Array.isArray(tmef.data) ? tmef.data : [],
    manuais,
    erroOs: os.ok ? undefined : os.message,
    erroEquipamentos: equipamentos.ok ? undefined : equipamentos.message,
    erroDisponibilidade: disponibilidade.ok ? undefined : disponibilidade.message,
    erroCronograma: cronograma.ok ? undefined : cronograma.message,
    erroTmef: tmef.ok ? undefined : tmef.message,
  };
  const snapshot = montarSnapshotDeDados(dados, agora);
  const gravesAgora = new Set(snapshot.agora.fila.filter((item) => item.situacao === "GRAVE").map((item) => item.os));
  if (cacheSnapshot.valor) {
    snapshot.alertas = [...gravesAgora]
      .filter((osNumero) => !cacheSnapshot.graves.has(osNumero))
      .map((osNumero) => ({ os: osNumero, motivo: "Passou a atraso grave" }));
  }
  cacheSnapshot.graves = gravesAgora;
  cacheSnapshot.valor = snapshot;
  cacheSnapshot.expira = Date.now() + 60_000;
  return snapshot;
}
