/**
 * 020 — Corte das sessões do painel.
 * Aditiva: só CREATE TABLE IF NOT EXISTS. Uma linha (id = 1) guarda o instante
 * até o qual cookies já emitidos deixam de valer. Logout grava; nada é apagado.
 */
import type Database from "better-sqlite3";

export const MIGRATION_PAINEL_SESSAO_REVOGACAO = "020_painel_sessao_revogacao";

export function aplicarMigration020PainelSessaoRevogacao(
  db: Database.Database,
  nome = MIGRATION_PAINEL_SESSAO_REVOGACAO,
) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS painel_sessao_revogacao (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        emitidas_ate INTEGER NOT NULL
      );
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
