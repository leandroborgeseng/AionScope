/**
 * 015 — Cadastro de usuários do bot (A12–A16).
 * Aditiva e idempotente: só CREATE TABLE/INDEX IF NOT EXISTS.
 * O telefone normalizado (E.164) é único só entre cadastros aprovados (ativo/inativo).
 * Pendentes e recusados com o mesmo número podem coexistir, para um pedido falso
 * não bloquear o verdadeiro. Auditoria sem corpo, telefone, e-mail ou setor.
 */
import type Database from "better-sqlite3";

export const MIGRATION_BOT_USUARIO = "015_bot_usuario";

export function aplicarMigration015BotUsuario(db: Database.Database, nome = MIGRATION_BOT_USUARIO) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_usuario (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        papel TEXT NOT NULL,
        telefone_e164 TEXT NOT NULL,
        situacao TEXT NOT NULL CHECK (situacao IN ('pendente', 'ativo', 'inativo', 'recusado')),
        dono TEXT NOT NULL,
        email TEXT,
        setor TEXT,
        outros_setores TEXT,
        aprovado_por TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL,
        verificado_em TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_bot_usuario_telefone ON bot_usuario (telefone_e164);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_usuario_telefone_aprovado
        ON bot_usuario (telefone_e164)
        WHERE situacao IN ('ativo', 'inativo');
      CREATE INDEX IF NOT EXISTS idx_bot_usuario_situacao ON bot_usuario (situacao);

      CREATE TABLE IF NOT EXISTS bot_auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        criado_em TEXT NOT NULL,
        usuario_id TEXT,
        ator TEXT NOT NULL,
        acao TEXT NOT NULL,
        recurso TEXT NOT NULL,
        status INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bot_auditoria_criado ON bot_auditoria (criado_em);
      CREATE INDEX IF NOT EXISTS idx_bot_auditoria_usuario ON bot_auditoria (usuario_id, criado_em);
    `);
    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (15, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
}
