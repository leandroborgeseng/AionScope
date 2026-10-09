import { parsePbiDate } from "@/lib/pbi/dates";
import { isOficinaEquals, isOsAindaAberta } from "@/lib/pbi/volume-ec";
import { PLANOS_ETIQUETA, type PlanoEtiqueta } from "./tipos";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";

export type FichaVidaOs = {
  os: string;
  oficina: string;
  plano: PlanoEtiqueta | null;
  tipoManutencao: string;
  situacao: string;
  abertura: string;
  fechamento: string;
  prazo: string;
  aberta: boolean;
};

export type FichaVida = {
  tag: string;
  equipamento: EquipamentoItem | null;
  nome: string;
  modelo: string;
  fabricante: string;
  setor: string;
  centroDeCusto: string;
  criticidade: string;
  status: string;
  patrimonio: string;
  nSerie: string;
  osRecentes: FichaVidaOs[];
  cronograma: Array<{
    plano: string;
    tipo: string;
    ultima: string;
    proxima: string;
    periodicidade: string;
  }>;
};

function planoDaOficina(oficina: string): PlanoEtiqueta | null {
  for (const cfg of PLANOS_ETIQUETA) {
    if (isOficinaEquals(oficina, cfg.oficinaEquals)) return cfg.id;
  }
  return null;
}

function tagMatch(a: string | null | undefined, b: string) {
  return (a ?? "").trim().toLocaleUpperCase("pt-BR") === b.trim().toLocaleUpperCase("pt-BR");
}

export function buildFichaVida(
  tag: string,
  equipamentos: EquipamentoItem[],
  os: OsAnaliticoItem[],
  cronograma: CronogramaItem[],
): FichaVida {
  const decoded = decodeURIComponent(tag).trim();
  const eq = equipamentos.find((e) => tagMatch(e.Tag, decoded)) ?? null;
  const osTag = os.filter((item) => tagMatch(item.Tag, decoded));
  osTag.sort((a, b) => {
    const da = parsePbiDate(a.Abertura)?.getTime() ?? 0;
    const db = parsePbiDate(b.Abertura)?.getTime() ?? 0;
    return db - da;
  });

  const osRecentes: FichaVidaOs[] = osTag.slice(0, 40).map((item) => ({
    os: item.OS,
    oficina: item.Oficina,
    plano: planoDaOficina(item.Oficina),
    tipoManutencao: item.TipoDeManutencao,
    situacao: item.SituacaoDaOS,
    abertura: item.Abertura,
    fechamento: item.Fechamento || item.DataDaSolucao,
    prazo: item.PrazoDeEncerramentoOs || item.DataLimiteDaSolucao,
    aberta: isOsAindaAberta(item),
  }));

  const crono = cronograma
    .filter((c) => tagMatch(c.Tag, decoded))
    .map((c) => ({
      plano: c.PlanoDeManutencao,
      tipo: c.TipoDeManutencao,
      ultima: c.DataDaUltima,
      proxima: c.ProximaRealizacao,
      periodicidade: c.Perioridicade,
    }));

  const fromOs = osTag[0];

  return {
    tag: decoded,
    equipamento: eq,
    nome: eq?.Equipamento || fromOs?.Equipamento || "—",
    modelo: eq?.Modelo || fromOs?.Modelo || "—",
    fabricante: eq?.Fabricante || fromOs?.Fabricante || "—",
    setor: eq?.Setor || fromOs?.Setor || "—",
    centroDeCusto: eq?.CentroDeCusto || fromOs?.CentroDeCusto || "—",
    criticidade: eq?.Criticidade || "—",
    status: eq?.Status || "—",
    patrimonio: eq?.Patrimonio || "—",
    nSerie: eq?.NSerie || "—",
    osRecentes,
    cronograma: crono,
  };
}
