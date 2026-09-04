import { addDays, differenceInCalendarDays, format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PeriodoOs } from "./catalog";

export const TIMEZONE = "America/Sao_Paulo";

export function nowInSaoPaulo(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

export function todayISO(): string {
  return format(nowInSaoPaulo(), "yyyy-MM-dd");
}

export function startOfMonthISO(date = nowInSaoPaulo()): string {
  return format(new Date(date.getFullYear(), date.getMonth(), 1), "yyyy-MM-dd");
}

export function toApiDateTime(isoDate: string, endOfDay = false): string {
  return endOfDay ? `${isoDate}T23:59:59` : `${isoDate}T00:00:00`;
}

export function parsePbiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const br = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (br) {
    const date = new Date(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      Number(br[4] ?? 0),
      Number(br[5] ?? 0),
      Number(br[6] ?? 0),
    );
    return isValid(date) ? date : null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw);
    return isValid(date) ? date : null;
  }

  if (/^\d{8}$/.test(raw)) {
    const date = parse(raw, "yyyyMMdd", new Date());
    return isValid(date) ? date : null;
  }

  // Cronograma: às vezes YYYYMMDD + dígito (ex: 202607275 → 27/07/2026);
  // às vezes YYYYMM + id de 3 dígitos (ex: 202608678 → ago/2026; "dia" 67 inválido).
  if (/^20\d{7}$/.test(raw)) {
    const y = Number(raw.slice(0, 4));
    const mo = Number(raw.slice(4, 6));
    const d = Number(raw.slice(6, 8));
    if (mo >= 1 && mo <= 12) {
      if (d >= 1 && d <= 31) {
        const date = parse(raw.slice(0, 8), "yyyyMMdd", new Date());
        if (isValid(date) && date.getDate() === d) return date;
      }
      const monthOnly = new Date(y, mo - 1, 1);
      if (isValid(monthOnly)) return monthOnly;
    }
  }

  return null;
}

export function formatDateBR(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parsePbiDate(value ?? "");
  if (!date) return value ? String(value) : "—";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parsePbiDate(value ?? "");
  if (!date) return value ? String(value) : "—";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function parseBrNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return null;
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseDurationMinutes(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const m = value.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 60;
}

export function daysUntil(date: Date, from = nowInSaoPaulo()): number {
  return differenceInCalendarDays(date, new Date(from.getFullYear(), from.getMonth(), from.getDate()));
}

export function mapDateRangeToPeriodo(from: string, to: string): PeriodoOs {
  const today = nowInSaoPaulo();
  const start = parsePbiDate(from) ?? today;
  const end = parsePbiDate(to) ?? today;
  const startISO = format(start, "yyyy-MM-dd");
  const endISO = format(end, "yyyy-MM-dd");

  const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd");
  if (startISO === monthStart && (endISO === todayISO() || endISO === monthEnd)) return "MesAtual";

  const prevStart = format(new Date(today.getFullYear(), today.getMonth() - 1, 1), "yyyy-MM-dd");
  const prevEnd = format(new Date(today.getFullYear(), today.getMonth(), 0), "yyyy-MM-dd");
  if (startISO === prevStart && endISO === prevEnd) return "MesAnterior";

  const yearStart = format(new Date(today.getFullYear(), 0, 1), "yyyy-MM-dd");
  const yearEnd = format(new Date(today.getFullYear(), 11, 31), "yyyy-MM-dd");
  if (startISO === yearStart && (endISO === todayISO() || endISO === yearEnd)) return "AnoAtual";

  const prevYearStart = format(new Date(today.getFullYear() - 1, 0, 1), "yyyy-MM-dd");
  const prevYearEnd = format(new Date(today.getFullYear() - 1, 11, 31), "yyyy-MM-dd");
  if (startISO === prevYearStart && endISO === prevYearEnd) return "AnoAnterior";

  const weekStart = format(addDays(today, -((today.getDay() + 6) % 7)), "yyyy-MM-dd");
  if (startISO === weekStart && endISO === todayISO()) return "SemanaAtual";

  const spanDays = differenceInCalendarDays(end, start);
  if (spanDays >= 600) return "DoisAnosAtuais";
  if (spanDays >= 180) return "AnoAtual";
  return "MesAtual";
}

export const PERIOD_PRESETS: { id: string; label: string; range: () => { from: string; to: string } }[] = [
  {
    id: "7d",
    label: "7 dias",
    range: () => ({ from: format(addDays(nowInSaoPaulo(), -6), "yyyy-MM-dd"), to: todayISO() }),
  },
  {
    id: "30d",
    label: "30 dias",
    range: () => ({ from: format(addDays(nowInSaoPaulo(), -29), "yyyy-MM-dd"), to: todayISO() }),
  },
  {
    id: "mes",
    label: "Mês atual",
    range: () => ({ from: startOfMonthISO(), to: todayISO() }),
  },
  {
    id: "mes-ant",
    label: "Mês anterior",
    range: () => {
      const today = nowInSaoPaulo();
      return {
        from: format(new Date(today.getFullYear(), today.getMonth() - 1, 1), "yyyy-MM-dd"),
        to: format(new Date(today.getFullYear(), today.getMonth(), 0), "yyyy-MM-dd"),
      };
    },
  },
  {
    id: "ano",
    label: "Ano atual",
    range: () => ({
      from: format(new Date(nowInSaoPaulo().getFullYear(), 0, 1), "yyyy-MM-dd"),
      to: todayISO(),
    }),
  },
];
