/**
 * 020 — Revogação da sessão do painel.
 * Aditiva: só CREATE TABLE/INDEX IF NOT EXISTS. Não apaga sessão já revogada.
 * `expira_em` é o teto absoluto (auth_time + 8 h), em segundos unix.
 */
import type Database from "better-sqlite3";

export const MIGRATION_PAINEL_SESSAO_REVOGADA = "020_painel_sessao_revogada";

export function aplicarMigration020PainelSessaoRevogada(db: Database.Database, nome = MIGRATION_PAINEL_SESSAO_REVOGADA) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS painel_sessao_revogada (
        jti TEXT PRIMARY KEY,
        expira_em INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_painel_sessao_revogada_expira
        ON painel_sessao_revogada (expira_em);
    `);
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
