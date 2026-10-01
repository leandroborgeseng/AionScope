import { addMonths, format } from "date-fns";
import { listarRegistrosSala } from "@/lib/db/sala-registros";
import { fetchPbi } from "@/lib/pbi/client";
import { nowInSaoPaulo, parsePbiDate } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "@/lib/pbi/filters";
import { isTipoManutencaoMedica, isEquipamentoMedico } from "@/lib/pbi/medical";
import { isOficinaEngenhariaClinica } from "@/lib/pbi/oficina-ec";
import type { DisponibilidadeItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { isOsCancelada, osFechamentoDate } from "@/lib/pbi/volume-ec";
import { ETAPAS, etapaOs, type EtapaOs } from "./etapas";
import { diasDesde, FAIXAS_IDADE, faixaIdadeDias } from "./envelhecimento";
import { ordenarFila } from "./fila";
import { dentroDoExpediente, diffHorasUteis, horarioUtilConfig, type HorarioUtilConfig } from "./horario-util";
import { metaHorasEsforco, rotuloCriticidade } from "./meta";
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
  manuais?: ReturnType<typeof listarRegistrosSala>;
  erroOs?: string;
  erroEquipamentos?: string;
  erroDisponibilidade?: string;
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
      parado: parados.has(tag),
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
  const paradosLista = (dados.disponibilidade ?? [])
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

  const etapasFluxo = ETAPAS.filter((etapa) => etapa !== "Encerrada").map((etapa) => {
    const grupo = demandaAberta.filter((item) => item.etapa === etapa);
    const maisAntiga = [...grupo].sort((a, b) => (a.abertura?.getTime() ?? 0) - (b.abertura?.getTime() ?? 0))[0];
    return {
      etapa,
      quantidade: grupo.length,
      maisAntiga: maisAntiga?.abertura ? `${diasDesde(maisAntiga.abertura, agora)}d` : "—",
      exemplos: grupo.slice(0, 2).map((item) => `${texto(item.os.Equipamento) || item.tag} · ${texto(item.os.Setor) || "—"}`),
    };
  });

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

  for (const item of ativos) {
    const aquisicao = parsePbiDate(item.DataDeAquisicao) || parsePbiDate(item["DataDeInstalação"]);
    const fim = parsePbiDate(item.EndOfLife);
    const substituicao = parseMoeda(item.ValorDeSubstituicao);
    const aquisicaoValor = parseMoeda(item.ValorDeAquisicao);
    const valor = substituicao && substituicao > 0 ? substituicao : aquisicaoValor && aquisicaoValor > 0 ? aquisicaoValor : 0;
    valorParque += valor;
    const idadeAnos = aquisicao ? (agora.getTime() - aquisicao.getTime()) / (365.25 * 24 * 3600 * 1000) : null;
    const alem = Boolean(fim && agora.getTime() >= fim.getTime());
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
    if ((uso?.quantidade ?? 0) >= 4) criterios.push("4+ corretivas");
    if (valor > 0 && (uso?.custo ?? 0) >= valor * 0.5) criterios.push("custo ≥ 50%");
    if (criterios.length) {
      fimDeVida.push({
        tag: texto(item.Tag),
        equipamento: texto(item.Equipamento) || "—",
        pontos: criterios.length,
        criterios: criterios.join(" · "),
      });
    }
  }
  fimDeVida.sort((a, b) => b.pontos - a.pontos || a.tag.localeCompare(b.tag));
  maisAntigos.sort((a, b) => a.ms - b.ms);

  const listaMeses = meses(agora);
  const serieHoras: Array<number | null> = [];
  const seriePrazo: Array<number | null> = [];
  const serieCausa: Array<number | null> = [];
  const serieCusto: Array<number | null> = [];
  const serieTreino: Array<number | null> = [];
  for (const mes of listaMeses) {
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
    { id: "tpm", fonte: "sem-dados", erro: "A API de TPM responde 404." },
    { id: "plano", fonte: "sem-dados", erro: "ProximaRealizacao é um código e DataDaUltima vem vazia." },
    { id: "compras", fonte: "sem-dados", erro: "Os pedidos de e-mail ainda não são lidos." },
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
      parados: dados.disponibilidade ? parados.size : null,
      plano: [
        { tipo: "Calibração", faltam: null, percentual: null },
        { tipo: "TSE", faltam: null, percentual: null },
        { tipo: "Preventiva", faltam: null, percentual: null },
      ],
      planoAviso: "Sem data de plano na API.",
      paradosMaisTempo: paradosLista,
      fila,
      filaOcultas: Math.max(0, filaOrdenada.length - FILA_LIMITE),
      hojeAbertas: abertasNo((data) => mesmaData(data, agora)),
      hojeFechadas: fechadasNo((data) => mesmaData(data, agora)),
      semanaAbertas: abertasNo((data) => dentroDaSemana(data, agora)),
      semanaFechadas: fechadasNo((data) => dentroDaSemana(data, agora)),
      primeiroNoPrazo30d: percentual(noPrazo30Ok.length, noPrazo30.length),
      tpm30d: null,
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
    envelhecimento: {
      faixas,
      maisAntigas: [...abertasDemanda]
        .sort((a, b) => (a.abertura?.getTime() ?? 0) - (b.abertura?.getTime() ?? 0))
        .slice(0, ANTIGAS_LIMITE)
        .map((item) => ({
          os: texto(item.os.OS) || "—",
          equipamento: texto(item.os.Equipamento) || "—",
          setor: texto(item.os.Setor) || "—",
          idade: item.abertura ? `${diasDesde(item.abertura, agora)}d` : "—",
          semMovimento: "—",
          etapa: item.etapa,
        })),
      idadeMediaDias,
      aguardandoTerceiros: demandaAberta.filter((item) => item.etapa === "Reparo externo" || item.etapa === "Contrato/assistência").length,
      semMovimentoMais7: null,
      pendenciaSemMotivo: demandaAberta.filter((item) => semAcento(item.os.SituacaoDaOS) === "PENDENTE" && !texto(item.os.Pendencia)).length,
    },
    compras: {
      aviso: "Pedidos de compra vêm do e-mail da AION. O conector ainda não está ligado, então esta tela não lista pedidos.",
      pedidos: [],
    },
    programadas: {
      aviso: "O cronograma não traz a data do plano. ProximaRealizacao é um código e DataDaUltima vem vazia. Cumprimento e laudo ficam sem número. Impedimentos vêm do registro manual.",
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
      avisoDescontinuado: "O 4º critério (fabricante descontinuado ou sem peça) não existe na API.",
      maisAntigos: maisAntigos.slice(0, 6).map(({ ms: _ms, ...item }) => item),
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
          valor: "—",
          detalhe: "Sem data de plano na API.",
          serie: listaMeses.map(() => null),
          fonte: "sem-dados",
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
          detalhe: valorParque ? `Parque ativo ${formatoMoeda(valorParque)} em valor de substituição.` : "Sem valor de parque.",
          serie: serieCusto,
          fonte: "api",
        },
        {
          titulo: "TPM",
          valor: "—",
          detalhe: "A API de TPM responde 404. O TMEF existe por equipamento, não como este cartão.",
          serie: listaMeses.map(() => null),
          fonte: "sem-dados",
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
      itens: [
        { id: "P01", nome: "Corretivas abertas", quantidade: String(demandaAberta.length), fonte: "api" },
        { id: "P02", nome: "Programadas", quantidade: "—", fonte: "sem-dados" },
        { id: "P03", nome: "Em uso", quantidade: String(ativos.length), fonte: "api" },
        {
          id: "P04",
          nome: "Aquisições",
          quantidade: manuais ? String(manuais.aquisicoes.length) : "—",
          fonte: "manual",
        },
        {
          id: "P05",
          nome: "Obras",
          quantidade: manuais ? String(manuais.obras.length) : "—",
          fonte: "manual",
        },
        {
          id: "P06",
          nome: "Treinamentos no mês",
          quantidade: String(treinamentosMes.length || ultimo(serieTreino) || 0),
          fonte: treinamentosMes.length ? "manual" : "api",
        },
        {
          id: "P07",
          nome: "Alertas e recall",
          quantidade: manuais ? String(manuais.alertas.length) : "—",
          fonte: "manual",
        },
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
  const agora = nowInSaoPaulo();
  const base = filtros(agora);
  const inicioMes = format(new Date(agora.getFullYear(), agora.getMonth(), 1), "yyyy-MM-dd");
  const [os, equipamentos, disponibilidade, manuais] = await Promise.all([
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
    Promise.resolve(listarRegistrosSala()),
  ]);

  const dados: DadosSala = {
    os: os.ok && Array.isArray(os.data) ? os.data : [],
    equipamentos: equipamentos.ok && Array.isArray(equipamentos.data) ? equipamentos.data : [],
    disponibilidade: disponibilidade.ok && Array.isArray(disponibilidade.data) ? disponibilidade.data : null,
    manuais,
    erroOs: os.ok ? undefined : os.message,
    erroEquipamentos: equipamentos.ok ? undefined : equipamentos.message,
    erroDisponibilidade: disponibilidade.ok ? undefined : disponibilidade.message,
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
