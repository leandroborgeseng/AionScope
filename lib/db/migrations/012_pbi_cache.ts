/**
 * 012 — Cache persistente da GlobalThings (cópia em disco no volume /data).
 * Aditiva e idempotente: só CREATE TABLE/INDEX IF NOT EXISTS. Não toca em nenhuma tabela existente.
 * (011 reservado para a branch de locação ainda não publicada.)
 * O conteúdo é descartável (pode ser apagado sem perda de dado de negócio) e nunca guarda token.
 */
import type Database from "better-sqlite3";

export const MIGRATION_PBI_CACHE = "012_pbi_cache";

export function aplicarMigration012PbiCache(db: Database.Database, nome = MIGRATION_PBI_CACHE) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pbi_cache (
        cache_key TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        query TEXT NOT NULL,
        payload TEXT,
        fetched_at INTEGER,
        last_attempt_at INTEGER,
        last_error_status INTEGER,
        last_error_message TEXT,
        last_error_at INTEGER,
        last_access_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pbi_cache_resource ON pbi_cache (resource);
    `);
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (12, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
