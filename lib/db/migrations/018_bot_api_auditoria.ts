/**
 * 018 — Auditoria da API só-leitura do bot.
 * Aditiva: só CREATE TABLE/INDEX IF NOT EXISTS.
 * Não há coluna de corpo, telefone completo, e-mail, setor ou token.
 */
import type Database from "better-sqlite3";

export const MIGRATION_BOT_API_AUDITORIA = "018_bot_api_auditoria";

export function aplicarMigration018BotApiAuditoria(db: Database.Database, nome = MIGRATION_BOT_API_AUDITORIA) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_api_auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        criado_em TEXT NOT NULL,
        usuario_id TEXT,
        bot_id TEXT,
        rota TEXT NOT NULL,
        query_hash TEXT NOT NULL,
        telefone_mascarado TEXT,
        status INTEGER NOT NULL,
        latencia_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bot_api_auditoria_criado ON bot_api_auditoria (criado_em);
      CREATE INDEX IF NOT EXISTS idx_bot_api_auditoria_usuario ON bot_api_auditoria (usuario_id, criado_em);
    `);
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (18, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
