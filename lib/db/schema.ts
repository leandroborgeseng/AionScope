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

CREATE TABLE IF NOT EXISTS compra (
  id TEXT PRIMARY KEY,
  os TEXT,
  tag TEXT,
  equipamento TEXT,
  item TEXT,
  setor TEXT,
  solicitante_caixa TEXT,
  enviado_em TEXT,
  sc_numero TEXT,
  sc_em TEXT,
  entregue_em TEXT,
  origem_entrega TEXT,
  situacao TEXT NOT NULL,
  conversation_id TEXT,
  revisado_por TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compra_situacao ON compra (situacao);
CREATE INDEX IF NOT EXISTS idx_compra_conversation ON compra (conversation_id);
CREATE INDEX IF NOT EXISTS idx_compra_os ON compra (os);

CREATE TABLE IF NOT EXISTS compra_email (
  id TEXT PRIMARY KEY,
  compra_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  direcao TEXT NOT NULL,
  data TEXT NOT NULL,
  de TEXT,
  para TEXT,
  assunto TEXT,
  trecho TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (compra_id) REFERENCES compra (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compra_email_compra ON compra_email (compra_id);

CREATE TABLE IF NOT EXISTS graph_delta (
  id TEXT PRIMARY KEY,
  caixa TEXT NOT NULL,
  pasta TEXT NOT NULL,
  delta_link TEXT,
  atualizado_em TEXT NOT NULL,
  UNIQUE (caixa, pasta)
);

CREATE TABLE IF NOT EXISTS ordens_compra (
  numero_ordem TEXT PRIMARY KEY,
  status TEXT,
  categoria TEXT,
  data_pedido TEXT,
  data_ordem TEXT,
  data_entrega TEXT,
  itens_entregues TEXT,
  valor_total TEXT,
  fornecedor TEXT,
  numero_orcamento TEXT,
  numero_os TEXT,
  setor_equipamento TEXT,
  origem TEXT,
  solicitante TEXT,
  assunto_email TEXT,
  email_message_id TEXT,
  anexo_origem TEXT,
  confianca TEXT,
  observacoes TEXT,
  ordens_relacionadas TEXT,
  fonte TEXT NOT NULL DEFAULT 'email_robot',
  editado_manualmente TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ordens_compra_categoria ON ordens_compra (categoria);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_fornecedor ON ordens_compra (fornecedor);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_os ON ordens_compra (numero_os);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_updated ON ordens_compra (updated_at);

CREATE TABLE IF NOT EXISTS ordem_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_ordem TEXT NOT NULL,
  descricao TEXT,
  quantidade TEXT,
  unidade TEXT,
  valor_unitario TEXT,
  valor_total TEXT,
  codigo TEXT,
  posicao INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (numero_ordem) REFERENCES ordens_compra (numero_ordem) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ordem_itens_ordem ON ordem_itens (numero_ordem);

CREATE TABLE IF NOT EXISTS ordens_compra_api_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  metodo TEXT NOT NULL,
  rota TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  detalhe TEXT
);
`;

export const MIGRATION_NAME = "001_init";
export const MIGRATION_SALA_MANUAL = "002_sala_manual";
export const MIGRATION_COMPRAS_EMAIL = "003_compras_email";
export const MIGRATION_ORDENS_COMPRA = "004_ordens_compra";
export const MIGRATION_ORDENS_COMPRA_ENTREGA = "005_ordens_compra_entrega";
