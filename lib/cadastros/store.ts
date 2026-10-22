import { getDb } from "@/lib/db/client";
import { agoraBRTIso } from "@/lib/cadastros/contratos-proprios";
import type {
  Contrato,
  ParqueEscopo,
  ParqueFonte,
  ParqueMeta,
} from "./types";

type ParqueRow = {
  valor_manual: number | null;
  valor_api: number | null;
  escopo: string;
  fonte: string;
  atualizado_em: string | null;
  atualizado_por: string | null;
  valor_manual_referencia: number | null;
  notas: string | null;
};

type ContratoRow = {
  id: string;
  nome: string;
  fornecedor: string | null;
  valor_mensal: number;
  inicio: string | null;
  fim: string | null;
  ativo: number;
  observacao: string | null;
  tipo?: string | null;
  equipamento?: string | null;
  numero?: string | null;
  chave_importacao?: string | null;
  inativado_em?: string | null;
  suspenso_de?: string | null;
  suspenso_ate?: string | null;
};

const EMPTY_PARQUE: ParqueMeta = {
  valorSubstituicaoManual: null,
  valorApi: null,
  fonte: "api",
  escopo: "todos",
  atualizadoEm: null,
  atualizadoPor: null,
  valorManualReferencia: 57_000_000,
  notas: null,
};

function mapParque(row: ParqueRow | undefined): ParqueMeta {
  if (!row) return { ...EMPTY_PARQUE };
  return {
    valorSubstituicaoManual:
      row.valor_manual != null && Number.isFinite(row.valor_manual) ? row.valor_manual : null,
    valorApi: row.valor_api != null && Number.isFinite(row.valor_api) ? row.valor_api : null,
    fonte: row.fonte === "manual" ? "manual" : "api",
    escopo: row.escopo === "medicos" ? "medicos" : "todos",
    atualizadoEm: row.atualizado_em,
    atualizadoPor: row.atualizado_por,
    valorManualReferencia:
      row.valor_manual_referencia != null && Number.isFinite(row.valor_manual_referencia)
        ? row.valor_manual_referencia
        : 57_000_000,
    notas: row.notas,
  };
}

function mapContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    nome: row.nome,
    fornecedor: row.fornecedor ?? undefined,
    valorMensal: row.valor_mensal,
    inicio: row.inicio,
    fim: row.fim,
    ativo: row.ativo === 1,
    observacao: row.observacao ?? undefined,
    tipo: row.tipo === "MANUTENCAO" || row.tipo === "LOCACAO" ? row.tipo : null,
    equipamento: row.equipamento ?? null,
    numero: row.numero ?? null,
    chaveImportacao: row.chave_importacao ?? null,
    inativadoEm: row.inativado_em ?? null,
    suspensoDe: row.suspenso_de ?? null,
    suspensoAte: row.suspenso_ate ?? null,
  };
}

export function readParqueMeta(): ParqueMeta {
  const db = getDb();
  const row = db.prepare("SELECT * FROM parque_meta WHERE id = 1").get() as ParqueRow | undefined;
  return mapParque(row);
}

export function writeParqueMeta(meta: Partial<ParqueMeta> & { fonte?: ParqueFonte; escopo?: ParqueEscopo }): ParqueMeta {
  const db = getDb();
  const current = readParqueMeta();
  const next: ParqueMeta = {
    valorSubstituicaoManual:
      meta.valorSubstituicaoManual !== undefined
        ? meta.valorSubstituicaoManual
        : current.valorSubstituicaoManual,
    valorApi: meta.valorApi !== undefined ? meta.valorApi : current.valorApi,
    fonte: meta.fonte ?? current.fonte,
    escopo: meta.escopo ?? current.escopo,
    atualizadoEm: meta.atualizadoEm !== undefined ? meta.atualizadoEm : current.atualizadoEm,
    atualizadoPor:
      meta.atualizadoPor !== undefined ? meta.atualizadoPor : (current.atualizadoPor ?? null),
    valorManualReferencia:
      meta.valorManualReferencia !== undefined
        ? meta.valorManualReferencia
        : current.valorManualReferencia,
    notas: meta.notas !== undefined ? meta.notas : current.notas,
  };

  db.prepare(
    `INSERT INTO parque_meta (
      id, valor_manual, valor_api, escopo, fonte, atualizado_em, atualizado_por,
      valor_manual_referencia, notas
    ) VALUES (
      1, @valor_manual, @valor_api, @escopo, @fonte, @atualizado_em, @atualizado_por,
      @valor_manual_referencia, @notas
    )
    ON CONFLICT(id) DO UPDATE SET
      valor_manual = excluded.valor_manual,
      valor_api = excluded.valor_api,
      escopo = excluded.escopo,
      fonte = excluded.fonte,
      atualizado_em = excluded.atualizado_em,
      atualizado_por = excluded.atualizado_por,
      valor_manual_referencia = excluded.valor_manual_referencia,
      notas = excluded.notas`,
  ).run({
    valor_manual: next.valorSubstituicaoManual,
    valor_api: next.valorApi,
    escopo: next.escopo,
    fonte: next.fonte,
    atualizado_em: next.atualizadoEm,
    atualizado_por: next.atualizadoPor ?? null,
    valor_manual_referencia: next.valorManualReferencia,
    notas: next.notas ?? null,
  });

  return next;
}

export function readContratos(): Contrato[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM contratos ORDER BY fornecedor COLLATE NOCASE ASC, nome COLLATE NOCASE ASC")
    .all() as ContratoRow[];
  return rows.map(mapContrato);
}

export function readContrato(id: string): Contrato | null {
  const row = getDb().prepare("SELECT * FROM contratos WHERE id = ?").get(id) as ContratoRow | undefined;
  return row ? mapContrato(row) : null;
}

/**
 * Cria ou atualiza um contrato. Nunca altera chave_importacao (só a importação grava).
 * Não existe exclusão física: use setContratoAtivo.
 */
export function upsertContrato(contrato: Contrato): Contrato {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO contratos (
      id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, tipo, equipamento, numero, inativado_em,
      created_at, updated_at
    ) VALUES (
      @id, @nome, @fornecedor, @valor_mensal, @inicio, @fim, @ativo, @observacao, @tipo, @equipamento, @numero,
      CASE WHEN @ativo = 1 THEN NULL ELSE @agora_brt END,
      @now, @now
    )
    ON CONFLICT(id) DO UPDATE SET
      nome = excluded.nome,
      fornecedor = excluded.fornecedor,
      valor_mensal = excluded.valor_mensal,
      inicio = excluded.inicio,
      fim = excluded.fim,
      ativo = excluded.ativo,
      observacao = excluded.observacao,
      tipo = excluded.tipo,
      equipamento = excluded.equipamento,
      numero = excluded.numero,
      inativado_em = ${SQL_INATIVADO_EM},
      updated_at = excluded.updated_at`,
  ).run({
    id: contrato.id,
    nome: contrato.nome,
    fornecedor: contrato.fornecedor ?? null,
    valor_mensal: contrato.valorMensal,
    inicio: contrato.inicio ?? null,
    fim: contrato.fim ?? null,
    ativo: contrato.ativo ? 1 : 0,
    observacao: contrato.observacao ?? null,
    tipo: contrato.tipo ?? null,
    equipamento: contrato.equipamento ?? null,
    numero: contrato.numero ?? null,
    agora_brt: agoraBRTIso(),
    now,
  });
  return readContrato(contrato.id) ?? contrato;
}

/**
 * Transição de inativado_em (010): reativar limpa; ativo→inativo grava agora (BRT);
 * inativo→inativo mantém (inclusive nulo dos inativados antes da 010).
 */
const SQL_INATIVADO_EM =
  "CASE WHEN excluded.ativo = 1 THEN NULL WHEN contratos.ativo = 1 THEN excluded.inativado_em ELSE contratos.inativado_em END";

/** Inativa/reativa sem apagar a linha; grava/limpa inativado_em. */
export function setContratoAtivo(id: string, ativo: boolean): Contrato | null {
  const db = getDb();
  const r = db
    .prepare(
      `UPDATE contratos SET
         inativado_em = CASE WHEN @ativo = 1 THEN NULL WHEN ativo = 1 THEN @agora_brt ELSE inativado_em END,
         ativo = @ativo, updated_at = @now
       WHERE id = @id`,
    )
    .run({ ativo: ativo ? 1 : 0, agora_brt: agoraBRTIso(), now: new Date().toISOString(), id });
  return r.changes > 0 ? readContrato(id) : null;
}

/**
 * Correção da data efetiva de inativação (inativa se ainda ativo).
 * ultimoDiaQueConta = YYYY-MM-DD: conta até o mês dessa data. null = não conta em nenhum mês.
 */
export function setContratoInativacao(id: string, ultimoDiaQueConta: string | null): Contrato | null {
  const r = getDb()
    .prepare("UPDATE contratos SET ativo = 0, inativado_em = @ina, updated_at = @now WHERE id = @id")
    .run({ id, ina: ultimoDiaQueConta ? `${ultimoDiaQueConta}T23:59:59-03:00` : null, now: new Date().toISOString() });
  return r.changes > 0 ? readContrato(id) : null;
}

/** Grava/limpa a suspensão (013). Ambos null = sem suspensão. */
export function setContratoSuspensao(id: string, de: string | null, ate: string | null): Contrato | null {
  const r = getDb()
    .prepare("UPDATE contratos SET suspenso_de = @de, suspenso_ate = @ate, updated_at = @now WHERE id = @id")
    .run({ id, de, ate, now: new Date().toISOString() });
  return r.changes > 0 ? readContrato(id) : null;
}

/**
 * Denominador do parque: somente valorApi (soma ValorDeSubstituicao de todos).
 * Override manual e env PARQUE_VALOR_SUBSTITUICAO são ignorados.
 */
export function resolveValorParque(meta: ParqueMeta): {
  valor: number | null;
  fonte: "api" | null;
} {
  if (meta.valorApi != null && Number.isFinite(meta.valorApi) && meta.valorApi > 0) {
    return { valor: meta.valorApi, fonte: "api" };
  }
  return { valor: null, fonte: null };
}

/** @deprecated use resolveValorParque */
export function resolveValorParqueManual(meta: ParqueMeta) {
  return resolveValorParque(meta);
}
