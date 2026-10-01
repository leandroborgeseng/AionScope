import {
  diffHorasUteis,
  diffHorasUteisMs,
  horarioUtilConfig,
  type HorarioUtilConfig,
} from "@/lib/ec/horario-util";
import { TIMEZONE } from "./dates";

/** Horário comercial EC (America/Sao_Paulo). Configurável por EC_HORA_INICIO / EC_HORA_FIM / EC_FERIADOS. */
export const BUSINESS_TZ = TIMEZONE;

function configAtual(): HorarioUtilConfig {
  return horarioUtilConfig();
}

export const BUSINESS_DAY_START_HOUR = Number(process.env.EC_HORA_INICIO ?? 7) || 7;
export const BUSINESS_DAY_END_HOUR = Number(process.env.EC_HORA_FIM ?? 17) || 17;

export function businessHoursLabel(config: HorarioUtilConfig = configAtual()) {
  const feriados = config.feriados.size
    ? ` · ${config.feriados.size} feriado(s) configurado(s)`
    : " · feriados via EC_FERIADOS ou /sala/registros";
  return `horas úteis ${config.inicio}h–${config.fim}h seg–sex (America/Sao_Paulo)${feriados}`;
}

/** @deprecated Preferir businessHoursLabel() para refletir env em runtime. */
export const BUSINESS_HOURS_LABEL = businessHoursLabel();

function startOfCalendarDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function businessWindowOn(day: Date, config: HorarioUtilConfig): { start: Date; end: Date } | null {
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return null;
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  if (config.feriados.has(iso)) return null;
  return {
    start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), config.inicio, 0, 0, 0),
    end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), config.fim, 0, 0, 0),
  };
}

/**
 * Diferença em milissegundos de horas úteis entre `from` e `to`.
 * Conta só seg–sex no expediente da EC (padrão 07:00–17:00).
 */
export function diffBusinessMs(from: Date, to: Date): number {
  return diffHorasUteisMs(from, to, configAtual());
}

/** Horas úteis fracionárias (ex.: 4.5). */
export function diffBusinessHours(from: Date, to: Date): number {
  return diffHorasUteis(from, to, configAtual());
}

/**
 * Soma `hours` horas úteis a `from`.
 * Inverso aproximado de `diffBusinessHours`.
 */
export function addBusinessHours(from: Date, hours: number): Date {
  if (Number.isNaN(from.getTime()) || !Number.isFinite(hours) || hours <= 0) {
    return new Date(from.getTime());
  }

  const config = configAtual();
  let remaining = Math.round(hours * 3_600_000);
  let cursor = new Date(from.getTime());

  for (let guard = 0; guard < 10_000 && remaining > 0; guard++) {
    const day = startOfCalendarDay(cursor);
    const window = businessWindowOn(day, config);
    if (!window) {
      cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, config.inicio, 0, 0, 0);
      continue;
    }
    if (cursor.getTime() < window.start.getTime()) {
      cursor = new Date(window.start.getTime());
    }
    if (cursor.getTime() >= window.end.getTime()) {
      cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, config.inicio, 0, 0, 0);
      continue;
    }
    const available = window.end.getTime() - cursor.getTime();
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining);
    }
    remaining -= available;
    cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, config.inicio, 0, 0, 0);
  }

  return cursor;
}
