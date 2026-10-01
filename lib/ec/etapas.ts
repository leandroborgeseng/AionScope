import { semAcento, type ClasseManutencao } from "./texto";

export const ETAPAS = [
  "Sem 1º atendimento",
  "Em atendimento",
  "Aguarda peça/compra",
  "Reparo externo",
  "Contrato/assistência",
  "Teste e devolução",
  "Encerrada",
] as const;

export type EtapaOs = (typeof ETAPAS)[number];

export function etapaOs(input: {
  encerrada: boolean;
  classe: ClasseManutencao;
  pendencia: string;
  assistencia: string;
  observacao: string;
  temAtendimento: boolean;
}): { etapa: EtapaOs; contratoPelaObservacao: boolean } {
  if (input.encerrada) return { etapa: "Encerrada", contratoPelaObservacao: false };
  if (input.classe === "devolucao") return { etapa: "Teste e devolução", contratoPelaObservacao: false };
  const pendencia = semAcento(input.pendencia);
  if (input.classe === "compra" || pendencia.includes("COMPRA") || pendencia.includes("PECA")) {
    return { etapa: "Aguarda peça/compra", contratoPelaObservacao: false };
  }
  if (
    input.classe === "externa" ||
    semAcento(input.assistencia).length > 0 ||
    pendencia.includes("EXTERNA")
  ) {
    return { etapa: "Reparo externo", contratoPelaObservacao: false };
  }
  if (semAcento(input.observacao).startsWith("CONTRATO")) {
    return { etapa: "Contrato/assistência", contratoPelaObservacao: true };
  }
  if (input.temAtendimento) return { etapa: "Em atendimento", contratoPelaObservacao: false };
  return { etapa: "Sem 1º atendimento", contratoPelaObservacao: false };
}
