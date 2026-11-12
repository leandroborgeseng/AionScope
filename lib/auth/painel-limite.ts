/**
 * 5 falhas de login por IP a cada 15 min.
 * Reusa o IP do convite (`ipParaLimite`: CF-Connecting-IP só com
 * TRUST_CF_CONNECTING_IP=true) e a tabela `bot_convite_limite`.
 * A chave é outro hash, então o contador não mistura com o formulário público.
 */
import { createHash } from "node:crypto";
import { ipParaLimite } from "@/lib/bot/convite-limite";
import { getDb } from "@/lib/db/client";

export const LIMITE_LOGIN = 5;
export const JANELA_LOGIN_MS = 15 * 60 * 1000;

function chave(ip: string) {
  return createHash("sha256").update(`login-ip\n${ip}`).digest("hex");
}

export function ipLogin(request: Request) {
  return ipParaLimite(request);
}

export function limiteLogin(ip: string, agora = Date.now()) {
  const db = getDb();
  db.prepare("DELETE FROM bot_convite_limite WHERE expira_em <= ?").run(agora);
  const atual = db.prepare("SELECT n, expira_em FROM bot_convite_limite WHERE chave = ?").get(chave(ip)) as
    | { n: number; expira_em: number }
    | undefined;
  if (!atual || atual.n < LIMITE_LOGIN || atual.expira_em <= agora) {
    return { bloqueado: false as const, retryAfter: 0 };
  }
  return {
    bloqueado: true as const,
    retryAfter: Math.max(1, Math.ceil((atual.expira_em - agora) / 1000)),
  };
}

export function registrarFalhaLogin(ip: string, agora = Date.now()) {
  const db = getDb();
  const id = chave(ip);
  db.transaction(() => {
    db.prepare("DELETE FROM bot_convite_limite WHERE expira_em <= ?").run(agora);
    const atual = db.prepare("SELECT n, expira_em FROM bot_convite_limite WHERE chave = ?").get(id) as
      | { n: number; expira_em: number }
      | undefined;
    if (!atual) {
      db.prepare("INSERT INTO bot_convite_limite (chave, n, expira_em) VALUES (?, 1, ?)").run(id, agora + JANELA_LOGIN_MS);
      return;
    }
    db.prepare("UPDATE bot_convite_limite SET n = n + 1 WHERE chave = ?").run(id);
  })();
}

export function limparFalhasLogin(ip: string) {
  getDb().prepare("DELETE FROM bot_convite_limite WHERE chave = ?").run(chave(ip));
}
