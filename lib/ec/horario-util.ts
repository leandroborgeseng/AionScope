import { addDays } from "date-fns";

export type HorarioUtilConfig = {
  inicio: number;
  fim: number;
  feriados: Set<string>;
};

export function horarioUtilConfig(env: NodeJS.ProcessEnv = process.env): HorarioUtilConfig {
  const inicio = Number(env.EC_HORA_INICIO ?? 7);
  const fim = Number(env.EC_HORA_FIM ?? 17);
  const feriados = new Set(
    (env.EC_FERIADOS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)),
  );
  return {
    inicio: Number.isFinite(inicio) ? inicio : 7,
    fim: Number.isFinite(fim) ? fim : 17,
    feriados,
  };
}

function isoDay(day: Date) {
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${m}-${d}`;
}

function startOfDay(day: Date) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

export function isDiaUtil(day: Date, config: HorarioUtilConfig) {
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return false;
  return !config.feriados.has(isoDay(day));
}

export function dentroDoExpediente(moment: Date, config: HorarioUtilConfig) {
  if (!isDiaUtil(moment, config)) return false;
  const hora = moment.getHours() + moment.getMinutes() / 60 + moment.getSeconds() / 3600;
  return hora >= config.inicio && hora < config.fim;
}

function windowOn(day: Date, config: HorarioUtilConfig) {
  if (!isDiaUtil(day, config)) return null;
  return {
    start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), config.inicio, 0, 0, 0),
    end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), config.fim, 0, 0, 0),
  };
}

/** Milissegundos úteis entre duas datas no relógio de parede de America/Sao_Paulo. */
export function diffHorasUteisMs(from: Date, to: Date, config: HorarioUtilConfig) {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) return 0;
  let total = 0;
  const last = startOfDay(to);
  for (let day = startOfDay(from); day.getTime() <= last.getTime(); day = addDays(day, 1)) {
    const window = windowOn(day, config);
    if (!window) continue;
    const overlapStart = Math.max(from.getTime(), window.start.getTime());
    const overlapEnd = Math.min(to.getTime(), window.end.getTime());
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

export function diffHorasUteis(from: Date, to: Date, config: HorarioUtilConfig) {
  return diffHorasUteisMs(from, to, config) / 3_600_000;
}
