/**
 * 013 — Suspensão de contrato por período (indicador custo/parque).
 * Aditiva e idempotente: só ADD COLUMN suspenso_de / suspenso_ate (TEXT, nulas) quando não existem.
 * Não altera nem apaga linhas. (011 reservada para a branch de locação.)
 * suspenso_de = primeiro dia suspenso; suspenso_ate = último dia suspenso (inclusivo), ambos YYYY-MM-DD (BRT).
 */
import type Database from "better-sqlite3";

export const MIGRATION_CONTRATOS_SUSPENSAO = "013_contratos_suspensao";

export function aplicarMigration013ContratosSuspensao(db: Database.Database, nome = MIGRATION_CONTRATOS_SUSPENSAO) {
  const tx = db.transaction(() => {
    const cols = new Set((db.prepare("PRAGMA table_info(contratos)").all() as Array<{ name: string }>).map((c) => c.name));
    if (!cols.has("suspenso_de")) db.exec("ALTER TABLE contratos ADD COLUMN suspenso_de TEXT");
    if (!cols.has("suspenso_ate")) db.exec("ALTER TABLE contratos ADD COLUMN suspenso_ate TEXT");
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (13, ?, ?)").run(nome, new Date().toISOString());
    }
  });
  tx();
}
