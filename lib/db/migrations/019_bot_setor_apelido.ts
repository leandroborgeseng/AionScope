/**
 * 019 — Apelidos de setor da API do bot.
 * Aditiva: só CREATE TABLE IF NOT EXISTS e, na primeira aplicação, o apelido inicial.
 * CC aponta para o nome canônico Centro Cirúrgico. Apagar essa linha não a recria no próximo boot.
 */
import type Database from "better-sqlite3";

export const MIGRATION_BOT_SETOR_APELIDO = "019_bot_setor_apelido";

export function aplicarMigration019BotSetorApelido(db: Database.Database, nome = MIGRATION_BOT_SETOR_APELIDO) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_setor_apelido (
        apelido TEXT NOT NULL,
        nome TEXT NOT NULL,
        PRIMARY KEY (apelido, nome)
      );
    `);
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare(
        `INSERT INTO bot_setor_apelido (apelido, nome)
         SELECT 'CC', 'Centro Cirúrgico'
         WHERE NOT EXISTS (
           SELECT 1 FROM bot_setor_apelido WHERE apelido = 'CC' AND nome = 'Centro Cirúrgico'
         )`,
      ).run();
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (19, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
