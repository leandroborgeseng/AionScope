/**
 * 010 — Data de inativação dos contratos (indicador custo/parque, D-I6).
 * Aditiva e idempotente: só ADD COLUMN inativado_em (TEXT, nula) quando não existe.
 * Não altera nem apaga linhas: contratos já inativos ficam com data nula (não contam em nenhum mês).
 */
import type Database from "better-sqlite3";

export const MIGRATION_CONTRATOS_INATIVADO_EM = "010_contratos_inativado_em";

export function aplicarMigration010ContratosInativadoEm(
  db: Database.Database,
  nome = MIGRATION_CONTRATOS_INATIVADO_EM,
) {
  const tx = db.transaction(() => {
    const cols = db.prepare("PRAGMA table_info(contratos)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "inativado_em")) {
      db.exec("ALTER TABLE contratos ADD COLUMN inativado_em TEXT");
    }
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (10, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
