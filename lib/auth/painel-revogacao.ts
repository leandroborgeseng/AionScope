/**
 * Lista de sessões do painel revogadas. O cookie continua assinado;
 * o `jti` é que deixa de valer. A linha expira no mesmo teto de 8 h
 * da sessão, então a tabela não cresce além das sessões ainda vivas.
 * Logout e "sair do admin" revogam só o jti daquele cookie.
 */
import { getDb } from "@/lib/db/client";
import {
  COOKIE_SESSAO_PAINEL,
  TETO_ABSOLUTO_PAINEL_S,
  lerCookie,
  lerSessaoPainel,
} from "@/lib/auth/painel-sessao";

const JTI = /^[A-Za-z0-9_-]{16,64}$/;

export function jtiRevogado(jti: string, agoraS = Math.floor(Date.now() / 1000)) {
  if (!JTI.test(jti)) return true;
  const db = getDb();
  db.prepare("DELETE FROM painel_sessao_revogada WHERE expira_em <= ?").run(agoraS);
  const row = db.prepare("SELECT 1 AS n FROM painel_sessao_revogada WHERE jti = ? AND expira_em > ?").get(jti, agoraS);
  return Boolean(row);
}

export function revogarJti(jti: string, expiraEm: number) {
  if (!JTI.test(jti) || !Number.isSafeInteger(expiraEm)) return;
  getDb()
    .prepare(
      `INSERT INTO painel_sessao_revogada (jti, expira_em) VALUES (?, ?)
       ON CONFLICT(jti) DO UPDATE SET expira_em = excluded.expira_em`,
    )
    .run(jti, expiraEm);
}

/** Revoga a sessão do cookie atual, se a assinatura ainda confere. Não apaga o cookie. */
export async function revogarSessaoPainelDoPedido(request: Request) {
  const sessao = await lerSessaoPainel(lerCookie(request, COOKIE_SESSAO_PAINEL));
  if (!sessao.ok) return;
  revogarJti(sessao.jti, sessao.auth_time + TETO_ABSOLUTO_PAINEL_S);
}
