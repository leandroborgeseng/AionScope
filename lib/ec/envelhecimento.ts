import { differenceInCalendarDays } from "date-fns";

export const FAIXAS_IDADE = [
  { id: "ate2", label: "até 2 dias" },
  { id: "d3a7", label: "3 a 7 dias" },
  { id: "d8a15", label: "8 a 15 dias" },
  { id: "d16a30", label: "16 a 30 dias" },
  { id: "mais30", label: "mais de 30 dias" },
] as const;

export type FaixaIdadeId = (typeof FAIXAS_IDADE)[number]["id"];

export function faixaIdadeDias(dias: number): FaixaIdadeId {
  if (dias <= 2) return "ate2";
  if (dias <= 7) return "d3a7";
  if (dias <= 15) return "d8a15";
  if (dias <= 30) return "d16a30";
  return "mais30";
}

export function diasDesde(abertura: Date, agora: Date) {
  return Math.max(0, differenceInCalendarDays(agora, abertura));
}
