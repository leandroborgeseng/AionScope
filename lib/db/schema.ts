/** SQL do schema inicial (versionado). */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS parque_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  valor_manual REAL,
  valor_api REAL,
  escopo TEXT NOT NULL DEFAULT 'todos',
  fonte TEXT NOT NULL DEFAULT 'api',
  atualizado_em TEXT,
  atualizado_por TEXT,
  valor_manual_referencia REAL,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS contratos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  fornecedor TEXT,
  valor_mensal REAL NOT NULL,
  inicio TEXT,
  fim TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipamentos_terceiros (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL,
  descricao TEXT,
  medico_responsavel TEXT,
  setor TEXT,
  observacao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equipamentos_terceiros_tag
  ON equipamentos_terceiros (tag);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_impedimento (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL,
  equipamento TEXT,
  motivo TEXT NOT NULL,
  nova_data TEXT,
  registrado_por TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_aquisicao (
  id TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em andamento',
  previsao TEXT,
  observacao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_obra (
  id TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em andamento',
  previsao TEXT,
  observacao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_treinamento (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  tema TEXT NOT NULL,
  participantes INTEGER NOT NULL DEFAULT 0,
  evidencia INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_alerta (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  equipamentos TEXT,
  segregados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  observacao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_melhoria (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sala_feriado (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const MIGRATION_NAME = "001_init";
export const MIGRATION_SALA_MANUAL = "002_sala_manual";
