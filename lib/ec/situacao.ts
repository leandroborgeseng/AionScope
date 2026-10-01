export type SituacaoOs = "GRAVE" | "ATRASADA" | "VENCE LOGO" | "NO PRAZO" | "ATENDIDA" | "SEM META";

export function situacaoPrimeiroAtendimento(input: {
  atendida: boolean;
  horasDecorridas: number;
  metaHoras: number | null;
}): SituacaoOs {
  if (input.atendida) return "ATENDIDA";
  if (input.metaHoras == null || input.metaHoras <= 0) return "SEM META";
  const { horasDecorridas, metaHoras } = input;
  if (horasDecorridas > metaHoras * 2) return "GRAVE";
  if (horasDecorridas > metaHoras) return "ATRASADA";
  const restante = metaHoras - horasDecorridas;
  if (restante <= metaHoras * 0.25) return "VENCE LOGO";
  return "NO PRAZO";
}
