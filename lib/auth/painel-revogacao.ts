/**
 * Logout sem estado: o cookie copiado continuava válido até o teto de 8 h.
 * O corte fica no SQLite (migration 020). Cookie com `iat` até esse instante não abre.
 * Uma saída encerra todas as sessões do painel já emitidas — a mesma conta é compartilhada.
 */
import { getDb } from "@/lib/db/client";

export function corteEmitidasAte(): number {
  const linha = getDb()
    .prepare("SELECT emitidas_ate AS ate FROM painel_sessao_revogacao WHERE id = 1")
    .get() as { ate: number } | undefined;
  return linha && Number.isSafeInteger(linha.ate) && linha.ate > 0 ? linha.ate : 0;
}

/**
 * Grava o corte em segundos. Não recua.
 * Sobe pelo menos um segundo em relação ao corte anterior: um cookie emitido
 * no mesmo segundo da saída anterior recebe `iat = corte + 1` e também cai.
 */
export function revogarSessoesPainel(agoraMs = Date.now()): number {
  const ate = Math.max(Math.floor(agoraMs / 1000), corteEmitidasAte() + 1);
  getDb()
    .prepare(
      `INSERT INTO painel_sessao_revogacao (id, emitidas_ate) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET emitidas_ate = MAX(painel_sessao_revogacao.emitidas_ate, excluded.emitidas_ate)`,
    )
    .run(ate);
  return corteEmitidasAte();
}

export function sessaoDentroDaRevogacao(iat: number) {
  return iat > corteEmitidasAte();
}

/**
 * Relógio para um cookie novo sobreviver ao corte.
 * Um `agora` antigo (teste de expiração) não é puxado para a frente quando já passa do corte.
 */
export function instanteAposRevogacao(agoraMs = Date.now()): number {
  const minimo = (corteEmitidasAte() + 1) * 1000;
  return agoraMs >= minimo ? agoraMs : minimo;
}
