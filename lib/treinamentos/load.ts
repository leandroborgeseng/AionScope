import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { calcularPainel, participantesParaTabela } from "./calcular";
import type { PainelTreinamentos, ParticipanteTreinamento } from "./types";

/**
 * F6 (PR 1): os dados de treinamento passam a ser lidos do volume (/data/treinamentos).
 * No boot / primeiro acesso, os arquivos de semente (data/treinamentos do repo) são copiados
 * para o volume SÓ se faltarem — nunca sobrescreve. Sem volume/arquivos o app sobe e mostra aviso.
 */
export const TREINAMENTOS_DATA_PATH_ENV = "TREINAMENTOS_DATA_PATH";
export const TREINAMENTOS_SEED_PATH_ENV = "TREINAMENTOS_SEED_PATH";
export const DIR_VOLUME_PADRAO = "/data/treinamentos";
export const AVISO_TREINAMENTOS_INDISPONIVEIS =
  "Dados de treinamentos indisponíveis: o volume de dados não tem os arquivos de treinamento. Peça ao administrador para montar o volume e reiniciar o app.";
const ARQUIVO_PRINCIPAL = "treinamentos.json";

export type OrigemTreinamentos = "volume" | "ausente";
export type ResultadoSemente = { copiados: number; mantidos: number; erro: boolean };

export function diretorioTreinamentos() {
  return process.env[TREINAMENTOS_DATA_PATH_ENV]?.trim() || DIR_VOLUME_PADRAO;
}

export function diretorioSementeTreinamentos() {
  return process.env[TREINAMENTOS_SEED_PATH_ENV]?.trim() || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "treinamentos");
}

/** @deprecated use diretorioTreinamentos() */
export function caminhoDadosTreinamentos() {
  return diretorioTreinamentos();
}

/** Copia a semente para o volume só quando o arquivo falta (COPYFILE_EXCL: nunca sobrescreve). Não lança. */
export function semearTreinamentosSeFaltar(destino = diretorioTreinamentos(), origem = diretorioSementeTreinamentos()): ResultadoSemente {
  const r: ResultadoSemente = { copiados: 0, mantidos: 0, erro: false };
  let arquivos: string[] = [];
  try {
    if (!existsSync(origem)) return r;
    arquivos = readdirSync(origem).filter((f) => /\.(json|csv)$/i.test(f));
    if (arquivos.length === 0) return r;
    mkdirSync(/* turbopackIgnore: true */ destino, { recursive: true });
  } catch {
    return { ...r, erro: true };
  }
  for (const f of arquivos) {
    const alvo = path.join(/* turbopackIgnore: true */ destino, f);
    if (existsSync(alvo)) {
      r.mantidos++;
      continue;
    }
    try {
      copyFileSync(path.join(/* turbopackIgnore: true */ origem, f), alvo, constants.COPYFILE_EXCL);
      r.copiados++;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") r.mantidos++;
      else r.erro = true;
    }
  }
  return r;
}

let semeado = false;
let cacheDir: string | null = null;
let cacheParticipantes: ParticipanteTreinamento[] | null = null;
let cachePainel: PainelTreinamentos | null = null;

function garantir() {
  const dir = diretorioTreinamentos();
  if (cacheDir !== dir) {
    cacheDir = dir;
    cacheParticipantes = null;
    cachePainel = null;
    semeado = false;
  }
  if (!semeado) {
    semearTreinamentosSeFaltar(dir);
    semeado = true;
  }
  return dir;
}

/** Lista de participantes (com nomes — só para a página logada). [] quando o volume não tem arquivos. */
export function carregarParticipantes(): ParticipanteTreinamento[] {
  const dir = garantir();
  if (cacheParticipantes) return cacheParticipantes;
  const arquivo = path.join(/* turbopackIgnore: true */ dir, ARQUIVO_PRINCIPAL);
  if (!existsSync(arquivo)) return [];
  try {
    const lista = JSON.parse(readFileSync(arquivo, "utf8")) as ParticipanteTreinamento[];
    cacheParticipantes = participantesParaTabela(lista);
    return cacheParticipantes;
  } catch {
    return [];
  }
}

/** Painel agregado. null quando não há dados no volume (a UI mostra AVISO_TREINAMENTOS_INDISPONIVEIS). */
export function carregarPainelTreinamentos(): PainelTreinamentos | null {
  const dir = garantir();
  if (cachePainel) return cachePainel;
  const participantes = carregarParticipantes();
  if (participantes.length === 0) return null;
  let atualizadoEm: string | undefined;
  try {
    const kpis = JSON.parse(readFileSync(path.join(/* turbopackIgnore: true */ dir, "kpis.json"), "utf8")) as { atualizado_em?: string };
    atualizadoEm = kpis.atualizado_em;
  } catch {
    /* opcional */
  }
  cachePainel = calcularPainel(participantes, { atualizadoEm });
  return cachePainel;
}

/** Para o health: só contagem e origem — sem nomes nem caminhos. */
export function estadoTreinamentos(): { linhas: number; origem: OrigemTreinamentos } {
  const linhas = carregarParticipantes().length;
  return { linhas, origem: linhas > 0 ? "volume" : "ausente" };
}

/** Só para testes — limpa cache em memória. */
export function _resetTreinamentosCache() {
  semeado = false;
  cacheDir = null;
  cacheParticipantes = null;
  cachePainel = null;
}
