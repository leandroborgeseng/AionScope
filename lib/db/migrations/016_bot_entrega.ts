/**
 * 016 — Status de entrega e motivo de recusa do cadastro do bot.
 * Aditiva e idempotente: só ADD COLUMN quando a coluna não existe.
 * `entrega_status` marca o pedido (pendente/enviada/falhou). Reenviar não dispara mensagem.
 * O motivo fica no cadastro, nunca na auditoria.
 */
import type Database from "better-sqlite3";

export const MIGRATION_BOT_ENTREGA = "016_bot_entrega";

export function aplicarMigration016BotEntrega(db: Database.Database, nome = MIGRATION_BOT_ENTREGA) {
  const tx = db.transaction(() => {
    const cols = db.prepare("PRAGMA table_info(bot_usuario)").all() as Array<{ name: string }>;
    const nomes = new Set(cols.map((coluna) => coluna.name));
    if (!nomes.has("entrega_status")) {
      db.exec("ALTER TABLE bot_usuario ADD COLUMN entrega_status TEXT NOT NULL DEFAULT 'pendente'");
    }
    if (!nomes.has("entrega_pedido_em")) {
      db.exec("ALTER TABLE bot_usuario ADD COLUMN entrega_pedido_em TEXT");
    }
    if (!nomes.has("motivo_recusa")) {
      db.exec("ALTER TABLE bot_usuario ADD COLUMN motivo_recusa TEXT");
    }
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (16, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
