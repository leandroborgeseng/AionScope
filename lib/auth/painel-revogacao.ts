/**
 * Cada login do painel leva um jti. Logout e Sair gravam só esse jti.
 * Outra sessão continua válida. O instante nunca passa de agora e repetir
 * a saída não acumula segundo nenhum.
 */
import { getDb } from "@/lib/db/client";
import { origemPainelPermitida } from "@/lib/auth/painel-origem";
import { COOKIE_SESSAO_PAINEL, lerCookie, lerSessaoPainel } from "@/lib/auth/painel-sessao";

const TABELA_NOVA = "painel_sessao_revogacao";
const TABELA_LEGADA = "painel_sessao_jti";

function tabela(): typeof TABELA_NOVA | typeof TABELA_LEGADA {
  const cols = getDb().prepare(`PRAGMA table_info(${TABELA_NOVA})`).all() as Array<{ name: string }>;
  return cols.some((coluna) => coluna.name === "jti") ? TABELA_NOVA : TABELA_LEGADA;
}

export function sessaoPainelAtiva(jti: string) {
  if (!jti) return false;
  const linha = getDb().prepare(`SELECT 1 AS ok FROM ${tabela()} WHERE jti = ?`).get(jti);
  return !linha;
}

/** Grava o jti uma vez. Conflito não atualiza o instante. Devolve o valor gravado. */
export function revogarSessaoPainel(jti: string, agoraMs = Date.now()): number {
  const em = Math.min(Math.floor(agoraMs), Date.now());
  getDb()
    .prepare(
      `INSERT INTO ${tabela()} (jti, revogada_em) VALUES (?, ?)
       ON CONFLICT(jti) DO NOTHING`,
    )
    .run(jti, em);
  const linha = getDb().prepare(`SELECT revogada_em AS em FROM ${tabela()} WHERE jti = ?`).get(jti) as {
    em: number;
  };
  return linha.em;
}

export function maiorRevogacaoMs(): number {
  const linha = getDb().prepare(`SELECT MAX(revogada_em) AS em FROM ${tabela()}`).get() as {
    em: number | null;
  };
  return linha.em ?? 0;
}

/**
 * Sem sessão válida: 401 e nada é gravado. Origem estranha: 403 e a sessão segue.
 * Com sessão e origem do painel, revoga só o jti apresentado.
 */
export async function prepararRevogacao(
  request: Request,
): Promise<{ ok: true } | { ok: false; status: 401 | 403; message: string }> {
  const sessao = await lerSessaoPainel(lerCookie(request, COOKIE_SESSAO_PAINEL));
  if (!sessao.ok || !sessaoPainelAtiva(sessao.jti)) {
    return { ok: false, status: 401, message: "Não autenticado." };
  }
  if (!origemPainelPermitida(request)) {
    return { ok: false, status: 403, message: "Origem não permitida." };
  }
  revogarSessaoPainel(sessao.jti);
  return { ok: true };
}
