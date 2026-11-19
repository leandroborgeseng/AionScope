/**
 * Limite em memória, por token e por pessoa. Não grava cadastro nem o segredo.
 * `AIONSCOPE_BOT_LIMITE` e `AIONSCOPE_BOT_LIMITE_MS` sobrescrevem o padrão.
 */
import { createHash } from "node:crypto";

export const BOT_LIMITE_ENV = "AIONSCOPE_BOT_LIMITE";
export const BOT_LIMITE_MS_ENV = "AIONSCOPE_BOT_LIMITE_MS";
const LIMITE_PADRAO = 600;
const JANELA_PADRAO = 60_000;

type Balde = { n: number; expira: number };
const baldes = new Map<string, Balde>();

function inteiro(bruto: string | undefined, padrao: number, maximo: number) {
  if (bruto == null || bruto.trim() === "" || !/^\d+$/.test(bruto.trim())) return padrao;
  const valor = Number(bruto.trim());
  if (valor < 1 || valor > maximo) return padrao;
  return valor;
}

function config() {
  return {
    max: inteiro(process.env[BOT_LIMITE_ENV], LIMITE_PADRAO, 100_000),
    janela: inteiro(process.env[BOT_LIMITE_MS_ENV], JANELA_PADRAO, 86_400_000),
  };
}

export function chaveLimite(tipo: "token" | "pessoa", valor: string) {
  return createHash("sha256").update(`${tipo}\n${valor}`).digest("hex");
}

export function consumirLimiteApi(chaves: string[], agora = Date.now()) {
  const { max, janela } = config();
  for (const [id, balde] of baldes) {
    if (balde.expira <= agora) baldes.delete(id);
  }
  let espera = 0;
  for (const chave of chaves) {
    const balde = baldes.get(chave);
    if (balde && balde.n >= max) espera = Math.max(espera, balde.expira - agora);
  }
  if (espera > 0) return { permitido: false as const, retryAfter: Math.max(1, Math.ceil(espera / 1000)) };
  for (const chave of chaves) {
    const balde = baldes.get(chave);
    if (!balde) baldes.set(chave, { n: 1, expira: agora + janela });
    else balde.n += 1;
  }
  return { permitido: true as const, retryAfter: 0 };
}

export function resetLimiteApi() {
  baldes.clear();
}
