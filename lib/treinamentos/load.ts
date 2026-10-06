import { readFileSync } from "fs";
import path from "path";
import { calcularPainel, participantesParaTabela } from "./calcular";
import type { PainelTreinamentos, ParticipanteTreinamento } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "treinamentos");

let cacheParticipantes: ParticipanteTreinamento[] | null = null;
let cachePainel: PainelTreinamentos | null = null;

export function caminhoDadosTreinamentos() {
  return DATA_DIR;
}

export function carregarParticipantes(): ParticipanteTreinamento[] {
  if (cacheParticipantes) return cacheParticipantes;
  const raw = readFileSync(path.join(DATA_DIR, "treinamentos.json"), "utf8");
  const lista = JSON.parse(raw) as ParticipanteTreinamento[];
  cacheParticipantes = participantesParaTabela(lista);
  return cacheParticipantes;
}

export function carregarPainelTreinamentos(): PainelTreinamentos {
  if (cachePainel) return cachePainel;
  const participantes = carregarParticipantes();
  let atualizadoEm: string | undefined;
  try {
    const kpis = JSON.parse(readFileSync(path.join(DATA_DIR, "kpis.json"), "utf8")) as {
      atualizado_em?: string;
    };
    atualizadoEm = kpis.atualizado_em;
  } catch {
    /* opcional */
  }
  cachePainel = calcularPainel(participantes, { atualizadoEm });
  return cachePainel;
}

/** Só para testes — limpa cache em memória. */
export function _resetTreinamentosCache() {
  cacheParticipantes = null;
  cachePainel = null;
}
