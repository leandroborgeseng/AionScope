/**
 * Tabela equipamentos_terceiros (CREATE IF NOT EXISTS em lib/db/schema.ts).
 *
 * Acompanhamento local de equipamentos de médicos/terceiros (Situação TERCEIRO na API).
 *   id TEXT PK
 *   tag TEXT NOT NULL (unique case-insensitive)
 *   descricao TEXT
 *   medico_responsavel TEXT  -- médico / responsável local
 *   setor TEXT
 *   observacao TEXT
 *   ativo INTEGER DEFAULT 1
 *   created_at / updated_at TEXT
 *
 * Cruzamento com API PBI por Tag (anexos, OS preventivas, ValorDeSubstituicao).
 */
export {};
