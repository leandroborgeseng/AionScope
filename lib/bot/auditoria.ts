/**
 * Trilha do cadastro do bot.
 * Decisão de 10/11/2026: 90 dias visíveis (a tela entra em outro PR) e 12 meses no banco.
 * `AIONSCOPE_BOT_AUDITORIA_DIAS_VISIVEIS` e `AIONSCOPE_BOT_AUDITORIA_MESES_BANCO`
 * sobrescrevem o padrão. Não há coluna de corpo, telefone, e-mail, setor ou nome.
 */
import { aposExclusao, getDb } from "@/lib/db/client";
import { MSG_AUDITORIA_RECUSADA } from "./mensagens";

export const BOT_AUDITORIA_DIAS_VISIVEIS_PADRAO = 90;
export const BOT_AUDITORIA_MESES_BANCO_PADRAO = 12;
export const BOT_AUDITORIA_DIAS_VISIVEIS_ENV = "AIONSCOPE_BOT_AUDITORIA_DIAS_VISIVEIS";
export const BOT_AUDITORIA_MESES_BANCO_ENV = "AIONSCOPE_BOT_AUDITORIA_MESES_BANCO";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAVES = ["usuarioId", "ator", "acao", "recurso", "status"] as const;

export type AcaoAuditoria =
  | "criar"
  | "aprovar"
  | "recusar"
  | "inativar"
  | "reativar"
  | "consulta"
  | "revelar"
  | "reenviar"
  | "excluir";

export type EventoAuditoria = {
  usuarioId: string | null;
  ator: "admin" | "canal" | "formulario";
  acao: AcaoAuditoria;
  recurso: "cadastro";
  status: number;
};

export type RegistroAuditoria = {
  id: number;
  criado_em: string;
  usuario_id: string | null;
  ator: string;
  acao: string;
  recurso: string;
  status: number;
};

function inteiroConfigurado(bruto: string | undefined, padrao: number, maximo: number) {
  if (bruto == null || bruto.trim() === "") return padrao;
  if (!/^\d{1,4}$/.test(bruto.trim())) return padrao;
  const valor = Number(bruto.trim());
  if (valor < 1 || valor > maximo) return padrao;
  return valor;
}

export function diasVisiveisAuditoria() {
  return inteiroConfigurado(process.env[BOT_AUDITORIA_DIAS_VISIVEIS_ENV], BOT_AUDITORIA_DIAS_VISIVEIS_PADRAO, 3650);
}

export function mesesBancoAuditoria() {
  return inteiroConfigurado(process.env[BOT_AUDITORIA_MESES_BANCO_ENV], BOT_AUDITORIA_MESES_BANCO_PADRAO, 120);
}

export function limiteVisivel(agora: Date) {
  return new Date(agora.getTime() - diasVisiveisAuditoria() * 86_400_000).toISOString();
}

export function limiteBanco(agora: Date) {
  const data = new Date(agora.getTime());
  data.setUTCMonth(data.getUTCMonth() - mesesBancoAuditoria());
  return data.toISOString();
}

export function aplicarRetencao(agora = new Date()) {
  const db = getDb();
  const info = db.prepare("DELETE FROM bot_auditoria WHERE criado_em < ?").run(limiteBanco(agora));
  if (info.changes > 0) aposExclusao(db);
}

function eventoSeguro(evento: EventoAuditoria) {
  const chaves = Object.keys(evento);
  if (chaves.length !== CHAVES.length || chaves.some((chave) => !CHAVES.includes(chave as (typeof CHAVES)[number]))) {
    return false;
  }
  if (evento.usuarioId !== null && !UUID.test(evento.usuarioId)) return false;
  if (evento.ator !== "admin" && evento.ator !== "canal" && evento.ator !== "formulario") return false;
  if (!/^[a-z]{3,16}$/.test(evento.acao)) return false;
  if (evento.recurso !== "cadastro") return false;
  if (!Number.isInteger(evento.status) || evento.status < 100 || evento.status > 599) return false;
  return true;
}

export function registrarAuditoria(evento: EventoAuditoria, agora = new Date()) {
  if (!eventoSeguro(evento)) throw new Error(MSG_AUDITORIA_RECUSADA);
  getDb()
    .prepare(
      `INSERT INTO bot_auditoria (criado_em, usuario_id, ator, acao, recurso, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(agora.toISOString(), evento.usuarioId, evento.ator, evento.acao, evento.recurso, evento.status);
  aplicarRetencao(agora);
}

/** Janela visível (padrão 90 dias). Quem consulta a tela futura usa isto; o banco guarda 12 meses. */
export function listarAuditoria(usuarioId: string, agora = new Date()): RegistroAuditoria[] {
  aplicarRetencao(agora);
  return getDb()
    .prepare(
      `SELECT id, criado_em, usuario_id, ator, acao, recurso, status
       FROM bot_auditoria
       WHERE usuario_id = ? AND criado_em >= ?
       ORDER BY criado_em`,
    )
    .all(usuarioId, limiteVisivel(agora)) as RegistroAuditoria[];
}

const CHAVES_CONSULTA = ["usuarioId", "botId", "rota", "queryHash", "telefoneMascarado", "status", "latenciaMs"] as const;
const ROTA_API = /^\/api\/bot\/v1(?:\/[A-Za-z0-9._~%-]+)*$/;
const HASH_64 = /^[0-9a-f]{64}$/;
const BOT_ID = /^[0-9a-f]{12}$/;
const MASCARA = /^\+55 \d{2} •{4,5}-\d{4}$/;

export type ConsultaApi = {
  usuarioId: string | null;
  botId: string | null;
  rota: string;
  queryHash: string;
  telefoneMascarado: string | null;
  status: number;
  latenciaMs: number;
};

function consultaSegura(evento: ConsultaApi) {
  const chaves = Object.keys(evento);
  if (chaves.length !== CHAVES_CONSULTA.length || chaves.some((chave) => !CHAVES_CONSULTA.includes(chave as (typeof CHAVES_CONSULTA)[number]))) {
    return false;
  }
  if (evento.usuarioId !== null && !UUID.test(evento.usuarioId)) return false;
  if (evento.botId !== null && !BOT_ID.test(evento.botId)) return false;
  if (!ROTA_API.test(evento.rota) || evento.rota.length > 180) return false;
  if (!HASH_64.test(evento.queryHash)) return false;
  if (evento.telefoneMascarado !== null && !MASCARA.test(evento.telefoneMascarado)) return false;
  if (!Number.isInteger(evento.status) || evento.status < 100 || evento.status > 599) return false;
  if (!Number.isInteger(evento.latenciaMs) || evento.latenciaMs < 0 || evento.latenciaMs > 120_000) return false;
  return true;
}

/** Uma linha por chamada da API. Sem corpo, token, telefone completo, e-mail ou setor. */
export function registrarConsultaApi(evento: ConsultaApi, agora = new Date()) {
  if (!consultaSegura(evento)) throw new Error(MSG_AUDITORIA_RECUSADA);
  const db = getDb();
  db.prepare(
    `INSERT INTO bot_api_auditoria (
       criado_em, usuario_id, bot_id, rota, query_hash, telefone_mascarado, status, latencia_ms
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    agora.toISOString(),
    evento.usuarioId,
    evento.botId,
    evento.rota,
    evento.queryHash,
    evento.telefoneMascarado,
    evento.status,
    evento.latenciaMs,
  );
  const info = db.prepare("DELETE FROM bot_api_auditoria WHERE criado_em < ?").run(limiteBanco(agora));
  if (info.changes > 0) aposExclusao(db);
}
