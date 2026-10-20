/**
 * 009 — Contratos próprios do AionScope.
 * Aditiva e idempotente: só ADD COLUMN (quando a coluna não existe) e CREATE INDEX IF NOT EXISTS.
 * Não altera nem apaga linhas existentes; contratos antigos ficam com tipo NULL ("Sem tipo").
 */
import type Database from "better-sqlite3";

const COLUNAS: Array<[string, string]> = [
  ["tipo", "TEXT"],
  ["equipamento", "TEXT"],
  ["numero", "TEXT"],
  ["chave_importacao", "TEXT"],
];

export function aplicarMigration009ContratosProprios(db: Database.Database, nome = "009_contratos_proprios") {
  const tx = db.transaction(() => {
    const cols = db.prepare("PRAGMA table_info(contratos)").all() as Array<{ name: string }>;
    const existentes = new Set(cols.map((c) => c.name));
    for (const [coluna, tipoSql] of COLUNAS) {
      if (!existentes.has(coluna)) db.exec(`ALTER TABLE contratos ADD COLUMN ${coluna} ${tipoSql}`);
    }
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_contratos_chave_importacao ON contratos (chave_importacao) WHERE chave_importacao IS NOT NULL",
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_contratos_tipo ON contratos (tipo)");
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (9, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
