/**
 * Fixture 100% fictícia para o drill-down da Sala (T1 / R3 — repo público).
 * Números de OS no formato DEMO-xxxx, equipamentos e setores genéricos.
 *
 * Cobre: OS canceladas (abertas e "fechadas hoje"), faixa vazia em cada gráfico
 * (Envelhecimento "8 a 15 dias", Fluxo "Teste e devolução", Programadas TSE em fevereiro),
 * "+N" ocultas em "Entraram hoje" e uma OS cuja busca de detalhe na API falha.
 */
import { format } from "date-fns";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import type { DadosSala } from "./montar-snapshot";

/** Relógio fixo da fixture (parede America/Sao_Paulo): quinta, 15/10/2026 10:00. */
export function agoraFixtureSala() {
  return new Date(2026, 9, 15, 10, 0, 0);
}

/** OS cuja busca de detalhe "na API" falha no modo demo → cai no cache (C11). */
export const OS_FALHA_API_DEMO = "DEMO-1006";

function data(diasAtras: number, hora = 8, minuto = 0) {
  const base = agoraFixtureSala();
  return format(new Date(base.getFullYear(), base.getMonth(), base.getDate() - diasAtras, hora, minuto), "dd/MM/yyyy HH:mm");
}

function dataMes(month: number, dia: number, hora = 9) {
  return format(new Date(2026, month, dia, hora, 0), "dd/MM/yyyy HH:mm");
}

function equip(n: number): EquipamentoItem {
  const tag = `EQ-DEMO-${String(n).padStart(2, "0")}`;
  return {
    Id: n,
    Tag: tag,
    NSerie: "",
    Patrimonio: "",
    Equipamento: `Equipamento Demo ${n}`,
    Modelo: "Modelo Demo",
    Fabricante: "Fabricante Demo",
    Criticidade: n % 3 === 0 ? "Alta" : "Média",
    Prioridade: "",
    Cliente: "Cliente Demo",
    Setor: n % 2 ? "Setor Demo A" : "Setor Demo B",
    GrupoDeSetores: "",
    CentroDeCusto: "",
    DataDeAquisicao: "",
    ValorDeAquisicao: "",
    ValorDeSubstituicao: "",
    DataDeFabricacao: "",
    Status: "Ativo",
  } as unknown as EquipamentoItem;
}

type OsParcial = Partial<OsAnaliticoItem> & { OS: string };

function os(p: OsParcial): OsAnaliticoItem {
  return {
    CodigoSerialOS: 0,
    Empresa: "Empresa Demo",
    Oficina: "ENGENHARIA CLINICA",
    Responsavel: "Técnico Demo",
    Tipo: "",
    Prioridade: "Média",
    TipoDeManutencao: "A - Corretiva",
    SituacaoDaOS: "Aberta",
    ComplexidadeDaOS: "",
    PlanoDeManutencao: "",
    Tag: "EQ-DEMO-01",
    Equipamento: "Equipamento Demo 1",
    Modelo: "",
    Fabricante: "",
    Setor: "Setor Demo A",
    CentroDeCusto: "",
    Abertura: "",
    Parada: "",
    Funcionamento: "",
    Fechamento: "",
    Ocorrencia: "Ocorrência fictícia",
    Causa: "",
    Pendencia: "",
    PendenciaAberta: "",
    PrazoDeEncerramentoOs: "",
    Servico: "Serviço fictício de teste",
    HorasTrabalhadas: "",
    TecnicoResolvedor: "",
    Custo: "",
    Deslocamento: "",
    SLAAtendimento: "",
    ...p,
  } as OsAnaliticoItem;
}

function corretiva(numero: number, tagN: number, extra: Partial<OsAnaliticoItem>): OsAnaliticoItem {
  return os({
    OS: `DEMO-${numero}`,
    Tag: `EQ-DEMO-${String(tagN).padStart(2, "0")}`,
    Equipamento: `Equipamento Demo ${tagN}`,
    Setor: tagN % 2 ? "Setor Demo A" : "Setor Demo B",
    ...extra,
  });
}

function plano(numero: number, oficina: string, tipo: string, abertura: string, fechamento = "", situacao = ""): OsAnaliticoItem {
  return os({
    OS: `DEMO-${numero}`,
    Oficina: oficina,
    TipoDeManutencao: tipo,
    Tag: `EQ-DEMO-${String((numero % 12) + 1).padStart(2, "0")}`,
    Equipamento: `Equipamento Demo ${(numero % 12) + 1}`,
    Abertura: abertura,
    Fechamento: fechamento,
    SituacaoDaOS: situacao || (fechamento ? "Fechada" : "Aberta"),
  });
}

export function osFixtureSala(): OsAnaliticoItem[] {
  const lista: OsAnaliticoItem[] = [
    // até 2 dias — 1001 + 1009..1015 abertas hoje (8 → "Entraram hoje" com +2 ocultas)
    corretiva(1001, 1, { Abertura: data(0, 8, 10), Prioridade: "Alta" }),
    corretiva(1002, 2, { Abertura: data(1, 9), DataDoAtendimento: data(1, 11) } as Partial<OsAnaliticoItem>),
    // 3 a 7 dias
    corretiva(1003, 3, { Abertura: data(5, 10), DataDoAtendimento: data(5, 14), Pendencia: "Aguardando compra de peça", SituacaoDaOS: "Pendente" } as Partial<OsAnaliticoItem>),
    corretiva(1004, 4, { Abertura: data(6, 13), DataDoAtendimento: data(6, 15), Assistencia: "Assistência Demo" } as Partial<OsAnaliticoItem>),
    // 8 a 15 dias: só uma CANCELADA → faixa vazia
    corretiva(1090, 5, { Abertura: data(10, 9), SituacaoDaOS: "Cancelada", MotivoCancelamentoOS: "Duplicada (fictício)" }),
    // 16 a 30 dias
    corretiva(1005, 6, { Abertura: data(20, 8), DataDoAtendimento: data(19, 9), SituacaoDaOS: "Pendente" } as Partial<OsAnaliticoItem>),
    corretiva(1006, 7, { Abertura: data(25, 8), DataDoAtendimento: data(24, 9), ObservacaoDaOS: "CONTRATO de manutenção demo" } as Partial<OsAnaliticoItem>),
    // mais de 30 dias
    corretiva(1007, 8, { Abertura: data(45, 8), DataDoAtendimento: data(40, 9) } as Partial<OsAnaliticoItem>),
    // encerrada hoje (conta) e cancelada "fechada" hoje (não conta)
    corretiva(1008, 9, { Abertura: data(3, 8), DataDoAtendimento: data(3, 9), Fechamento: data(0, 9), SituacaoDaOS: "Fechada" } as Partial<OsAnaliticoItem>),
    corretiva(1091, 10, { Abertura: data(2, 8), Fechamento: data(0, 9, 30), SituacaoDaOS: "Cancelada" }),
  ];
  for (let i = 0; i < 7; i += 1) {
    lista.push(corretiva(1009 + i, 1 + (i % 12), { Abertura: data(0, 7, 5 + i * 6) }));
  }
  // Programadas: ano civil 2026, 3 oficinas de plano.
  let n = 2000;
  for (let month = 0; month <= 9; month += 1) {
    lista.push(plano(n++, "PREVENTIVA EQUIPAMENTOS", "Preventiva", dataMes(month, 3), dataMes(month, month === 9 ? 10 : 20)));
    lista.push(plano(n++, "PREVENTIVA EQUIPAMENTOS", "Preventiva", dataMes(month, 5)));
    lista.push(plano(n++, "CALIBRACAO DE EQUIPAMENTOS", "Calibração", dataMes(month, 7), month < 9 ? dataMes(month + 1, 2) : ""));
    // TSE vazio em fevereiro (faixa vazia do gráfico de Programadas).
    if (month !== 1) lista.push(plano(n++, "SEGURANCA ELETRICA", "Segurança Elétrica", dataMes(month, 9), dataMes(month, 12)));
  }
  // Preventiva cancelada em outubro (com Fechamento preenchido) — fora das contagens (PR #8).
  lista.push(plano(n++, "PREVENTIVA EQUIPAMENTOS", "Preventiva", dataMes(9, 6), dataMes(9, 8), "Cancelada"));
  return lista;
}

function cronogramaFixture(): CronogramaItem[] {
  const base = (tag: number, tipo: string): CronogramaItem => ({
    Empresa: "Empresa Demo",
    CentroDeCusto: "",
    Setor: "Setor Demo A",
    Equipamento: `Equipamento Demo ${tag}`,
    Fabricante: "",
    Modelo: "",
    Tag: `EQ-DEMO-${String(tag).padStart(2, "0")}`,
    PlanoDeManutencao: "Plano Demo",
    TipoDeManutencao: tipo,
    DataDaUltima: "",
    ProximaRealizacao: dataMes(9, 25),
    Perioridicade: "Mensal",
    Observacao: "",
  });
  return [base(1, "Preventiva"), base(2, "Preventiva"), base(3, "Calibração"), base(4, "Segurança Elétrica")];
}

export function dadosFixtureSala(): DadosSala {
  return {
    os: osFixtureSala(),
    equipamentos: Array.from({ length: 12 }, (_, i) => equip(i + 1)),
    disponibilidade: [],
    cronograma: cronogramaFixture(),
    tmef: [],
    manuais: {
      impedimentos: [{ tag: "EQ-DEMO-04", equipamento: "Equipamento Demo 4", motivo: "Equipamento em uso contínuo (fictício)", nova_data: "30/10/2026" }],
      treinamentos: [],
      melhorias: [],
      feriados: [],
      aquisicoes: [],
    } as unknown as DadosSala["manuais"],
  };
}
