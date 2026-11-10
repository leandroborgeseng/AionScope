/**
 * Cadastro do bot: leitura e escrita pela sessão de administrador.
 * Telefone é guardado só na forma normalizada. A unicidade vale apenas
 * para aprovados (ativo/inativo). Pendentes com o mesmo número coexistem;
 * `listarConflito` mostra pendentes e aprovados. Aprovar um pendente cujo
 * número já está aprovado falha sem gravar o telefone na resposta.
 * Não há rota pública aqui: `respostaPublicaCadastro` é a única frase
 * que uma rota pública futura pode devolver.
 */
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { registrarAuditoria, type AcaoAuditoria } from "./auditoria";
import {
  MSG_ACAO_DESCONHECIDA,
  MSG_ACAO_INVALIDA,
  MSG_CORPO_ACAO,
  MSG_DONO_INVALIDO,
  MSG_EMAIL_INVALIDO,
  MSG_GRAVACAO,
  MSG_JSON,
  MSG_MOTIVO_INVALIDO,
  MSG_NAO_ENCONTRADO,
  MSG_NOME_INVALIDO,
  MSG_OUTROS_SETORES_INVALIDO,
  MSG_PAPEL_INVALIDO,
  MSG_CORPO_CADASTRO,
  MSG_SETOR_INVALIDO,
  MSG_TELEFONE_APROVADO,
  MSG_TELEFONE_INVALIDO,
  RECUSA_CADASTRO,
} from "./mensagens";
import { APROVADOR_BOT_V1, canonizarPapel } from "./papeis";
import { mascararTelefone, normalizarTelefone } from "./telefone";
import { mascararEmail, normalizarEmail, normalizarTextoLivre, SETOR_TAMANHO_MAXIMO } from "./texto-livre";

export { listarAuditoria } from "./auditoria";
export { RECUSA_CADASTRO, RESPOSTA_PUBLICA_CADASTRO, respostaPublicaCadastro } from "./mensagens";

const NOME_MAXIMO = 120;
const DONO_MAXIMO = 80;
const MOTIVO_MAXIMO = 80;
const DONO_PADRAO = "dpo";
const SITUACOES = new Set(["pendente", "ativo", "inativo", "recusado"]);
const ACOES = ["aprovar", "recusar", "inativar", "reativar", "reenviar"] as const;
const ENTREGAS = new Set(["pendente", "enviada", "falhou"]);

type Situacao = "pendente" | "ativo" | "inativo" | "recusado";
type EntregaStatus = "pendente" | "enviada" | "falhou";
type Acao = (typeof ACOES)[number];

const CHAVES_CRIACAO = new Set(["nome", "papel", "telefone", "dono", "email", "setor", "outros_setores", "situacao"]);

type Linha = {
  id: string;
  nome: string;
  papel: string;
  telefone_e164: string;
  situacao: Situacao;
  dono: string;
  email: string | null;
  setor: string | null;
  outros_setores: string | null;
  aprovado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  verificado_em: string | null;
  entrega_status: string;
  entrega_pedido_em: string | null;
  motivo_recusa: string | null;
};

export type UsuarioLista = {
  id: string;
  nome: string;
  papel: string;
  telefone_mascarado: string;
  situacao: Situacao;
  dono: string;
  email_mascarado: string | null;
  setor: string | null;
  outros_setores: string | null;
  aprovado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  verificado_em: string | null;
  entrega_status: EntregaStatus;
  entrega_pedido_em: string | null;
  motivo_recusa: string | null;
};

export type FalhaCadastro = { ok: false; status: 400 | 404 | 409 | 500; message: string };
export type OkCadastro = { ok: true; data: UsuarioLista };

const COLUNAS = `id, nome, papel, telefone_e164, situacao, dono, email, setor, outros_setores,
  aprovado_por, criado_em, atualizado_em, verificado_em, entrega_status, entrega_pedido_em, motivo_recusa`;

const ORIGEM: Record<Acao, Situacao[]> = {
  aprovar: ["pendente"],
  recusar: ["pendente"],
  inativar: ["ativo"],
  reativar: ["inativo"],
  reenviar: ["ativo", "inativo"],
};

function falha(status: FalhaCadastro["status"], message: string): FalhaCadastro {
  return { ok: false, status, message };
}

function comoEntrega(valor: string | null | undefined): EntregaStatus {
  return valor && ENTREGAS.has(valor) ? (valor as EntregaStatus) : "pendente";
}

function paraLista(linha: Linha): UsuarioLista {
  return {
    id: linha.id,
    nome: linha.nome,
    papel: linha.papel,
    telefone_mascarado: mascararTelefone(linha.telefone_e164),
    situacao: linha.situacao,
    dono: linha.dono,
    email_mascarado: linha.email ? mascararEmail(linha.email) : null,
    setor: linha.setor,
    outros_setores: linha.outros_setores,
    aprovado_por: linha.aprovado_por,
    criado_em: linha.criado_em,
    atualizado_em: linha.atualizado_em,
    verificado_em: linha.verificado_em,
    entrega_status: comoEntrega(linha.entrega_status),
    entrega_pedido_em: linha.entrega_pedido_em,
    motivo_recusa: linha.motivo_recusa,
  };
}

function objeto(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

/** Criação só aceita o cadastro pendente. Campo de ativação, ou situacao diferente de pendente, é corpo inválido. */
function corpoCriacaoEstrito(dados: Record<string, unknown>) {
  for (const chave of Object.keys(dados)) {
    if (!CHAVES_CRIACAO.has(chave)) return false;
  }
  return !("situacao" in dados) || dados.situacao === "pendente";
}

function buscarId(id: string): Linha | null {
  return (
    (getDb().prepare(`SELECT ${COLUNAS} FROM bot_usuario WHERE id = ?`).get(id) as Linha | undefined) ?? null
  );
}

function buscarPorTelefone(telefone: string): Linha[] {
  return getDb()
    .prepare(`SELECT ${COLUNAS} FROM bot_usuario WHERE telefone_e164 = ? ORDER BY criado_em`)
    .all(telefone) as Linha[];
}

function outroAprovado(telefone: string, excetoId: string | null) {
  const linha = getDb()
    .prepare(
      `SELECT id FROM bot_usuario
       WHERE telefone_e164 = ? AND situacao IN ('ativo', 'inativo') AND id != ?`,
    )
    .get(telefone, excetoId ?? "") as { id: string } | undefined;
  return Boolean(linha);
}

function conflitoUnico(erro: unknown) {
  if (!erro || typeof erro !== "object") return false;
  const codigo = "code" in erro ? String((erro as { code?: unknown }).code) : "";
  return codigo === "SQLITE_CONSTRAINT_UNIQUE";
}

function auditar(acao: AcaoAuditoria, usuarioId: string | null, status: number, agora: Date) {
  registrarAuditoria({ usuarioId, ator: "admin", acao, recurso: "cadastro", status }, agora);
}

export function listarUsuarios(filtro?: { situacao?: string | null; papel?: string | null }): UsuarioLista[] {
  const situacao = filtro?.situacao?.trim() ?? "";
  const papelBruto = filtro?.papel?.trim() ?? "";
  if (situacao && !SITUACOES.has(situacao)) return [];
  const papel = papelBruto ? canonizarPapel(papelBruto) : null;
  if (papelBruto && !papel) return [];
  const linhas = getDb()
    .prepare(
      `SELECT ${COLUNAS} FROM bot_usuario
       WHERE (? = '' OR situacao = ?) AND (? = '' OR papel = ?)
       ORDER BY criado_em`,
    )
    .all(situacao, situacao, papelBruto, papel) as Linha[];
  return linhas.map(paraLista);
}

export function obterUsuario(id: string): UsuarioLista | null {
  const linha = buscarId(id);
  return linha ? paraLista(linha) : null;
}

export function listarConflito(
  telefone: unknown,
): FalhaCadastro | { ok: true; data: { telefone_mascarado: string; pendentes: UsuarioLista[]; aprovados: UsuarioLista[] } } {
  const canonico = normalizarTelefone(telefone);
  if (!canonico) return falha(400, MSG_TELEFONE_INVALIDO);
  const linhas = buscarPorTelefone(canonico);
  return {
    ok: true,
    data: {
      telefone_mascarado: mascararTelefone(canonico),
      pendentes: linhas.filter((linha) => linha.situacao === "pendente").map(paraLista),
      aprovados: linhas.filter((linha) => linha.situacao === "ativo" || linha.situacao === "inativo").map(paraLista),
    },
  };
}

/** Mesma resposta de `listarConflito`, resolvendo o número no servidor. A resposta continua mascarada. */
export function listarConflitoPorId(id: string) {
  const linha = buscarId(id);
  if (!linha) return falha(404, MSG_NAO_ENCONTRADO);
  return listarConflito(linha.telefone_e164);
}

/**
 * Devolve o E.164 ao administrador e grava auditoria sem o número.
 * Não registra log. A tela mostra o valor por pouco tempo e volta a mascarar.
 */
export function revelarTelefone(
  id: string,
  agora = new Date(),
): FalhaCadastro | { ok: true; data: { telefone: string } } {
  const linha = buscarId(id);
  if (!linha) return falha(404, MSG_NAO_ENCONTRADO);
  auditar("revelar", linha.id, 200, agora);
  return { ok: true, data: { telefone: linha.telefone_e164 } };
}

export function criarUsuario(body: unknown, agora = new Date()): FalhaCadastro | OkCadastro {
  const dados = objeto(body);
  if (!dados) return falha(400, MSG_JSON);
  if (!corpoCriacaoEstrito(dados)) return falha(400, MSG_CORPO_CADASTRO);

  const nomeLivre = normalizarTextoLivre(dados.nome, NOME_MAXIMO);
  if (!nomeLivre.ok || !nomeLivre.texto || nomeLivre.texto.length < 2) return falha(400, MSG_NOME_INVALIDO);

  const papel = canonizarPapel(dados.papel);
  if (!papel) return falha(400, MSG_PAPEL_INVALIDO);

  const telefone = normalizarTelefone(dados.telefone);
  if (!telefone) return falha(400, MSG_TELEFONE_INVALIDO);

  let dono = DONO_PADRAO;
  if (dados.dono != null && dados.dono !== "") {
    const donoLivre = normalizarTextoLivre(dados.dono, DONO_MAXIMO);
    if (!donoLivre.ok || !donoLivre.texto) return falha(400, MSG_DONO_INVALIDO);
    dono = donoLivre.texto;
  }

  const email = normalizarEmail(dados.email);
  if (!email.ok) return falha(400, MSG_EMAIL_INVALIDO);
  const setor = normalizarTextoLivre(dados.setor, SETOR_TAMANHO_MAXIMO);
  if (!setor.ok) return falha(400, MSG_SETOR_INVALIDO);
  const outros = normalizarTextoLivre(dados.outros_setores, SETOR_TAMANHO_MAXIMO);
  if (!outros.ok) return falha(400, MSG_OUTROS_SETORES_INVALIDO);

  const iso = agora.toISOString();
  const id = randomUUID();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO bot_usuario (
        id, nome, papel, telefone_e164, situacao, dono, email, setor, outros_setores,
        aprovado_por, criado_em, atualizado_em, verificado_em
      ) VALUES (
        @id, @nome, @papel, @telefone_e164, @situacao, @dono, @email, @setor, @outros_setores,
        @aprovado_por, @criado_em, @atualizado_em, @verificado_em
      )`,
    ).run({
      id,
      nome: nomeLivre.texto,
      papel,
      telefone_e164: telefone,
      situacao: "pendente",
      dono,
      email: email.email,
      setor: setor.texto,
      outros_setores: outros.texto,
      aprovado_por: null,
      criado_em: iso,
      atualizado_em: iso,
      verificado_em: null,
    });
    auditar("criar", id, 201, agora);
    return { ok: true as const, data: paraLista(buscarId(id)!) };
  });

  try {
    return tx();
  } catch (erro) {
    if (conflitoUnico(erro)) return falha(409, MSG_TELEFONE_APROVADO);
    return falha(500, MSG_GRAVACAO);
  }
}

export function aplicarAcao(id: string, body: unknown, agora = new Date()): FalhaCadastro | OkCadastro {
  const dados = objeto(body);
  if (!dados) return falha(400, MSG_JSON);
  const chaves = Object.keys(dados).sort();
  const acao = dados.acao;
  const soAcao = chaves.length === 1 && chaves[0] === "acao";
  const aprovarComPapel = chaves.length === 2 && chaves[0] === "acao" && chaves[1] === "papel" && acao === "aprovar";
  const recusarComMotivo = chaves.length === 2 && chaves[0] === "acao" && chaves[1] === "motivo" && acao === "recusar";
  if (!soAcao && !aprovarComPapel && !recusarComMotivo) return falha(400, MSG_CORPO_ACAO);
  if (typeof acao !== "string" || !ACOES.includes(acao as Acao)) return falha(400, MSG_ACAO_DESCONHECIDA);
  const pedido = acao as Acao;

  let papelNovo: string | null = null;
  if (aprovarComPapel) {
    papelNovo = canonizarPapel(dados.papel);
    if (!papelNovo) return falha(400, MSG_PAPEL_INVALIDO);
  }
  let motivoNovo: string | null = null;
  if (recusarComMotivo) {
    const motivo = normalizarTextoLivre(dados.motivo, MOTIVO_MAXIMO);
    if (!motivo.ok) return falha(400, MSG_MOTIVO_INVALIDO);
    motivoNovo = motivo.texto;
  }

  const atual = buscarId(id);
  if (!atual) return falha(404, MSG_NAO_ENCONTRADO);
  if (!ORIGEM[pedido].includes(atual.situacao)) {
    auditar(pedido, atual.id, 409, agora);
    return falha(409, MSG_ACAO_INVALIDA);
  }

  const iso = agora.toISOString();
  const db = getDb();
  const tx = db.transaction(() => {
    if (pedido === "reenviar") {
      db.prepare(
        `UPDATE bot_usuario
         SET entrega_status = 'pendente', entrega_pedido_em = ?, atualizado_em = ?
         WHERE id = ?`,
      ).run(iso, iso, atual.id);
      auditar("reenviar", atual.id, 200, agora);
      return { ok: true as const, data: paraLista(buscarId(atual.id)!) };
    }
    if ((pedido === "aprovar" || pedido === "reativar") && outroAprovado(atual.telefone_e164, atual.id)) {
      auditar(pedido, atual.id, 409, agora);
      return falha(409, MSG_TELEFONE_APROVADO);
    }
    const proxima: Situacao =
      pedido === "recusar" ? "recusado" : pedido === "inativar" ? "inativo" : "ativo";
    const decide = pedido === "aprovar" || pedido === "recusar" || pedido === "reativar";
    const verifica = pedido === "aprovar" || pedido === "reativar";
    db.prepare(
      `UPDATE bot_usuario
       SET situacao = ?, papel = ?, aprovado_por = ?, atualizado_em = ?, verificado_em = ?, motivo_recusa = ?
       WHERE id = ?`,
    ).run(
      proxima,
      papelNovo ?? atual.papel,
      decide ? APROVADOR_BOT_V1 : atual.aprovado_por,
      iso,
      verifica ? iso : atual.verificado_em,
      recusarComMotivo ? motivoNovo : atual.motivo_recusa,
      atual.id,
    );
    auditar(pedido, atual.id, 200, agora);
    return { ok: true as const, data: paraLista(buscarId(atual.id)!) };
  });

  try {
    return tx();
  } catch (erro) {
    if (conflitoUnico(erro)) return falha(409, MSG_TELEFONE_APROVADO);
    return falha(500, MSG_GRAVACAO);
  }
}

/**
 * Identidade do remetente para o bot (ainda sem rota HTTP).
 * Só um cadastro ativo passa. Fora do cadastro, inativo, pendente ou mal formatado
 * devolvem o mesmo objeto, sem nome, telefone, e-mail ou setor.
 */
export function resolverRemetente(telefone: unknown, agora = new Date()) {
  const canonico = normalizarTelefone(telefone);
  if (!canonico) {
    registrarAuditoria({ usuarioId: null, ator: "canal", acao: "consulta", recurso: "cadastro", status: 400 }, agora);
    return RECUSA_CADASTRO;
  }
  const linhas = buscarPorTelefone(canonico);
  const ativos = linhas.filter((linha) => linha.situacao === "ativo");
  if (ativos.length === 1) {
    const ativo = ativos[0]!;
    registrarAuditoria({ usuarioId: ativo.id, ator: "canal", acao: "consulta", recurso: "cadastro", status: 200 }, agora);
    return {
      permitido: true as const,
      usuario: { id: ativo.id, nome: ativo.nome, papel: ativo.papel, situacao: "ativo" as const, dono: ativo.dono },
    };
  }
  const aprovado = linhas.find((linha) => linha.situacao === "ativo" || linha.situacao === "inativo");
  registrarAuditoria(
    { usuarioId: aprovado?.id ?? null, ator: "canal", acao: "consulta", recurso: "cadastro", status: 403 },
    agora,
  );
  return RECUSA_CADASTRO;
}
