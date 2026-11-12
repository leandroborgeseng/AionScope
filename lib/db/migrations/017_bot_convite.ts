/**
 * 017 — Pré-cadastro pelo link único do grupo.
 * A 016 desta base já é a entrega (`016_bot_entrega`, id 16). Esta é a seguinte.
 * Só aditiva e idempotente: CREATE TABLE IF NOT EXISTS e ADD COLUMN se a coluna não existe.
 * Não dá UPDATE nem DELETE em linhas já existentes de `bot_usuario`.
 * Reimportar setores faz upsert e não apaga vínculo em `bot_usuario_setor`.
 */
import type Database from "better-sqlite3";
import { importarSetoresEffort } from "@/lib/bot/setores";

export const MIGRATION_BOT_CONVITE = "017_bot_convite";

const COLUNAS_USUARIO = ["funcao_declarada", "descricao_funcao", "convite_id", "ciencia_em"] as const;

export function aplicarMigration017BotConvite(db: Database.Database, nome = MIGRATION_BOT_CONVITE) {
  const tx = db.transaction(() => {
    const cols = db.prepare("PRAGMA table_info(bot_usuario)").all() as Array<{ name: string }>;
    const nomes = new Set(cols.map((coluna) => coluna.name));
    for (const coluna of COLUNAS_USUARIO) {
      if (!nomes.has(coluna)) db.exec(`ALTER TABLE bot_usuario ADD COLUMN ${coluna} TEXT`);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_setor (
        codigo TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        unidade TEXT,
        ativo INTEGER NOT NULL CHECK (ativo IN (0, 1)),
        exportado_em TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_usuario_setor (
        usuario_id TEXT NOT NULL,
        setor_codigo TEXT NOT NULL,
        PRIMARY KEY (usuario_id, setor_codigo),
        FOREIGN KEY (usuario_id) REFERENCES bot_usuario(id) ON DELETE CASCADE,
        FOREIGN KEY (setor_codigo) REFERENCES bot_setor(codigo)
      );

      CREATE TABLE IF NOT EXISTS bot_convite_grupo (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        token_cifrado TEXT,
        expira_em TEXT NOT NULL,
        revogado_em TEXT,
        criado_por TEXT NOT NULL,
        criado_em TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_convite_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        validade_dias INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_convite_limite (
        chave TEXT PRIMARY KEY,
        n INTEGER NOT NULL,
        expira_em INTEGER NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO bot_convite_config (id, validade_dias)
       SELECT 1, 7
       WHERE NOT EXISTS (SELECT 1 FROM bot_convite_config WHERE id = 1)`,
    ).run();

    const aplicada = db.prepare("SELECT id FROM schema_migrations WHERE name = ?").get(nome);
    if (!aplicada) {
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (17, ?, ?)").run(
        nome,
        new Date().toISOString(),
      );
    }
  });
  tx();
  // A carga roda fora da transação da migration para poder ser repetida sozinha.
  // Upsert: não apaga setor nem vínculo.
  importarSetoresEffort(db);
}
