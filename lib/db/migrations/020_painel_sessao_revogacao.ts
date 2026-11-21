/**
 * 020 — Revogação por sessão do painel.
 * Aditiva. Banco novo: `painel_sessao_revogacao (jti, revogada_em)`.
 * Banco que já criou o corte global (id, emitidas_ate) nesta branch:
 * a tabela antiga fica e entra `painel_sessao_jti`. Nada é apagado.
 */
import type Database from "better-sqlite3";

export const MIGRATION_PAINEL_SESSAO_REVOGACAO = "020_painel_sessao_revogacao";

const TABELA_JTI = `
  CREATE TABLE IF NOT EXISTS painel_sessao_jti (
    jti TEXT PRIMARY KEY,
    revogada_em INTEGER NOT NULL
  );
`;

export function aplicarMigration020PainelSessaoRevogacao(
  db: Database.Database,
  nome = MIGRATION_PAINEL_SESSAO_REVOGACAO,
) {
  const tx = db.transaction(() => {
    const cols = db.prepare("PRAGMA table_info(painel_sessao_revogacao)").all() as Array<{ name: string }>;
    const nomes = new Set(cols.map((coluna) => coluna.name));
    if (nomes.has("emitidas_ate") && !nomes.has("jti")) {
      db.exec(TABELA_JTI);
    } else if (!nomes.has("jti")) {
      db.exec(`
        CREATE TABLE painel_sessao_revogacao (
          jti TEXT PRIMARY KEY,
          revogada_em INTEGER NOT NULL
        );
      `);
    }
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (20, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
