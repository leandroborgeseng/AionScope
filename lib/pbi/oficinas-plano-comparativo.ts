import {
  OFICINAS_VOLUME_PLANO,
  buildVolumeAbertasFechadas,
  pctExecutadaMes,
  type RollingYearRange,
  type VolumeEcMonth,
} from "./volume-ec";
import type { OsAnaliticoItem } from "./types";

export type OficinaPlanoCelula = {
  filterKey: string;
  chipLabel: string;
  abertas: number;
  fechadas: number;
  pctExecutada: number;
  pctLabel: string;
};

export type OficinaPlanoMesComparativo = {
  key: string;
  label: string;
  year: number;
  month: number;
  porOficina: OficinaPlanoCelula[];
  consolidado: OficinaPlanoCelula;
};

export type OficinaPlanoComparativo = {
  months: OficinaPlanoMesComparativo[];
  totais: Array<OficinaPlanoCelula & { oficinaLabel: string }>;
  consolidado: OficinaPlanoCelula & { oficinaLabel: string };
};

function pctLabel(abertas: number, fechadas: number) {
  if (abertas <= 0) return "—";
  const pct = Math.round(pctExecutadaMes(abertas, fechadas) * 10) / 10;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function celula(
  filterKey: string,
  chipLabel: string,
  abertas: number,
  fechadas: number,
): OficinaPlanoCelula {
  return {
    filterKey,
    chipLabel,
    abertas,
    fechadas,
    pctExecutada: pctExecutadaMes(abertas, fechadas),
    pctLabel: pctLabel(abertas, fechadas),
  };
}

function somaCelulas(filterKey: string, chipLabel: string, cells: OficinaPlanoCelula[]): OficinaPlanoCelula {
  const abertas = cells.reduce((s, c) => s + c.abertas, 0);
  const fechadas = cells.reduce((s, c) => s + c.fechadas, 0);
  return celula(filterKey, chipLabel, abertas, fechadas);
}

/**
 * Abertas × fechadas mês a mês no ano vigente, por oficina de plano
 * (Preventiva / Calibração / TSE) + consolidado das três.
 * Narrativa de cumprimento do cronograma — sempre com quantidades (o % sozinho engana).
 */
export function buildOficinasPlanoComparativo(
  os: OsAnaliticoItem[],
  range: RollingYearRange,
): OficinaPlanoComparativo {
  const volumes = OFICINAS_VOLUME_PLANO.map((cfg) => ({
    cfg,
    volume: buildVolumeAbertasFechadas(os, range, { oficinaEquals: cfg.oficinaEquals }),
  }));

  const months: OficinaPlanoMesComparativo[] = range.months.map((slot, index) => {
    const porOficina = volumes.map(({ cfg, volume }) => {
      const mes: VolumeEcMonth | undefined = volume.months[index];
      return celula(cfg.filterKey, cfg.chipLabel, mes?.abertas ?? 0, mes?.fechadas ?? 0);
    });
    return {
      key: slot.key,
      label: slot.label,
      year: slot.year,
      month: slot.month,
      porOficina,
      consolidado: somaCelulas("consolidado", "Consolidado", porOficina),
    };
  });

  const totais = volumes.map(({ cfg, volume }) => ({
    ...celula(cfg.filterKey, cfg.chipLabel, volume.totalAbertas, volume.totalFechadas),
    oficinaLabel: cfg.oficinaLabel,
  }));

  const consolidado = {
    ...somaCelulas("consolidado", "Consolidado", totais),
    oficinaLabel: "Preventiva + Calibração + TSE",
  };

  return { months, totais, consolidado };
}
