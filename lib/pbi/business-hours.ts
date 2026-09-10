import { addDays } from "date-fns";
import { TIMEZONE } from "./dates";

/** Horário comercial EC (America/Sao_Paulo). Fácil de ajustar depois. */
export const BUSINESS_TZ = TIMEZONE;
export const BUSINESS_DAY_START_HOUR = 8;
export const BUSINESS_DAY_END_HOUR = 17;
/** Seg–sex; fins de semana não contam. Feriados nacionais: ignorados nesta versão. */
export const BUSINESS_HOURS_LABEL =
  "horas úteis 8h–17h seg–sex (America/Sao_Paulo) · sem feriados nacionais nesta versão";

function startOfCalendarDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isWeekend(d: Date) {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/** Janela [08:00, 17:00) no dia calendário; null em fim de semana. */
function businessWindowOn(day: Date): { start: Date; end: Date } | null {
  if (isWeekend(day)) return null;
  return {
    start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), BUSINESS_DAY_START_HOUR, 0, 0, 0),
    end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), BUSINESS_DAY_END_HOUR, 0, 0, 0),
  };
}

/**
 * Diferença em milissegundos de horas úteis entre `from` e `to`.
 * Conta só seg–sex 08:00–17:00 (fuso lógico America/Sao_Paulo dos Date wall-clock do app).
 * Fins de semana e fora do expediente não entram. Sem lista de feriados (v1).
 */
export function diffBusinessMs(from: Date, to: Date): number {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  if (to.getTime() <= from.getTime()) return 0;

  let total = 0;
  const lastDay = startOfCalendarDay(to);
  for (let day = startOfCalendarDay(from); day.getTime() <= lastDay.getTime(); day = addDays(day, 1)) {
    const window = businessWindowOn(day);
    if (!window) continue;
    const overlapStart = Math.max(from.getTime(), window.start.getTime());
    const overlapEnd = Math.min(to.getTime(), window.end.getTime());
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

/** Horas úteis fracionárias (ex.: 4.5). */
export function diffBusinessHours(from: Date, to: Date): number {
  return diffBusinessMs(from, to) / 3_600_000;
}

/**
 * Soma `hours` horas úteis a `from` (seg–sex 08:00–17:00).
 * Inverso aproximado de `diffBusinessHours` (sem feriados).
 */
export function addBusinessHours(from: Date, hours: number): Date {
  if (Number.isNaN(from.getTime()) || !Number.isFinite(hours) || hours <= 0) {
    return new Date(from.getTime());
  }

  let remaining = Math.round(hours * 3_600_000);
  let cursor = new Date(from.getTime());

  for (let guard = 0; guard < 10_000 && remaining > 0; guard++) {
    const day = startOfCalendarDay(cursor);
    const window = businessWindowOn(day);
    if (!window) {
      cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, BUSINESS_DAY_START_HOUR, 0, 0, 0);
      continue;
    }
    if (cursor.getTime() < window.start.getTime()) {
      cursor = new Date(window.start.getTime());
    }
    if (cursor.getTime() >= window.end.getTime()) {
      cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, BUSINESS_DAY_START_HOUR, 0, 0, 0);
      continue;
    }
    const available = window.end.getTime() - cursor.getTime();
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining);
    }
    remaining -= available;
    cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, BUSINESS_DAY_START_HOUR, 0, 0, 0);
  }

  return cursor;
}
