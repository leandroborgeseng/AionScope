import { closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, unlinkSync, writeSync } from "fs";
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

export type OrigemTreinamentos = "volume" | "semeado" | "ausente";
export type ResultadoSemente = { copiados: number; mantidos: number; erro: boolean; tmpRemovidos: number };

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

/** Temporários da cópia: ".<arquivo>.tmp-<pid>" no mesmo diretório. Nunca contam como arquivo existente. */
export const RE_TMP_SEMENTE = /^\..+\.tmp-\d+$/;
const ARQUIVO_SEMENTE = /^[^.].*\.(json|csv)$/i;

/** Estado do boot compartilhado entre bundles do mesmo processo (instrumentation e rotas). */
type EstadoBoot = { semeadosNesteBoot: Set<string> };
const G = globalThis as typeof globalThis & { __aionTreinamentosBoot?: EstadoBoot };
function estadoBoot(): EstadoBoot {
  if (!G.__aionTreinamentosBoot) G.__aionTreinamentosBoot = { semeadosNesteBoot: new Set() };
  return G.__aionTreinamentosBoot;
}

/** Remove temporários órfãos de cópias interrompidas. */
export function limparTmpOrfaos(destino: string) {
  let n = 0;
  try {
    for (const f of readdirSync(destino)) {
      if (!RE_TMP_SEMENTE.test(f)) continue;
      try {
        unlinkSync(path.join(/* turbopackIgnore: true */ destino, f));
        n++;
      } catch {
        /* outro processo pode ter removido */
      }
    }
  } catch {
    /* diretório ausente */
  }
  return n;
}

/**
 * Cópia atômica sem sobrescrever: escreve em ".<nome>.tmp-<pid>", fsync, e publica com link()
 * (falha com EEXIST se o destino já existir — nunca sobrescreve); sem suporte a link, rename().
 * `_falharAposBytes` só para testes (simula crash no meio da escrita).
 */
export function copiarAtomico(origem: string, alvo: string, _falharAposBytes?: number): "copiado" | "existe" {
  const dados = readFileSync(origem);
  const tmp = path.join(/* turbopackIgnore: true */ path.dirname(alvo), `.${path.basename(alvo)}.tmp-${process.pid}`);
  const fd = openSync(tmp, "w", 0o600);
  try {
    const limite = _falharAposBytes ?? dados.length;
    let escrito = 0;
    const PASSO = 64 * 1024;
    while (escrito < dados.length) {
      if (escrito >= limite) throw new Error("crash simulado durante a cópia");
      escrito += writeSync(fd, dados, escrito, Math.min(PASSO, dados.length - escrito, Math.max(1, limite - escrito)));
    }
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    linkSync(tmp, alvo);
    unlinkSync(tmp);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      unlinkSync(tmp);
      return "existe";
    }
    if (existsSync(alvo)) {
      unlinkSync(tmp);
      return "existe";
    }
    renameSync(tmp, alvo);
  }
  try {
    const dfd = openSync(path.dirname(alvo), "r");
    try { fsyncSync(dfd); } finally { closeSync(dfd); }
  } catch {
    /* fsync de diretório não suportado: ok */
  }
  return "copiado";
}

/** Copia a semente para o volume só quando o arquivo falta (cópia atômica; nunca sobrescreve). Não lança. */
export function semearTreinamentosSeFaltar(destino = diretorioTreinamentos(), origem = diretorioSementeTreinamentos()): ResultadoSemente {
  const r: ResultadoSemente = { copiados: 0, mantidos: 0, erro: false, tmpRemovidos: 0 };
  let arquivos: string[] = [];
  try {
    if (!existsSync(origem)) {
      r.tmpRemovidos = limparTmpOrfaos(destino);
      return r;
    }
    arquivos = readdirSync(origem).filter((f) => ARQUIVO_SEMENTE.test(f));
    mkdirSync(/* turbopackIgnore: true */ destino, { recursive: true });
    r.tmpRemovidos = limparTmpOrfaos(destino);
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
      if (copiarAtomico(path.join(/* turbopackIgnore: true */ origem, f), alvo) === "copiado") {
        r.copiados++;
        estadoBoot().semeadosNesteBoot.add(alvo);
      } else r.mantidos++;
    } catch {
      r.erro = true;
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
  if (linhas === 0) return { linhas, origem: "ausente" };
  const principal = path.join(/* turbopackIgnore: true */ diretorioTreinamentos(), ARQUIVO_PRINCIPAL);
  return { linhas, origem: estadoBoot().semeadosNesteBoot.has(principal) ? "semeado" : "volume" };
}

/** Só para testes — limpa cache em memória. */
export function _resetTreinamentosCache(novoBoot = true) {
  if (novoBoot) G.__aionTreinamentosBoot = undefined;
  semeado = false;
  cacheDir = null;
  cacheParticipantes = null;
  cachePainel = null;
}
