/**
 * 014 — Histórico do valor do parque (factory/parque-auto, P4).
 * Aditiva e idempotente: só CREATE TABLE/INDEX IF NOT EXISTS. Não altera nem apaga linhas de parque_meta.
 * parque_valor_mensal: uma foto por mês (último valor do mês, chave YYYY-MM BRT).
 * `competencia` (YYYY-MM, BRT) permite, no futuro, uma regra mensal (cada mês divide pelo próprio valor).
 */
import type Database from "better-sqlite3";

export const MIGRATION_PARQUE_HISTORICO = "014_parque_historico";

export function aplicarMigration014ParqueHistorico(db: Database.Database, nome = MIGRATION_PARQUE_HISTORICO) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS parque_valor_historico (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        registrado_em TEXT NOT NULL,
        competencia TEXT NOT NULL,
        origem TEXT NOT NULL,
        valor_anterior REAL,
        atualizado_em_anterior TEXT,
        valor_novo REAL NOT NULL,
        itens_com_valor INTEGER NOT NULL,
        itens_total INTEGER NOT NULL,
        atualizado_por TEXT
      );
      CREATE TABLE IF NOT EXISTS parque_valor_mensal (
        competencia TEXT PRIMARY KEY,
        valor REAL NOT NULL,
        itens_com_valor INTEGER NOT NULL,
        itens_total INTEGER NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_parque_hist_competencia ON parque_valor_historico (competencia, registrado_em);
    `);
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (14, ?, ?)").run(nome, new Date().toISOString());
    }
  });
  tx();
}
