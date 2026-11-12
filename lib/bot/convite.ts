/**
 * Link único do grupo. O banco guarda o hash (consulta) e o token cifrado
 * com SESSION_SECRET (para o admin copiar). O texto puro não fica na tabela.
 * Reemitir revoga o anterior na mesma transação.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync } from "crypto";
import { canonizarOrigem } from "./origem";
import { getDb } from "@/lib/db/client";
import { MSG_GRAVACAO } from "./mensagens";
import { SESSION_SECRET_ENV } from "@/lib/auth/contratos-sessao";

export const CONVITE_ORIGEM_ENV = "AIONSCOPE_CONVITE_ORIGEM";
export const COOKIE_CSRF_CONVITE = "aion_convite_csrf";
export const VALIDADE_DIAS_PADRAO = 7;
export const VALIDADE_DIAS_MIN = 1;
export const VALIDADE_DIAS_MAX = 90;
const DIA_MS = 86_400_000;

export type ConviteAdmin = {
  validade_dias: number;
  ativo: null | {
    expira_em: string;
    criado_em: string;
    cadastros: number;
    url: string | null;
  };
};

function falha(status: 400 | 409 | 500, message: string) {
  return { ok: false as const, status, message };
}

function chaveCifragem(): Buffer | null {
  const segredo = process.env[SESSION_SECRET_ENV] ?? "";
  if (segredo.length < 32) return null;
  return scryptSync(segredo, "aionscope-convite-grupo-v1", 32);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function cifrarToken(token: string, chave: Buffer) {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave, iv);
  const corpo = Buffer.concat([cifra.update(token, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${corpo.toString("base64url")}`;
}

function decifrarToken(cifrado: string | null): string | null {
  if (!cifrado) return null;
  const chave = chaveCifragem();
  if (!chave) return null;
  const partes = cifrado.split(".");
  if (partes.length !== 3) return null;
  try {
    const iv = Buffer.from(partes[0]!, "base64url");
    const tag = Buffer.from(partes[1]!, "base64url");
    const corpo = Buffer.from(partes[2]!, "base64url");
    const decifra = createDecipheriv("aes-256-gcm", chave, iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(corpo), decifra.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function urlDoConvite(token: string): string | null {
  const origem = canonizarOrigem(process.env[CONVITE_ORIGEM_ENV]);
  if (!origem) return null;
  return `${origem}/convite/${token}`;
}

export function lerValidadeDias() {
  const linha = getDb().prepare("SELECT validade_dias FROM bot_convite_config WHERE id = 1").get() as
    | { validade_dias: number }
    | undefined;
  const dias = linha?.validade_dias;
  if (!dias || dias < VALIDADE_DIAS_MIN || dias > VALIDADE_DIAS_MAX) return VALIDADE_DIAS_PADRAO;
  return dias;
}

export function lerConviteGrupo(): ConviteAdmin {
  const validade_dias = lerValidadeDias();
  const ativo = getDb()
    .prepare(
      `SELECT id, token_cifrado, expira_em, criado_em
       FROM bot_convite_grupo
       WHERE revogado_em IS NULL
       ORDER BY criado_em DESC
       LIMIT 1`,
    )
    .get() as { id: string; token_cifrado: string | null; expira_em: string; criado_em: string } | undefined;
  if (!ativo) return { validade_dias, ativo: null };
  const cadastros = getDb().prepare("SELECT COUNT(*) n FROM bot_usuario WHERE convite_id = ?").get(ativo.id) as { n: number };
  const token = decifrarToken(ativo.token_cifrado);
  return {
    validade_dias,
    ativo: {
      expira_em: ativo.expira_em,
      criado_em: ativo.criado_em,
      cadastros: cadastros.n,
      url: token ? urlDoConvite(token) : null,
    },
  };
}

/** Gera um link e revoga qualquer um ainda não revogado. */
export function emitirConviteGrupo(agora = new Date()) {
  const chave = chaveCifragem();
  if (!chave) return falha(500, MSG_GRAVACAO);
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const dias = lerValidadeDias();
  const criado = agora.toISOString();
  const expira = new Date(agora.getTime() + dias * DIA_MS).toISOString();
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE bot_convite_grupo SET revogado_em = ? WHERE revogado_em IS NULL").run(criado);
    db.prepare(
      `INSERT INTO bot_convite_grupo (
        id, token_hash, token_cifrado, expira_em, revogado_em, criado_por, criado_em
      ) VALUES (?, ?, ?, ?, NULL, 'admin', ?)`,
    ).run(id, hashToken(token), cifrarToken(token, chave), expira, criado);
  })();
  return {
    ok: true as const,
    id,
    token,
    expira_em: expira,
    criado_em: criado,
    validade_dias: dias,
    url: urlDoConvite(token),
  };
}

export function revogarConviteAtivo(agora = new Date()) {
  const ativo = getDb().prepare("SELECT id FROM bot_convite_grupo WHERE revogado_em IS NULL LIMIT 1").get() as
    | { id: string }
    | undefined;
  if (!ativo) return falha(409, "Não há link ativo.");
  getDb().prepare("UPDATE bot_convite_grupo SET revogado_em = ? WHERE revogado_em IS NULL").run(agora.toISOString());
  return { ok: true as const, data: lerConviteGrupo() };
}

export function definirValidadeDias(dias: unknown, agora = new Date()) {
  void agora;
  if (typeof dias !== "number" || !Number.isInteger(dias) || dias < VALIDADE_DIAS_MIN || dias > VALIDADE_DIAS_MAX) {
    return falha(400, "Validade inválida.");
  }
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE bot_convite_config SET validade_dias = ? WHERE id = 1").run(dias);
    const ativo = db
      .prepare("SELECT id, criado_em FROM bot_convite_grupo WHERE revogado_em IS NULL ORDER BY criado_em DESC LIMIT 1")
      .get() as { id: string; criado_em: string } | undefined;
    if (!ativo) return;
    const expira = new Date(Date.parse(ativo.criado_em) + dias * DIA_MS).toISOString();
    db.prepare("UPDATE bot_convite_grupo SET expira_em = ? WHERE id = ?").run(expira, ativo.id);
  })();
  return { ok: true as const, data: lerConviteGrupo() };
}

/** Null se o token não existe, está revogado ou vencido. A resposta pública não distingue o motivo. */
export function buscarConviteAberto(token: string, agora = new Date()) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return null;
  const linha = getDb()
    .prepare("SELECT id, expira_em, revogado_em FROM bot_convite_grupo WHERE token_hash = ?")
    .get(hashToken(token)) as { id: string; expira_em: string; revogado_em: string | null } | undefined;
  if (!linha || linha.revogado_em) return null;
  if (Number.isNaN(Date.parse(linha.expira_em)) || Date.parse(linha.expira_em) <= agora.getTime()) return null;
  return { id: linha.id };
}

export function novoCsrfConvite() {
  return randomBytes(32).toString("hex");
}

export function cookieCsrfConvite(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_CSRF_CONVITE}=${token}; Path=/convite; HttpOnly; SameSite=Lax; Max-Age=7200${secure}`;
}

export function lerCookie(request: Request, nome: string) {
  const bruto = request.headers.get("cookie") ?? "";
  for (const parte of bruto.split(";")) {
    const texto = parte.trim();
    const igual = texto.indexOf("=");
    if (igual <= 0) continue;
    if (texto.slice(0, igual) === nome) return texto.slice(igual + 1);
  }
  return null;
}

export function cabecalhosConvite(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}
