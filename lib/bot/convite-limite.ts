/**
 * Limite do formulário público: por IP e por telefone.
 * A chave no banco é hash. Não grava telefone, nome nem e-mail.
 * `CF-Connecting-IP` só vale com TRUST_CF_CONNECTING_IP=true.
 * Sem isso, usa o IP da conexão (último X-Forwarded-For ou x-real-ip).
 */
import { createHash } from "crypto";
import { ipDe } from "@/lib/auth/contratos-sessao";
import { getDb } from "@/lib/db/client";

export const TRUST_CF_CONNECTING_IP = "TRUST_CF_CONNECTING_IP";
export const LIMITE_IP_ENV = "AIONSCOPE_CONVITE_LIMITE_IP";
export const LIMITE_IP_MS_ENV = "AIONSCOPE_CONVITE_LIMITE_IP_MS";
export const LIMITE_TEL_ENV = "AIONSCOPE_CONVITE_LIMITE_TELEFONE";
export const LIMITE_TEL_MS_ENV = "AIONSCOPE_CONVITE_LIMITE_TELEFONE_MS";

export const LIMITE_IP_PADRAO = 60;
export const LIMITE_IP_MS_PADRAO = 15 * 60 * 1000;
export const LIMITE_TEL_PADRAO = 5;
export const LIMITE_TEL_MS_PADRAO = 60 * 60 * 1000;

export function confiaCfConnectingIp() {
  return process.env[TRUST_CF_CONNECTING_IP] === "true";
}

/**
 * Com a variável ligada, o IP é o de `CF-Connecting-IP` (o Traefik da produção
 * só aceita faixa da Cloudflare). Sem a variável, esse header é ignorado.
 */
export function ipParaLimite(request: Request): string {
  if (confiaCfConnectingIp()) {
    const cf = request.headers.get("cf-connecting-ip")?.trim();
    if (cf) return `cf:${cf}`;
  }
  return `conexao:${ipDe(request)}`;
}

function inteiro(nome: string, padrao: number, maximo: number) {
  const bruto = process.env[nome]?.trim() ?? "";
  if (!/^\d+$/.test(bruto)) return padrao;
  const valor = Number(bruto);
  if (valor < 1 || valor > maximo) return padrao;
  return valor;
}

function limites(tipo: "ip" | "tel") {
  if (tipo === "ip") {
    return {
      max: inteiro(LIMITE_IP_ENV, LIMITE_IP_PADRAO, 10_000),
      janela: inteiro(LIMITE_IP_MS_ENV, LIMITE_IP_MS_PADRAO, 86_400_000),
    };
  }
  return {
    max: inteiro(LIMITE_TEL_ENV, LIMITE_TEL_PADRAO, 10_000),
    janela: inteiro(LIMITE_TEL_MS_ENV, LIMITE_TEL_MS_PADRAO, 7 * 86_400_000),
  };
}

function chave(tipo: "ip" | "tel", valor: string) {
  return createHash("sha256").update(`${tipo}\n${valor}`).digest("hex");
}

export function consumirLimite(tipo: "ip" | "tel", valor: string, agora = Date.now()) {
  const { max, janela } = limites(tipo);
  const id = chave(tipo, valor);
  const db = getDb();
  return db.transaction(() => {
    db.prepare("DELETE FROM bot_convite_limite WHERE expira_em <= ?").run(agora);
    const atual = db.prepare("SELECT n, expira_em FROM bot_convite_limite WHERE chave = ?").get(id) as
      | { n: number; expira_em: number }
      | undefined;
    if (atual && atual.n >= max) {
      return { permitido: false as const, retryAfter: Math.max(1, Math.ceil((atual.expira_em - agora) / 1000)) };
    }
    if (!atual) {
      db.prepare("INSERT INTO bot_convite_limite (chave, n, expira_em) VALUES (?, 1, ?)").run(id, agora + janela);
    } else {
      db.prepare("UPDATE bot_convite_limite SET n = n + 1 WHERE chave = ?").run(id);
    }
    return { permitido: true as const, retryAfter: 0 };
  })();
}
