import { getDb } from "@/lib/db/client";
import { listarAnexosOrdem } from "./anexos";
import {
  CAMPOS_ORDEM,
  type CategoriaOrdem,
  type EditadoManualmente,
  type ItemOrdem,
  type ListaFiltros,
  type ListaOrdens,
  type OrdemCompra,
  type ParsedOrdem,
  type PatchSalaOrdem,
  type PedidoTvOrdem,
} from "./types";

type OrdemRow = {
  numero_ordem: string;
  status: string | null;
  categoria: string | null;
  data_pedido: string | null;
  data_ordem: string | null;
  data_entrega: string | null;
  itens_entregues: string | null;
  motivo_exclusao: string | null;
  valor_total: string | null;
  fornecedor: string | null;
  numero_orcamento: string | null;
  numero_os: string | null;
  setor_equipamento: string | null;
  origem: string | null;
  solicitante: string | null;
  assunto_email: string | null;
  email_message_id: string | null;
  anexo_origem: string | null;
  confianca: string | null;
  observacoes: string | null;
  ordens_relacionadas: string | null;
  fonte: string;
  editado_manualmente: string;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  descricao: string | null;
  quantidade: string | null;
  unidade: string | null;
  valor_unitario: string | null;
  valor_total: string | null;
  codigo: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function parseEditado(raw: string | null): EditadoManualmente {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as EditadoManualmente;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function parseRelacionadas(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.map((x) => String(x)) : null;
  } catch {
    return null;
  }
}

function rowParaOrdem(row: OrdemRow, itens: ItemOrdem[]): OrdemCompra {
  return {
    numero_ordem: row.numero_ordem,
    status: (row.status as OrdemCompra["status"]) ?? null,
    categoria: (row.categoria as OrdemCompra["categoria"]) ?? null,
    data_pedido: row.data_pedido,
    data_ordem: row.data_ordem,
    data_entrega: row.data_entrega ?? null,
    itens_entregues: row.itens_entregues ?? null,
    motivo_exclusao: row.motivo_exclusao ?? null,
    valor_total: row.valor_total,
    fornecedor: row.fornecedor,
    numero_orcamento: row.numero_orcamento,
    numero_os: row.numero_os,
    setor_equipamento: row.setor_equipamento,
    origem: (row.origem as OrdemCompra["origem"]) ?? null,
    solicitante: row.solicitante,
    assunto_email: row.assunto_email,
    email_message_id: row.email_message_id,
    anexo_origem: row.anexo_origem,
    confianca: (row.confianca as OrdemCompra["confianca"]) ?? null,
    observacoes: row.observacoes,
    ordens_relacionadas: parseRelacionadas(row.ordens_relacionadas),
    itens,
    anexos: listarAnexosOrdem(row.numero_ordem),
    fonte: row.fonte,
    editado_manualmente: parseEditado(row.editado_manualmente),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function itensDaOrdem(numero: string): ItemOrdem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT descricao, quantidade, unidade, valor_unitario, valor_total, codigo
       FROM ordem_itens WHERE numero_ordem = ? ORDER BY posicao ASC, id ASC`,
    )
    .all(numero) as ItemRow[];
}

function substituirItens(numero: string, itens: ItemOrdem[]) {
  const db = getDb();
  db.prepare("DELETE FROM ordem_itens WHERE numero_ordem = ?").run(numero);
  const insert = db.prepare(
    `INSERT INTO ordem_itens (
      numero_ordem, descricao, quantidade, unidade, valor_unitario, valor_total, codigo, posicao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  itens.forEach((item, posicao) => {
    insert.run(
      numero,
      item.descricao,
      item.quantidade,
      item.unidade,
      item.valor_unitario,
      item.valor_total,
      item.codigo,
      posicao,
    );
  });
}

function obterRow(numero: string): OrdemRow | undefined {
  return getDb().prepare("SELECT * FROM ordens_compra WHERE numero_ordem = ?").get(numero) as
    | OrdemRow
    | undefined;
}

export function obterOrdemCompra(numero: string): OrdemCompra | undefined {
  const row = obterRow(numero);
  if (!row) return undefined;
  return rowParaOrdem(row, itensDaOrdem(numero));
}

function valoresInsert(parsed: ParsedOrdem, agora: string) {
  const c = parsed.campos;
  return {
    numero_ordem: parsed.numero_ordem,
    status: c.status ?? null,
    categoria: c.categoria ?? null,
    data_pedido: c.data_pedido ?? null,
    data_ordem: c.data_ordem ?? null,
    data_entrega: null,
    itens_entregues: null,
    motivo_exclusao: null,
    valor_total: c.valor_total ?? null,
    fornecedor: c.fornecedor ?? null,
    numero_orcamento: c.numero_orcamento ?? null,
    numero_os: c.numero_os ?? null,
    setor_equipamento: c.setor_equipamento ?? null,
    origem: c.origem ?? null,
    solicitante: c.solicitante ?? null,
    assunto_email: c.assunto_email ?? null,
    email_message_id: c.email_message_id ?? null,
    anexo_origem: c.anexo_origem ?? null,
    confianca: c.confianca ?? null,
    observacoes: c.observacoes ?? null,
    ordens_relacionadas: c.ordens_relacionadas ? JSON.stringify(c.ordens_relacionadas) : null,
    fonte: "email_robot",
    editado_manualmente: "{}",
    created_at: agora,
    updated_at: agora,
  };
}

export function upsertOrdemCompra(parsed: ParsedOrdem): { created: boolean; ordem: OrdemCompra } {
  const db = getDb();
  const agora = nowIso();
  return db.transaction(() => {
    const existente = obterRow(parsed.numero_ordem);
    if (!existente) {
      db.prepare(
        `INSERT INTO ordens_compra (
          numero_ordem, status, categoria, data_pedido, data_ordem, data_entrega, itens_entregues,
          motivo_exclusao, valor_total, fornecedor, numero_orcamento, numero_os, setor_equipamento,
          origem, solicitante, assunto_email, email_message_id, anexo_origem, confianca, observacoes,
          ordens_relacionadas, fonte, editado_manualmente, created_at, updated_at
        ) VALUES (
          @numero_ordem, @status, @categoria, @data_pedido, @data_ordem, @data_entrega, @itens_entregues,
          @motivo_exclusao, @valor_total, @fornecedor, @numero_orcamento, @numero_os, @setor_equipamento,
          @origem, @solicitante, @assunto_email, @email_message_id, @anexo_origem, @confianca, @observacoes,
          @ordens_relacionadas, @fonte, @editado_manualmente, @created_at, @updated_at
        )`,
      ).run(valoresInsert(parsed, agora));
      if (parsed.itens) substituirItens(parsed.numero_ordem, parsed.itens);
      return { created: true, ordem: obterOrdemCompra(parsed.numero_ordem)! };
    }

    const protegido = parseEditado(existente.editado_manualmente);
    const merged: Record<string, unknown> = { ...existente, updated_at: agora };

    for (const nome of CAMPOS_ORDEM) {
      if (!Object.prototype.hasOwnProperty.call(parsed.campos, nome)) continue;
      if (protegido[nome]) continue;
      const valor = parsed.campos[nome];
      merged[nome] = nome === "ordens_relacionadas" ? (valor ? JSON.stringify(valor) : null) : (valor ?? null);
    }

    // data_entrega / itens_entregues nunca vêm do robô — preservados no merge via existente.
    db.prepare(
      `UPDATE ordens_compra SET
        status = @status,
        categoria = @categoria,
        data_pedido = @data_pedido,
        data_ordem = @data_ordem,
        valor_total = @valor_total,
        fornecedor = @fornecedor,
        numero_orcamento = @numero_orcamento,
        numero_os = @numero_os,
        setor_equipamento = @setor_equipamento,
        origem = @origem,
        solicitante = @solicitante,
        assunto_email = @assunto_email,
        email_message_id = @email_message_id,
        anexo_origem = @anexo_origem,
        confianca = @confianca,
        observacoes = @observacoes,
        ordens_relacionadas = @ordens_relacionadas,
        updated_at = @updated_at
      WHERE numero_ordem = @numero_ordem`,
    ).run({ ...merged, numero_ordem: parsed.numero_ordem });

    if (parsed.itens && !protegido.itens) {
      substituirItens(parsed.numero_ordem, parsed.itens);
    }

    return { created: false, ordem: obterOrdemCompra(parsed.numero_ordem)! };
  })();
}

export function editarOrdemSala(numero: string, patch: PatchSalaOrdem): OrdemCompra | undefined {
  const db = getDb();
  const existente = obterRow(numero);
  if (!existente) return undefined;

  const flags = parseEditado(existente.editado_manualmente);
  const updates: string[] = [];
  const params: unknown[] = [];

  let statusPatch = patch.status;
  let motivoPatch = patch.motivo_exclusao;

  if (patch.marcar_fora_escopo) {
    statusPatch = "fora_escopo";
  }

  if (patch.marcar_duplicada) {
    statusPatch = "duplicada";
    if (motivoPatch === undefined) motivoPatch = "duplicada";
  }

  if (patch.restaurar_tv) {
    statusPatch = existente.data_ordem?.trim() ? "ordem_gerada" : "solicitado";
    motivoPatch = null;
  }

  if (patch.categoria !== undefined) {
    updates.push("categoria = ?");
    params.push(patch.categoria);
    flags.categoria = true;
  }
  if (patch.numero_os !== undefined) {
    updates.push("numero_os = ?");
    params.push(patch.numero_os);
    flags.numero_os = true;
  }
  if (patch.data_entrega !== undefined) {
    updates.push("data_entrega = ?");
    params.push(patch.data_entrega);
    flags.data_entrega = true;
  }
  if (patch.itens_entregues !== undefined) {
    updates.push("itens_entregues = ?");
    params.push(patch.itens_entregues);
    flags.itens_entregues = true;
  }
  if (statusPatch !== undefined) {
    updates.push("status = ?");
    params.push(statusPatch);
    flags.status = true;
  }
  if (motivoPatch !== undefined) {
    updates.push("motivo_exclusao = ?");
    params.push(motivoPatch);
    flags.motivo_exclusao = true;
  }

  if (!updates.length) return obterOrdemCompra(numero);

  updates.push("editado_manualmente = ?");
  params.push(JSON.stringify(flags));
  updates.push("updated_at = ?");
  params.push(nowIso());
  params.push(numero);

  db.prepare(`UPDATE ordens_compra SET ${updates.join(", ")} WHERE numero_ordem = ?`).run(...params);
  return obterOrdemCompra(numero);
}

export function editarCategoriaManualmente(numero: string, categoria: CategoriaOrdem): OrdemCompra | undefined {
  return editarOrdemSala(numero, { categoria });
}

export function marcarEntregue(
  numero: string,
  itensEntregues?: string | null,
  dataEntrega?: string | null,
): OrdemCompra | undefined {
  const data = dataEntrega?.trim() || nowIso().slice(0, 10);
  return editarOrdemSala(numero, {
    data_entrega: data,
    itens_entregues: itensEntregues === undefined ? undefined : itensEntregues,
  });
}

/** Contagem total de OCs formais (robô). */
export function contarOrdensCompra(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM ordens_compra").get() as { n: number }).n;
}

const STATUS_FORA_TV = new Set(["cancelado", "fora_escopo", "duplicada"]);

function ordemAberta(row: Pick<OrdemRow, "status" | "data_entrega">): boolean {
  if (row.status && STATUS_FORA_TV.has(row.status)) return false;
  const entrega = row.data_entrega?.trim();
  return !entrega;
}

export function listarTodasOrdensCompra(): OrdemCompra[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM ordens_compra ORDER BY COALESCE(data_ordem, data_pedido, updated_at) DESC`,
    )
    .all() as OrdemRow[];
  return rows.map((row) => rowParaOrdem(row, itensDaOrdem(row.numero_ordem)));
}

export function listarOrdensCompra(filtros: ListaFiltros): ListaOrdens {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filtros.desde) {
    where.push("updated_at >= ?");
    params.push(filtros.desde);
  }
  if (filtros.categoria) {
    where.push("categoria = ?");
    params.push(filtros.categoria);
  }
  if (filtros.fornecedor) {
    where.push("LOWER(IFNULL(fornecedor, '')) LIKE ?");
    params.push(`%${filtros.fornecedor.toLowerCase()}%`);
  }
  if (filtros.mes) {
    where.push("(IFNULL(data_pedido, '') LIKE ? OR IFNULL(data_ordem, '') LIKE ?)");
    params.push(`${filtros.mes}%`, `${filtros.mes}%`);
  }
  if (filtros.data_pedido_de) {
    where.push("IFNULL(substr(data_pedido, 1, 10), '') >= ?");
    params.push(filtros.data_pedido_de);
  }
  if (filtros.data_pedido_ate) {
    where.push("IFNULL(substr(data_pedido, 1, 10), '') <= ?");
    params.push(filtros.data_pedido_ate);
  }
  if (filtros.os) {
    where.push("IFNULL(numero_os, '') LIKE ?");
    params.push(`%${filtros.os}%`);
  }
  if (filtros.sem_valor) {
    where.push("(valor_total IS NULL OR TRIM(valor_total) = '')");
  }
  if (filtros.abertas) {
    where.push("(IFNULL(status, '') NOT IN ('cancelado', 'fora_escopo', 'duplicada'))");
    where.push("(data_entrega IS NULL OR TRIM(data_entrega) = '')");
  }
  if (filtros.excluidas) {
    where.push("IFNULL(status, '') = 'fora_escopo'");
  }
  if (filtros.duplicadas) {
    where.push("IFNULL(status, '') = 'duplicada'");
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderBy =
    filtros.ordenar === "data_pedido"
      ? "COALESCE(data_pedido, data_ordem, updated_at) DESC"
      : "COALESCE(data_ordem, data_pedido, updated_at) DESC";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ordens_compra ${clause}`).get(...params) as { n: number })
    .n;
  const offset = (filtros.page - 1) * filtros.page_size;
  const rows = db
    .prepare(
      `SELECT * FROM ordens_compra ${clause} ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filtros.page_size, offset) as OrdemRow[];

  const itens = rows.map((row) => rowParaOrdem(row, itensDaOrdem(row.numero_ordem)));
  return { itens, page: filtros.page, page_size: filtros.page_size, total };
}

function idadeDias(iso: string | null | undefined, agora: Date): number | null {
  if (!iso) return null;
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(soData ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 86_400_000));
}

function formatDia(iso: string | null | undefined): string {
  if (!iso) return "—";
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(soData ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function formatValor(valor: string | null): string {
  if (valor == null || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasEntre(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null;
  const parse = (iso: string) => {
    const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    return new Date(soData ? `${iso}T12:00:00` : iso);
  };
  const a = parse(inicio);
  const b = parse(fim);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const n = (b.getTime() - a.getTime()) / 86_400_000;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function media(valores: number[]): number | null {
  if (!valores.length) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

function situacaoTv(ordem: OrdemCompra): string {
  if (ordem.data_entrega) return "entregue";
  if (ordem.status === "cancelado") return "cancelado";
  if (ordem.status === "fora_escopo") return "fora do escopo";
  if (ordem.status === "duplicada") return "duplicada";
  if (ordem.data_ordem || ordem.status === "ordem_gerada") {
    const dias = idadeDias(ordem.data_ordem || ordem.data_pedido, new Date()) ?? 0;
    return dias >= 14 ? "cobrar entrega" : "aguarda entrega";
  }
  const dias = idadeDias(ordem.data_pedido, new Date()) ?? 0;
  return dias >= 7 ? "cobrar resposta" : "aguarda resposta";
}

function ancoraIdade(ordem: OrdemCompra): string | null {
  return ordem.data_pedido || ordem.data_ordem || ordem.created_at;
}

/** Snapshot da TV Compras: OCs formais abertas (fonte principal). */
export function resumoOrdensCompraTv(agora = new Date()) {
  const todas = listarTodasOrdensCompra();
  const abertas = todas.filter((o) => ordemAberta(o));
  const aguardaResposta = abertas.filter(
    (o) => !o.data_ordem && o.status !== "ordem_gerada",
  );
  const aguardaEntrega = abertas.filter(
    (o) => Boolean(o.data_ordem) || o.status === "ordem_gerada",
  );

  const entreguesMes = todas.filter((o) => {
    if (!o.data_entrega) return false;
    const soData = /^\d{4}-\d{2}-\d{2}$/.test(o.data_entrega);
    const d = new Date(soData ? `${o.data_entrega}T12:00:00` : o.data_entrega);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
  });

  const mediasPedidoOrdem = todas
    .map((o) => diasEntre(o.data_pedido, o.data_ordem))
    .filter((n): n is number => n != null);
  const mediasOrdemEntrega = todas
    .map((o) => diasEntre(o.data_ordem, o.data_entrega))
    .filter((n): n is number => n != null);
  const mediasPonta = entreguesMes
    .map((o) => diasEntre(o.data_pedido, o.data_entrega))
    .filter((n): n is number => n != null);

  const comOs = todas.filter((o) => Boolean(o.numero_os?.trim())).length;
  const pctOs = todas.length ? Math.round((comOs / todas.length) * 100) : null;
  const semOs = abertas.filter((o) => !o.numero_os?.trim()).length;

  // Todas as OCs abertas — a TV pagina/rola no cliente (sem hard-limit).
  const pedidos: PedidoTvOrdem[] = [...abertas]
    .sort((a, b) => (idadeDias(ancoraIdade(b), agora) ?? 0) - (idadeDias(ancoraIdade(a), agora) ?? 0))
    .map((o) => ({
      numeroOrdem: o.numero_ordem,
      categoria: o.categoria || "—",
      fornecedor: o.fornecedor || "—",
      dataPedido: formatDia(o.data_pedido),
      dataOrdem: formatDia(o.data_ordem),
      valor: formatValor(o.valor_total),
      numeroOs: o.numero_os?.trim() || "—",
      status: o.status || "—",
      confianca: o.confianca || "—",
      paradoDias: idadeDias(ancoraIdade(o), agora) ?? 0,
      situacao: situacaoTv(o),
    }));

  const maxDias = (lista: OrdemCompra[], campo: (o: OrdemCompra) => string | null) => {
    const vals = lista.map((o) => idadeDias(campo(o), agora) ?? 0);
    return vals.length ? Math.max(0, ...vals) : null;
  };

  return {
    total: todas.length,
    aguardaResposta: aguardaResposta.length,
    aguardaRespostaMaisAntigo: maxDias(aguardaResposta, (o) => o.data_pedido || o.created_at),
    aguardaEntrega: aguardaEntrega.length,
    aguardaEntregaMaisAntiga: maxDias(aguardaEntrega, (o) => o.data_ordem || o.data_pedido || o.created_at),
    entreguesMes: entreguesMes.length,
    mediaPedidoOrdem: media(mediasPedidoOrdem),
    mediaOrdemEntrega: media(mediasOrdemEntrega),
    mediaPontaAPonta: media(mediasPonta),
    percentualComOs: pctOs,
    semOs,
    pedidos,
  };
}

export function registrarChamadaApi(info: {
  metodo: string;
  rota: string;
  quantidade: number;
  erros: number;
  detalhe?: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO ordens_compra_api_log (created_at, metodo, rota, quantidade, erros, detalhe)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(nowIso(), info.metodo, info.rota, info.quantidade, info.erros, info.detalhe ?? null);
}
