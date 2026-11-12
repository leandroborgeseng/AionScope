/**
 * Gravação do pré-cadastro público.
 * Sempre cria um pendente novo. Não altera cadastro aprovado.
 * A resposta de sucesso é única e não devolve dado pessoal.
 */
import { randomUUID, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db/client";
import { registrarAuditoria } from "./auditoria";
import { buscarConviteAberto, CONVITE_ORIGEM_ENV, COOKIE_CSRF_CONVITE, lerCookie } from "./convite";
import { consumirLimite } from "./convite-limite";
import { canonizarOrigem, origensPermitidas } from "./origem";
import { canonizarPapel } from "./papeis";
import {
  MSG_ACEITE_OBRIGATORIO,
  MSG_CARACTERES_PROIBIDOS,
  MSG_CONVITE_AGORA,
  MSG_CONVITE_ARMADILHA,
  MSG_CONVITE_RECEBIDO,
  MSG_CORPO_CADASTRO,
  MSG_DESCRICAO_VAZIA,
  MSG_EMAIL_EXEMPLO,
  MSG_EMAIL_VAZIO,
  MSG_FUNCAO_VAZIA,
  MSG_JSON,
  MSG_LINK_INATIVO,
  MSG_NOME_VAZIO,
  MSG_SETOR_INVALIDO,
  MSG_SETOR_OBRIGATORIO,
  MSG_TEL_CONFIRME,
  MSG_TEL_DIVERGE,
  MSG_TEL_FORMATO,
  MSG_TEL_VAZIO,
  msgMaximo,
} from "./mensagens";
import { normalizarTelefone } from "./telefone";
import { normalizarEmail, normalizarTextoLivre } from "./texto-livre";

const NOME_MAX = 120;
const EMAIL_MAX = 120;
const DESCRICAO_MAX = 200;
const SETORES_MAX = 200;

const CHAVES = new Set([
  "nome",
  "telefone",
  "confirmacao",
  "email",
  "funcao",
  "descricao",
  "setores",
  "aceite",
  "csrf",
  "empresa",
]);

export type ResultadoPublico =
  | { ok: true; status: 200; message: string }
  | { ok: false; status: 400 | 403 | 429 | 500; message: string; retryAfter?: number };

function recusa(status: 400 | 403 | 429 | 500, message: string, retryAfter?: number): ResultadoPublico {
  return retryAfter ? { ok: false, status, message, retryAfter } : { ok: false, status, message };
}

function objeto(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function origemConvitePermitida(request: Request) {
  if (!request.headers.has("origin")) return false;
  const origem = canonizarOrigem(request.headers.get("origin"));
  if (!origem) return false;
  if (origem === canonizarOrigem(request.url)) return true;
  const configurada = canonizarOrigem(process.env[CONVITE_ORIGEM_ENV]);
  if (configurada && origem === configurada) return true;
  if (origensPermitidas().has(origem)) return true;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]?.trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim();
  if (host && proto && origem === canonizarOrigem(`${proto}://${host}`)) return true;
  return false;
}

export function csrfConviteConfere(request: Request, enviado: unknown) {
  if (typeof enviado !== "string" || !/^[a-f0-9]{64}$/.test(enviado)) return false;
  const cookie = lerCookie(request, COOKIE_CSRF_CONVITE);
  if (!cookie || cookie.length !== enviado.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookie), Buffer.from(enviado));
  } catch {
    return false;
  }
}

function nomeDe(valor: unknown): { ok: true; texto: string } | { ok: false; message: string } {
  if (typeof valor !== "string" || !valor.trim()) return { ok: false, message: MSG_NOME_VAZIO };
  const texto = valor.trim();
  if (texto.length > NOME_MAX) return { ok: false, message: msgMaximo(NOME_MAX) };
  const livre = normalizarTextoLivre(texto, NOME_MAX);
  if (!livre.ok || !livre.texto) return { ok: false, message: MSG_CARACTERES_PROIBIDOS };
  if (livre.texto.length < 2) return { ok: false, message: MSG_NOME_VAZIO };
  return { ok: true, texto: livre.texto };
}

function emailDe(valor: unknown): { ok: true; email: string } | { ok: false; message: string } {
  if (typeof valor !== "string" || !valor.trim()) return { ok: false, message: MSG_EMAIL_VAZIO };
  const texto = valor.trim();
  if (texto.length > EMAIL_MAX) return { ok: false, message: msgMaximo(EMAIL_MAX) };
  const email = normalizarEmail(texto);
  if (!email.ok || !email.email) return { ok: false, message: MSG_EMAIL_EXEMPLO };
  return { ok: true, email: email.email };
}

function descricaoDe(valor: unknown): { ok: true; texto: string } | { ok: false; message: string } {
  if (typeof valor !== "string") return { ok: false, message: MSG_DESCRICAO_VAZIA };
  const texto = valor.replace(/\r\n/g, "\n").replace(/\n+/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!texto) return { ok: false, message: MSG_DESCRICAO_VAZIA };
  if (texto.length > DESCRICAO_MAX) return { ok: false, message: msgMaximo(DESCRICAO_MAX) };
  const livre = normalizarTextoLivre(texto, DESCRICAO_MAX);
  if (!livre.ok || !livre.texto) return { ok: false, message: MSG_CARACTERES_PROIBIDOS };
  return { ok: true, texto: livre.texto };
}

function telefoneDe(telefone: unknown, confirmacao: unknown): { ok: true; e164: string } | { ok: false; message: string } {
  if (typeof telefone !== "string" || !telefone.trim()) return { ok: false, message: MSG_TEL_VAZIO };
  if (typeof confirmacao !== "string" || !confirmacao.trim()) return { ok: false, message: MSG_TEL_CONFIRME };
  const canonico = normalizarTelefone(telefone);
  if (!canonico) return { ok: false, message: MSG_TEL_FORMATO };
  const confirmado = normalizarTelefone(confirmacao);
  if (!confirmado) return { ok: false, message: MSG_TEL_FORMATO };
  if (canonico !== confirmado) return { ok: false, message: MSG_TEL_DIVERGE };
  return { ok: true, e164: canonico };
}

function setoresDe(valor: unknown): { ok: true; codigos: string[] } | { ok: false; message: string } {
  if (!Array.isArray(valor) || valor.length === 0) return { ok: false, message: MSG_SETOR_OBRIGATORIO };
  if (valor.length > SETORES_MAX) return { ok: false, message: MSG_SETOR_INVALIDO };
  const codigos: string[] = [];
  for (const item of valor) {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 40) return { ok: false, message: MSG_SETOR_INVALIDO };
    const codigo = item.trim();
    if (!codigos.includes(codigo)) codigos.push(codigo);
  }
  if (!codigos.length) return { ok: false, message: MSG_SETOR_OBRIGATORIO };
  const db = getDb();
  const consultar = db.prepare("SELECT ativo FROM bot_setor WHERE codigo = ?");
  for (const codigo of codigos) {
    const linha = consultar.get(codigo) as { ativo: number } | undefined;
    if (!linha || linha.ativo !== 1) return { ok: false, message: MSG_SETOR_INVALIDO };
  }
  return { ok: true, codigos };
}

export function receberPreCadastro(token: string, body: unknown, agora = new Date()): ResultadoPublico {
  const convite = buscarConviteAberto(token, agora);
  if (!convite) return recusa(400, MSG_LINK_INATIVO);

  const dados = objeto(body);
  if (!dados) return recusa(400, MSG_JSON);
  for (const chave of Object.keys(dados)) {
    if (!CHAVES.has(chave)) return recusa(400, MSG_CORPO_CADASTRO);
  }
  if (typeof dados.empresa === "string" && dados.empresa.trim()) return recusa(400, MSG_CONVITE_ARMADILHA);
  if (dados.empresa != null && typeof dados.empresa !== "string") return recusa(400, MSG_CORPO_CADASTRO);

  const nome = nomeDe(dados.nome);
  if (!nome.ok) return recusa(400, nome.message);
  const telefone = telefoneDe(dados.telefone, dados.confirmacao);
  if (!telefone.ok) return recusa(400, telefone.message);
  const email = emailDe(dados.email);
  if (!email.ok) return recusa(400, email.message);
  const funcao = canonizarPapel(dados.funcao);
  if (!funcao) return recusa(400, MSG_FUNCAO_VAZIA);
  const descricao = descricaoDe(dados.descricao);
  if (!descricao.ok) return recusa(400, descricao.message);
  const setores = setoresDe(dados.setores);
  if (!setores.ok) return recusa(400, setores.message);
  if (dados.aceite !== true) return recusa(400, MSG_ACEITE_OBRIGATORIO);

  const limiteTel = consumirLimite("tel", telefone.e164, agora.getTime());
  if (!limiteTel.permitido) return recusa(429, MSG_CONVITE_AGORA, limiteTel.retryAfter);

  const id = randomUUID();
  const iso = agora.toISOString();
  const db = getDb();
  try {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO bot_usuario (
          id, nome, papel, telefone_e164, situacao, dono, email, setor, outros_setores,
          aprovado_por, criado_em, atualizado_em, verificado_em,
          funcao_declarada, descricao_funcao, convite_id, ciencia_em
        ) VALUES (
          @id, @nome, '', @telefone_e164, 'pendente', 'dpo', @email, NULL, NULL,
          NULL, @criado_em, @atualizado_em, NULL,
          @funcao_declarada, @descricao_funcao, @convite_id, @ciencia_em
        )`,
      ).run({
        id,
        nome: nome.texto,
        telefone_e164: telefone.e164,
        email: email.email,
        criado_em: iso,
        atualizado_em: iso,
        funcao_declarada: funcao,
        descricao_funcao: descricao.texto,
        convite_id: convite.id,
        ciencia_em: iso,
      });
      const ligar = db.prepare("INSERT INTO bot_usuario_setor (usuario_id, setor_codigo) VALUES (?, ?)");
      for (const codigo of setores.codigos) ligar.run(id, codigo);
      registrarAuditoria({ usuarioId: id, ator: "formulario", acao: "criar", recurso: "cadastro", status: 200 }, agora);
    })();
  } catch {
    return recusa(500, MSG_CONVITE_AGORA);
  }
  return { ok: true, status: 200, message: MSG_CONVITE_RECEBIDO };
}
