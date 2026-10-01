import { randomUUID } from "crypto";
import { getDb } from "./client";

export type Impedimento = {
  id: string;
  tag: string;
  equipamento: string | null;
  motivo: string;
  nova_data: string | null;
  registrado_por: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
};

export type Aquisicao = {
  id: string;
  descricao: string;
  status: string;
  previsao: string | null;
  observacao: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
};

export type Obra = {
  id: string;
  descricao: string;
  status: string;
  previsao: string | null;
  observacao: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
};

export type Treinamento = {
  id: string;
  data: string;
  tema: string;
  participantes: number;
  evidencia: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

export type Alerta = {
  id: string;
  titulo: string;
  equipamentos: string | null;
  segregados: number;
  status: string;
  observacao: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
};

export type Melhoria = {
  id: string;
  item: string;
  status: string;
  observacao: string | null;
  atualizado_em: string;
};

export type Feriado = {
  id: string;
  data: string;
  nome: string;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function listarRegistrosSala() {
  const db = getDb();
  return {
    impedimentos: db
      .prepare("SELECT * FROM sala_impedimento WHERE ativo = 1 ORDER BY created_at DESC")
      .all() as Impedimento[],
    aquisicoes: db
      .prepare("SELECT * FROM sala_aquisicao WHERE ativo = 1 ORDER BY created_at DESC")
      .all() as Aquisicao[],
    obras: db.prepare("SELECT * FROM sala_obra WHERE ativo = 1 ORDER BY created_at DESC").all() as Obra[],
    treinamentos: db
      .prepare("SELECT * FROM sala_treinamento ORDER BY data DESC")
      .all() as Treinamento[],
    alertas: db.prepare("SELECT * FROM sala_alerta WHERE ativo = 1 ORDER BY created_at DESC").all() as Alerta[],
    melhorias: db.prepare("SELECT * FROM sala_melhoria ORDER BY atualizado_em DESC").all() as Melhoria[],
    feriados: db.prepare("SELECT * FROM sala_feriado ORDER BY data ASC").all() as Feriado[],
  };
}

export function feriadosAtivos(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT data FROM sala_feriado ORDER BY data ASC").all() as Array<{ data: string }>;
  return rows.map((row) => row.data);
}

export function criarImpedimento(input: {
  tag: string;
  equipamento?: string;
  motivo: string;
  nova_data?: string;
  registrado_por?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  const agora = nowIso();
  db.prepare(
    `INSERT INTO sala_impedimento
      (id, tag, equipamento, motivo, nova_data, registrado_por, ativo, created_at, updated_at)
     VALUES (@id, @tag, @equipamento, @motivo, @nova_data, @registrado_por, 1, @created_at, @updated_at)`,
  ).run({
    id,
    tag: input.tag.trim(),
    equipamento: input.equipamento?.trim() || null,
    motivo: input.motivo.trim(),
    nova_data: input.nova_data?.trim() || null,
    registrado_por: input.registrado_por?.trim() || null,
    created_at: agora,
    updated_at: agora,
  });
  return id;
}

export function encerrarImpedimento(id: string) {
  getDb()
    .prepare("UPDATE sala_impedimento SET ativo = 0, updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
}

export function criarAquisicao(input: {
  descricao: string;
  status?: string;
  previsao?: string;
  observacao?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  const agora = nowIso();
  db.prepare(
    `INSERT INTO sala_aquisicao
      (id, descricao, status, previsao, observacao, ativo, created_at, updated_at)
     VALUES (@id, @descricao, @status, @previsao, @observacao, 1, @created_at, @updated_at)`,
  ).run({
    id,
    descricao: input.descricao.trim(),
    status: input.status?.trim() || "em andamento",
    previsao: input.previsao?.trim() || null,
    observacao: input.observacao?.trim() || null,
    created_at: agora,
    updated_at: agora,
  });
  return id;
}

export function encerrarAquisicao(id: string) {
  getDb().prepare("UPDATE sala_aquisicao SET ativo = 0, updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function criarObra(input: {
  descricao: string;
  status?: string;
  previsao?: string;
  observacao?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  const agora = nowIso();
  db.prepare(
    `INSERT INTO sala_obra
      (id, descricao, status, previsao, observacao, ativo, created_at, updated_at)
     VALUES (@id, @descricao, @status, @previsao, @observacao, 1, @created_at, @updated_at)`,
  ).run({
    id,
    descricao: input.descricao.trim(),
    status: input.status?.trim() || "em andamento",
    previsao: input.previsao?.trim() || null,
    observacao: input.observacao?.trim() || null,
    created_at: agora,
    updated_at: agora,
  });
  return id;
}

export function encerrarObra(id: string) {
  getDb().prepare("UPDATE sala_obra SET ativo = 0, updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function criarTreinamento(input: {
  data: string;
  tema: string;
  participantes?: number;
  evidencia?: boolean;
  observacao?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  const agora = nowIso();
  db.prepare(
    `INSERT INTO sala_treinamento
      (id, data, tema, participantes, evidencia, observacao, created_at, updated_at)
     VALUES (@id, @data, @tema, @participantes, @evidencia, @observacao, @created_at, @updated_at)`,
  ).run({
    id,
    data: input.data.trim(),
    tema: input.tema.trim(),
    participantes: Number(input.participantes ?? 0) || 0,
    evidencia: input.evidencia ? 1 : 0,
    observacao: input.observacao?.trim() || null,
    created_at: agora,
    updated_at: agora,
  });
  return id;
}

export function criarAlerta(input: {
  titulo: string;
  equipamentos?: string;
  segregados?: boolean;
  status?: string;
  observacao?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  const agora = nowIso();
  db.prepare(
    `INSERT INTO sala_alerta
      (id, titulo, equipamentos, segregados, status, observacao, ativo, created_at, updated_at)
     VALUES (@id, @titulo, @equipamentos, @segregados, @status, @observacao, 1, @created_at, @updated_at)`,
  ).run({
    id,
    titulo: input.titulo.trim(),
    equipamentos: input.equipamentos?.trim() || null,
    segregados: input.segregados ? 1 : 0,
    status: input.status?.trim() || "aberto",
    observacao: input.observacao?.trim() || null,
    created_at: agora,
    updated_at: agora,
  });
  return id;
}

export function encerrarAlerta(id: string) {
  getDb().prepare("UPDATE sala_alerta SET ativo = 0, updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function salvarMelhoria(input: { id?: string; item: string; status?: string; observacao?: string }) {
  const db = getDb();
  const agora = nowIso();
  if (input.id) {
    db.prepare(
      `UPDATE sala_melhoria SET item = @item, status = @status, observacao = @observacao, atualizado_em = @atualizado_em
       WHERE id = @id`,
    ).run({
      id: input.id,
      item: input.item.trim(),
      status: input.status?.trim() || "pendente",
      observacao: input.observacao?.trim() || null,
      atualizado_em: agora,
    });
    return input.id;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO sala_melhoria (id, item, status, observacao, atualizado_em)
     VALUES (@id, @item, @status, @observacao, @atualizado_em)`,
  ).run({
    id,
    item: input.item.trim(),
    status: input.status?.trim() || "pendente",
    observacao: input.observacao?.trim() || null,
    atualizado_em: agora,
  });
  return id;
}

export function criarFeriado(input: { data: string; nome: string }) {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO sala_feriado (id, data, nome, created_at) VALUES (@id, @data, @nome, @created_at)`,
  ).run({
    id,
    data: input.data.trim(),
    nome: input.nome.trim(),
    created_at: nowIso(),
  });
  return id;
}

export function apagarFeriado(id: string) {
  getDb().prepare("DELETE FROM sala_feriado WHERE id = ?").run(id);
}
