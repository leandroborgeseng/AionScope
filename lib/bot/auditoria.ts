/**
 * Trilha do cadastro do bot.
 * Decisão de 10/11/2026: 90 dias visíveis (a tela entra em outro PR) e 12 meses no banco.
 * `AIONSCOPE_BOT_AUDITORIA_DIAS_VISIVEIS` e `AIONSCOPE_BOT_AUDITORIA_MESES_BANCO`
 * sobrescrevem o padrão. Não há coluna de corpo, telefone, e-mail, setor ou nome.
 */
import { getDb } from "@/lib/db/client";
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
  | "reenviar";

export type EventoAuditoria = {
  usuarioId: string | null;
  ator: "admin" | "canal";
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
  getDb().prepare("DELETE FROM bot_auditoria WHERE criado_em < ?").run(limiteBanco(agora));
}

function eventoSeguro(evento: EventoAuditoria) {
  const chaves = Object.keys(evento);
  if (chaves.length !== CHAVES.length || chaves.some((chave) => !CHAVES.includes(chave as (typeof CHAVES)[number]))) {
    return false;
  }
  if (evento.usuarioId !== null && !UUID.test(evento.usuarioId)) return false;
  if (evento.ator !== "admin" && evento.ator !== "canal") return false;
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
