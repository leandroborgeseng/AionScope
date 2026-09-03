import type { Contrato, ContratoInput } from "./types";

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Contrato conta no mês se ativo e a vigência intersecta o mês. */
export function contratoAtivoNoMes(contrato: Contrato, year: number, month: number) {
  if (!contrato.ativo) return false;
  if (!(contrato.valorMensal > 0)) return false;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const inicio = parseDay(contrato.inicio);
  const fim = parseDay(contrato.fim);

  if (inicio && inicio > monthEnd) return false;
  if (fim && fim < monthStart) return false;
  return true;
}

export function somaContratosNoMes(contratos: Contrato[], year: number, month: number) {
  return contratos
    .filter((c) => contratoAtivoNoMes(c, year, month))
    .reduce((sum, c) => sum + c.valorMensal, 0);
}

export function contratosDoMes(contratos: Contrato[], year: number, month: number) {
  return contratos.filter((c) => contratoAtivoNoMes(c, year, month));
}

export function normalizeContratoInput(input: ContratoInput): Omit<Contrato, "id"> | { error: string } {
  const nome = String(input.nome ?? "").trim();
  if (!nome) return { error: "Informe o nome do contrato." };

  const valorMensal = Number(input.valorMensal);
  if (!Number.isFinite(valorMensal) || valorMensal < 0) {
    return { error: "Valor mensal inválido." };
  }

  const inicio = input.inicio?.trim() || null;
  const fim = input.fim?.trim() || null;
  if (inicio && !parseDay(inicio)) return { error: "Data de início inválida (use AAAA-MM-DD)." };
  if (fim && !parseDay(fim)) return { error: "Data de fim inválida (use AAAA-MM-DD)." };
  if (inicio && fim && parseDay(inicio)! > parseDay(fim)!) {
    return { error: "Início não pode ser depois do fim." };
  }

  return {
    nome,
    fornecedor: String(input.fornecedor ?? "").trim() || undefined,
    valorMensal,
    inicio,
    fim,
    ativo: input.ativo !== false,
    observacao: String(input.observacao ?? "").trim() || undefined,
  };
}
