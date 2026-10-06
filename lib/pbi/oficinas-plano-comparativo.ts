import {
  OFICINAS_VOLUME_PLANO,
  buildVolumeAbertasFechadas,
  pctExecutadaMes,
  type RollingYearRange,
  type VolumeEcMonth,
} from "./volume-ec";
import type { OsAnaliticoItem } from "./types";

export type OficinaPlanoMesComparativo = {
  key: string;
  label: string;
  year: number;
  month: number;
  porOficina: Array<{
    filterKey: string;
    chipLabel: string;
    abertas: number;
    fechadas: number;
    pctExecutada: number;
    pctLabel: string;
  }>;
};

export type OficinaPlanoComparativo = {
  months: OficinaPlanoMesComparativo[];
  totais: Array<{
    filterKey: string;
    chipLabel: string;
    oficinaLabel: string;
    abertas: number;
    fechadas: number;
    pctExecutada: number;
    pctLabel: string;
  }>;
};

function pctLabel(abertas: number, fechadas: number) {
  if (abertas <= 0) return "—";
  const pct = Math.round(pctExecutadaMes(abertas, fechadas) * 10) / 10;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Abertas × fechadas mês a mês no ano vigente, por oficina de plano
 * (Preventiva / Calibração / TSE) — narrativa de cumprimento do cronograma.
 */
export function buildOficinasPlanoComparativo(
  os: OsAnaliticoItem[],
  range: RollingYearRange,
): OficinaPlanoComparativo {
  const volumes = OFICINAS_VOLUME_PLANO.map((cfg) => ({
    cfg,
    volume: buildVolumeAbertasFechadas(os, range, { oficinaEquals: cfg.oficinaEquals }),
  }));

  const months: OficinaPlanoMesComparativo[] = range.months.map((slot, index) => ({
    key: slot.key,
    label: slot.label,
    year: slot.year,
    month: slot.month,
    porOficina: volumes.map(({ cfg, volume }) => {
      const mes: VolumeEcMonth | undefined = volume.months[index];
      const abertas = mes?.abertas ?? 0;
      const fechadas = mes?.fechadas ?? 0;
      return {
        filterKey: cfg.filterKey,
        chipLabel: cfg.chipLabel,
        abertas,
        fechadas,
        pctExecutada: pctExecutadaMes(abertas, fechadas),
        pctLabel: pctLabel(abertas, fechadas),
      };
    }),
  }));

  const totais = volumes.map(({ cfg, volume }) => ({
    filterKey: cfg.filterKey,
    chipLabel: cfg.chipLabel,
    oficinaLabel: cfg.oficinaLabel,
    abertas: volume.totalAbertas,
    fechadas: volume.totalFechadas,
    pctExecutada: pctExecutadaMes(volume.totalAbertas, volume.totalFechadas),
    pctLabel: pctLabel(volume.totalAbertas, volume.totalFechadas),
  }));

  return { months, totais };
}
