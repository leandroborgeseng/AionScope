/**
 * Schema SQLite — espelho de lib/db/schema.ts (versionado para revisão).
 *
 * parque_meta (singleton id=1)
 *   valor_manual REAL              -- override opcional
 *   valor_api REAL                 -- soma ValorDeSubstituicao (escopo)
 *   escopo TEXT DEFAULT 'todos'    -- 'todos' | 'medicos'
 *   fonte TEXT DEFAULT 'api'       -- 'api' | 'manual'
 *   atualizado_em TEXT
 *   atualizado_por TEXT
 *   valor_manual_referencia REAL   -- nota ~57 mi
 *   notas TEXT
 *
 * contratos
 *   id, nome, fornecedor, valor_mensal, inicio, fim, ativo,
 *   observacao, created_at, updated_at
 *
 * schema_migrations
 *   id, name, applied_at
 */
export {};
