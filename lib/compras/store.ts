import { randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { situacaoCompra, type SituacaoCompra } from "./parse-email";

export type CompraRow = {
  id: string;
  os: string | null;
  tag: string | null;
  equipamento: string | null;
  item: string | null;
  setor: string | null;
  solicitante_caixa: string | null;
  enviado_em: string | null;
  sc_numero: string | null;
  sc_em: string | null;
  entregue_em: string | null;
  origem_entrega: string | null;
  situacao: SituacaoCompra;
  conversation_id: string | null;
  revisado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type CompraEmailRow = {
  id: string;
  compra_id: string;
  message_id: string;
  direcao: "enviado" | "recebido";
  data: string;
  de: string | null;
  para: string | null;
  assunto: string | null;
  trecho: string | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function parseIso(valor: string | null | undefined) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function recalcularSituacao(row: CompraRow, agora = new Date()): SituacaoCompra {
  return situacaoCompra({
    os: row.os,
    enviadoEm: parseIso(row.enviado_em),
    scNumero: row.sc_numero,
    scEm: parseIso(row.sc_em),
    entregueEm: parseIso(row.entregue_em),
    agora,
  });
}

export function listarCompras(opts?: { abertas?: boolean }): CompraRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM compra ORDER BY COALESCE(enviado_em, created_at) DESC")
    .all() as CompraRow[];
  const agora = new Date();
  const atualizadas = rows.map((row) => {
    const situacao = recalcularSituacao(row, agora);
    if (situacao !== row.situacao) {
      db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(
        situacao,
        nowIso(),
        row.id,
      );
      return { ...row, situacao };
    }
    return row;
  });
  if (opts?.abertas) {
    return atualizadas.filter((row) => row.situacao !== "entregue");
  }
  return atualizadas;
}

export function emailsDaCompra(compraId: string): CompraEmailRow[] {
  return getDb()
    .prepare("SELECT * FROM compra_email WHERE compra_id = ? ORDER BY data ASC")
    .all(compraId) as CompraEmailRow[];
}

export function obterDelta(caixa: string, pasta: string) {
  return getDb()
    .prepare("SELECT * FROM graph_delta WHERE caixa = ? AND pasta = ?")
    .get(caixa, pasta) as { delta_link: string | null } | undefined;
}

export function salvarDelta(caixa: string, pasta: string, deltaLink: string | null) {
  const db = getDb();
  const agora = nowIso();
  const existente = db
    .prepare("SELECT id FROM graph_delta WHERE caixa = ? AND pasta = ?")
    .get(caixa, pasta) as { id: string } | undefined;
  if (existente) {
    db.prepare("UPDATE graph_delta SET delta_link = ?, atualizado_em = ? WHERE id = ?").run(
      deltaLink,
      agora,
      existente.id,
    );
    return;
  }
  db.prepare(
    "INSERT INTO graph_delta (id, caixa, pasta, delta_link, atualizado_em) VALUES (?, ?, ?, ?, ?)",
  ).run(randomUUID(), caixa, pasta, deltaLink, agora);
}

export function messageJaVisto(messageId: string) {
  return Boolean(
    getDb().prepare("SELECT id FROM compra_email WHERE message_id = ?").get(messageId),
  );
}

export function compraPorConversation(conversationId: string | null | undefined) {
  if (!conversationId) return null;
  return getDb()
    .prepare("SELECT * FROM compra WHERE conversation_id = ?")
    .get(conversationId) as CompraRow | undefined;
}

export function upsertCompraEnviada(input: {
  conversationId: string;
  messageId: string;
  data: string;
  de: string;
  para: string;
  assunto: string;
  trecho: string;
  os: string | null;
  tag: string | null;
  equipamento: string | null;
  item: string | null;
  setor: string | null;
  solicitanteCaixa: string;
}) {
  const db = getDb();
  if (messageJaVisto(input.messageId)) return compraPorConversation(input.conversationId)?.id ?? null;

  let compra = compraPorConversation(input.conversationId);
  const agora = nowIso();
  if (!compra) {
    const id = randomUUID();
    const situacao = situacaoCompra({
      os: input.os,
      enviadoEm: parseIso(input.data),
      scNumero: null,
      scEm: null,
      entregueEm: null,
    });
    db.prepare(
      `INSERT INTO compra (
        id, os, tag, equipamento, item, setor, solicitante_caixa, enviado_em,
        sc_numero, sc_em, entregue_em, origem_entrega, situacao, conversation_id,
        revisado_por, created_at, updated_at
      ) VALUES (
        @id, @os, @tag, @equipamento, @item, @setor, @solicitante_caixa, @enviado_em,
        NULL, NULL, NULL, NULL, @situacao, @conversation_id, NULL, @created_at, @updated_at
      )`,
    ).run({
      id,
      os: input.os,
      tag: input.tag,
      equipamento: input.equipamento,
      item: input.item,
      setor: input.setor,
      solicitante_caixa: input.solicitanteCaixa,
      enviado_em: input.data,
      situacao,
      conversation_id: input.conversationId,
      created_at: agora,
      updated_at: agora,
    });
    compra = db.prepare("SELECT * FROM compra WHERE id = ?").get(id) as CompraRow;
  } else {
    db.prepare(
      `UPDATE compra SET
        os = COALESCE(os, @os),
        tag = COALESCE(tag, @tag),
        equipamento = COALESCE(equipamento, @equipamento),
        item = COALESCE(item, @item),
        setor = COALESCE(setor, @setor),
        solicitante_caixa = COALESCE(solicitante_caixa, @solicitante_caixa),
        enviado_em = COALESCE(enviado_em, @enviado_em),
        updated_at = @updated_at
      WHERE id = @id`,
    ).run({
      id: compra.id,
      os: input.os,
      tag: input.tag,
      equipamento: input.equipamento,
      item: input.item,
      setor: input.setor,
      solicitante_caixa: input.solicitanteCaixa,
      enviado_em: input.data,
      updated_at: agora,
    });
  }

  db.prepare(
    `INSERT INTO compra_email (
      id, compra_id, message_id, direcao, data, de, para, assunto, trecho, created_at
    ) VALUES (?, ?, ?, 'enviado', ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    compra!.id,
    input.messageId,
    input.data,
    input.de,
    input.para,
    input.assunto,
    input.trecho,
    agora,
  );

  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compra!.id) as CompraRow;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(
    situacao,
    agora,
    atual.id,
  );
  return atual.id;
}

export function aplicarRespostaRecebida(input: {
  conversationId: string;
  messageId: string;
  data: string;
  de: string;
  para: string;
  assunto: string;
  trecho: string;
  sc: string | null;
  entregueEm: string | null;
}) {
  const db = getDb();
  if (messageJaVisto(input.messageId)) return null;
  const compra = compraPorConversation(input.conversationId);
  if (!compra) return null;

  const agora = nowIso();
  db.prepare(
    `INSERT INTO compra_email (
      id, compra_id, message_id, direcao, data, de, para, assunto, trecho, created_at
    ) VALUES (?, ?, ?, 'recebido', ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    compra.id,
    input.messageId,
    input.data,
    input.de,
    input.para,
    input.assunto,
    input.trecho,
    agora,
  );

  db.prepare(
    `UPDATE compra SET
      sc_numero = COALESCE(sc_numero, @sc),
      sc_em = CASE WHEN sc_numero IS NULL AND @sc IS NOT NULL THEN @data ELSE sc_em END,
      entregue_em = COALESCE(entregue_em, @entregue),
      origem_entrega = CASE
        WHEN entregue_em IS NULL AND @entregue IS NOT NULL THEN 'email'
        ELSE origem_entrega
      END,
      updated_at = @updated_at
    WHERE id = @id`,
  ).run({
    id: compra.id,
    sc: input.sc,
    data: input.data,
    entregue: input.entregueEm,
    updated_at: agora,
  });

  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compra.id) as CompraRow;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(
    situacao,
    agora,
    atual.id,
  );
  return atual.id;
}

export function vincularOs(compraId: string, os: string) {
  const db = getDb();
  const agora = nowIso();
  db.prepare("UPDATE compra SET os = ?, updated_at = ? WHERE id = ?").run(os.trim(), agora, compraId);
  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compraId) as CompraRow | undefined;
  if (!atual) return;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(situacao, agora, compraId);
}

export function corrigirSc(compraId: string, sc: string, scEm?: string) {
  const db = getDb();
  const agora = nowIso();
  db.prepare("UPDATE compra SET sc_numero = ?, sc_em = COALESCE(?, sc_em, ?), updated_at = ? WHERE id = ?").run(
    sc.trim(),
    scEm ?? null,
    agora,
    agora,
    compraId,
  );
  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compraId) as CompraRow | undefined;
  if (!atual) return;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(situacao, agora, compraId);
}

export function obterCompra(id: string) {
  return getDb().prepare("SELECT * FROM compra WHERE id = ?").get(id) as CompraRow | undefined;
}

export type CompraManualInput = {
  os?: string | null;
  tag?: string | null;
  equipamento?: string | null;
  item?: string | null;
  setor?: string | null;
  solicitante_caixa?: string | null;
  enviado_em?: string | null;
  sc_numero?: string | null;
  sc_em?: string | null;
  entregue_em?: string | null;
  origem_entrega?: string | null;
  revisado_por?: string | null;
  conversation_id?: string | null;
};

function limparTexto(valor: string | null | undefined) {
  const t = valor?.trim();
  return t ? t : null;
}

export function criarCompraManual(input: CompraManualInput) {
  const db = getDb();
  const id = randomUUID();
  const agora = nowIso();
  const enviado = limparTexto(input.enviado_em) || agora;
  const row: CompraRow = {
    id,
    os: limparTexto(input.os),
    tag: limparTexto(input.tag),
    equipamento: limparTexto(input.equipamento),
    item: limparTexto(input.item),
    setor: limparTexto(input.setor),
    solicitante_caixa: limparTexto(input.solicitante_caixa),
    enviado_em: enviado,
    sc_numero: limparTexto(input.sc_numero),
    sc_em: limparTexto(input.sc_em),
    entregue_em: limparTexto(input.entregue_em),
    origem_entrega: limparTexto(input.origem_entrega) || (input.entregue_em ? "manual" : null),
    situacao: "aguarda SC",
    conversation_id: limparTexto(input.conversation_id) || `manual:${id}`,
    revisado_por: limparTexto(input.revisado_por),
    created_at: agora,
    updated_at: agora,
  };
  row.situacao = recalcularSituacao(row);
  db.prepare(
    `INSERT INTO compra (
      id, os, tag, equipamento, item, setor, solicitante_caixa, enviado_em,
      sc_numero, sc_em, entregue_em, origem_entrega, situacao, conversation_id,
      revisado_por, created_at, updated_at
    ) VALUES (
      @id, @os, @tag, @equipamento, @item, @setor, @solicitante_caixa, @enviado_em,
      @sc_numero, @sc_em, @entregue_em, @origem_entrega, @situacao, @conversation_id,
      @revisado_por, @created_at, @updated_at
    )`,
  ).run(row);
  return id;
}

export function atualizarCompra(id: string, input: CompraManualInput) {
  const db = getDb();
  const atual = obterCompra(id);
  if (!atual) throw new Error("Pedido não encontrado.");
  const agora = nowIso();
  const merged: CompraRow = {
    ...atual,
    os: input.os !== undefined ? limparTexto(input.os) : atual.os,
    tag: input.tag !== undefined ? limparTexto(input.tag) : atual.tag,
    equipamento: input.equipamento !== undefined ? limparTexto(input.equipamento) : atual.equipamento,
    item: input.item !== undefined ? limparTexto(input.item) : atual.item,
    setor: input.setor !== undefined ? limparTexto(input.setor) : atual.setor,
    solicitante_caixa:
      input.solicitante_caixa !== undefined ? limparTexto(input.solicitante_caixa) : atual.solicitante_caixa,
    enviado_em: input.enviado_em !== undefined ? limparTexto(input.enviado_em) : atual.enviado_em,
    sc_numero: input.sc_numero !== undefined ? limparTexto(input.sc_numero) : atual.sc_numero,
    sc_em: input.sc_em !== undefined ? limparTexto(input.sc_em) : atual.sc_em,
    entregue_em: input.entregue_em !== undefined ? limparTexto(input.entregue_em) : atual.entregue_em,
    origem_entrega:
      input.origem_entrega !== undefined
        ? limparTexto(input.origem_entrega)
        : input.entregue_em
          ? atual.origem_entrega || "manual"
          : atual.origem_entrega,
    revisado_por: input.revisado_por !== undefined ? limparTexto(input.revisado_por) : atual.revisado_por,
    updated_at: agora,
  };
  merged.situacao = recalcularSituacao(merged);
  db.prepare(
    `UPDATE compra SET
      os = @os, tag = @tag, equipamento = @equipamento, item = @item, setor = @setor,
      solicitante_caixa = @solicitante_caixa, enviado_em = @enviado_em,
      sc_numero = @sc_numero, sc_em = @sc_em, entregue_em = @entregue_em,
      origem_entrega = @origem_entrega, situacao = @situacao,
      revisado_por = @revisado_por, updated_at = @updated_at
    WHERE id = @id`,
  ).run(merged);
  return merged;
}

export function apagarCompra(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM compra_email WHERE compra_id = ?").run(id);
  db.prepare("DELETE FROM compra WHERE id = ?").run(id);
}
