import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "@/lib/auth/contratos-sessao";
import { emitirConviteGrupo, lerConviteGrupo, revogarConviteAtivo, definirValidadeDias } from "@/lib/bot/convite";
import { LIMITE_IP_ENV, LIMITE_TEL_ENV, TRUST_CF_CONNECTING_IP } from "@/lib/bot/convite-limite";
import { paginaFormulario, paginaInativa } from "@/lib/bot/convite-pagina";
import {
  MSG_CARACTERES_PROIBIDOS,
  MSG_CONVITE_AGORA,
  MSG_CONVITE_ARMADILHA,
  MSG_CONVITE_OFFLINE,
  MSG_CONVITE_RECEBIDO,
  MSG_CORPO_CADASTRO,
  MSG_EMAIL_EXEMPLO,
  MSG_LINK_INATIVO,
  MSG_SETOR_INVALIDO,
  MSG_TEL_DIVERGE,
  MSG_TEL_FORMATO,
  msgMaximo,
  AVISO_PRIVACIDADE,
  RESPOSTA_PUBLICA_CADASTRO,
} from "@/lib/bot/mensagens";
import { ORIGENS_PERMITIDAS_ENV } from "@/lib/bot/origem";
import { APROVADOR_BOT_V1 } from "@/lib/bot/papeis";
import { aplicarAcao, listarConflitoPorId, resolverRemetente } from "@/lib/bot/usuarios";
import { closeDbForTests, getDb } from "@/lib/db/client";
import { RECUSA_CADASTRO } from "@/lib/bot/mensagens";
import * as conviteRota from "../../app/convite/[token]/route";
import * as itemRota from "../../app/api/cadastros/bot-usuarios/[id]/route";

const NOME = "Ana Exemplo";
const EMAIL = "ana@aion.local";
const TEL = "11900000001";
const E164 = "+5511900000001";
const DIGITOS = "5511900000001";
const DESCRICAO = "Enfermeira exemplo da UTI ZZTESTE";
const ORIGEM = "https://painel.exemplo.test";
const AGORA = new Date("2026-11-12T03:00:00.000Z");
const DIA = 86_400_000;

let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "bot-convite-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-ficticia-de-teste";
  process.env[ORIGENS_PERMITIDAS_ENV] = ORIGEM;
  process.env.AIONSCOPE_CONVITE_ORIGEM = ORIGEM;
  closeDbForTests();
  getDb();
});

after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env[TRUST_CF_CONNECTING_IP] = "false";
  process.env[LIMITE_IP_ENV] = "100";
  process.env[LIMITE_TEL_ENV] = "100";
  getDb().exec(`
    DELETE FROM bot_usuario_setor;
    DELETE FROM bot_auditoria;
    DELETE FROM bot_usuario;
    DELETE FROM bot_convite_grupo;
    DELETE FROM bot_convite_limite;
    UPDATE bot_convite_config SET validade_dias = 7 WHERE id = 1;
  `);
});

function total() {
  return (getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n;
}

function auditoriaTexto() {
  return JSON.stringify(getDb().prepare("SELECT * FROM bot_auditoria").all());
}

async function semLog(trechos: string[], fn: () => Promise<void>) {
  const saida: string[] = [];
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  const metodos = ["log", "info", "warn", "error", "debug"] as const;
  for (const metodo of metodos) {
    console[metodo] = (...args: unknown[]) => {
      saida.push(args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    };
  }
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  }
  const texto = saida.join("\n");
  for (const trecho of trechos) assert.equal(texto.includes(trecho), false, trecho);
}

function pedido(extra: Record<string, unknown> = {}, csrf = "a".repeat(64)) {
  return {
    nome: NOME,
    telefone: TEL,
    confirmacao: TEL,
    email: EMAIL,
    funcao: "Compras",
    descricao: DESCRICAO,
    setores: ["55D"],
    aceite: true,
    csrf,
    empresa: "",
    ...extra,
  };
}

async function abrir(token: string, ip = "203.0.113.10") {
  const resposta = await conviteRota.GET(new Request(`http://local/convite/${token}`, { headers: { "x-real-ip": ip } }), {
    params: Promise.resolve({ token }),
  });
  const html = await resposta.text();
  const csrf = /aion_convite_csrf=([a-f0-9]+)/.exec(resposta.headers.get("set-cookie") ?? "")?.[1] ?? "";
  return { resposta, html, csrf, cookie: `aion_convite_csrf=${csrf}` };
}

function post(
  token: string,
  body: unknown,
  opcoes: { cookie?: string; ip?: string; cf?: string; origin?: string | null } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-real-ip": opcoes.ip ?? "203.0.113.10",
  };
  if (opcoes.origin !== null) headers.origin = opcoes.origin ?? "http://local";
  if (opcoes.cookie) headers.cookie = opcoes.cookie;
  if (opcoes.cf) headers["cf-connecting-ip"] = opcoes.cf;
  return conviteRota.POST(
    new Request(`http://local/convite/${token}`, { method: "POST", headers, body: JSON.stringify(body) }),
    { params: Promise.resolve({ token }) },
  );
}

async function enviar(token: string, extra: Record<string, unknown> = {}, ip = "203.0.113.10") {
  const pagina = await abrir(token, ip);
  const corpo = pedido(extra, pagina.csrf);
  const resposta = await post(token, corpo, { cookie: pagina.cookie, ip });
  return { pagina, corpo, resposta, texto: await resposta.text() };
}

test("A55 U-G1 U-G8: link válido cria pendente e o mesmo link aceita outra pessoa", async () => {
  const link = emitirConviteGrupo(AGORA);
  assert.equal(link.ok, true);
  if (!link.ok) return;
  assert.equal(link.url, `${ORIGEM}/convite/${link.token}`);
  assert.equal(Date.parse(link.expira_em) - AGORA.getTime(), 7 * DIA);

  let texto = "";
  await semLog([NOME, EMAIL, DIGITOS, DESCRICAO, link.token], async () => {
    const envio = await enviar(link.token);
    texto = envio.texto;
    assert.equal(envio.resposta.status, 200);
  });
  assert.equal(texto, JSON.stringify({ ok: true, message: MSG_CONVITE_RECEBIDO }));
  assert.equal(total(), 1);
  const linha = getDb().prepare("SELECT situacao, papel, funcao_declarada, telefone_e164, email, convite_id FROM bot_usuario").get() as {
    situacao: string;
    papel: string;
    funcao_declarada: string;
    telefone_e164: string;
    email: string;
    convite_id: string;
  };
  assert.equal(linha.situacao, "pendente");
  assert.equal(linha.papel, "");
  assert.equal(linha.funcao_declarada, "Compras");
  assert.equal(linha.telefone_e164, E164);
  assert.equal(linha.email, EMAIL);
  assert.equal(linha.convite_id, link.id);
  assert.equal(resolverRemetente(E164).permitido, false);
  assert.deepEqual(resolverRemetente(E164), RECUSA_CADASTRO);
  assert.equal(auditoriaTexto().includes(DIGITOS), false);
  assert.equal(auditoriaTexto().includes(EMAIL), false);
  assert.equal(auditoriaTexto().includes(NOME), false);
  assert.equal(auditoriaTexto().includes(link.token), false);

  const segunda = await enviar(link.token, { telefone: "11900000002", confirmacao: "11900000002", nome: "Bruno Exemplo", email: "bruno@aion.local" });
  assert.equal(segunda.resposta.status, 200);
  assert.equal(segunda.texto, texto);
  assert.equal(total(), 2);
  assert.equal(lerConviteGrupo().ativo?.cadastros, 2);
});

test("A56 U-G3: telefone fora de 10–11 dígitos ou divergente não grava; o válido vira E.164", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  const curto = await enviar(link.token, { telefone: "119000000", confirmacao: "119000000" });
  assert.equal(curto.resposta.status, 400);
  assert.equal(curto.texto.includes(MSG_TEL_FORMATO), true);
  const longo = await enviar(link.token, { telefone: "119000000011", confirmacao: "119000000011" });
  assert.equal(longo.resposta.status, 400);
  const diverge = await enviar(link.token, { telefone: TEL, confirmacao: "11900000002" });
  assert.equal(diverge.resposta.status, 400);
  assert.equal(diverge.texto.includes(MSG_TEL_DIVERGE), true);
  assert.equal(total(), 0);

  const fixo = await enviar(link.token, { telefone: "(11) 3333-4444", confirmacao: "1133334444" });
  assert.equal(fixo.resposta.status, 200);
  const gravado = getDb().prepare("SELECT telefone_e164 FROM bot_usuario").get() as { telefone_e164: string };
  assert.equal(gravado.telefone_e164, "+551133334444");
});

test("A57 U-G6: a mesma frase e o mesmo status para número novo, pendente e aprovado", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  const novo = await enviar(link.token, { telefone: "11900000003", confirmacao: "11900000003", nome: "Clara Exemplo" });
  const pendente = await enviar(link.token);
  const criado = getDb().prepare("SELECT id FROM bot_usuario WHERE telefone_e164 = ?").get(E164) as { id: string };
  assert.equal(aplicarAcao(criado.id, { acao: "aprovar", papel: "Manutenção" }).ok, true);
  const antes = getDb().prepare("SELECT nome, email, papel, situacao, telefone_e164 FROM bot_usuario WHERE id = ?").get(criado.id);
  const deNovo = await enviar(link.token, { nome: "Outra Pessoa", email: "outra@aion.local", descricao: "Texto diferente ZZ" });
  const depois = getDb().prepare("SELECT nome, email, papel, situacao, telefone_e164 FROM bot_usuario WHERE id = ?").get(criado.id);
  assert.deepEqual(depois, antes);
  assert.equal(novo.resposta.status, pendente.resposta.status);
  assert.equal(pendente.resposta.status, deNovo.resposta.status);
  assert.equal(novo.texto, pendente.texto);
  assert.equal(pendente.texto, deNovo.texto);
  assert.equal(novo.texto, JSON.stringify({ ok: true, message: MSG_CONVITE_RECEBIDO }));
  const conflito = listarConflitoPorId(criado.id);
  assert.equal(conflito.ok, true);
  if (conflito.ok) {
    assert.equal(conflito.data.pendentes.length, 1);
    assert.equal(conflito.data.aprovados.length, 1);
    assert.equal(JSON.stringify(conflito).includes(DIGITOS), false);
  }
  assert.equal(resolverRemetente(E164).permitido, true);
});

test("A58: limites, invisíveis e campos extras devolvem 400 e não gravam", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  const antes = total();
  const email = await enviar(link.token, { email: "ana" });
  assert.equal(email.resposta.status, 400);
  assert.equal(email.texto.includes(MSG_EMAIL_EXEMPLO), true);
  const nome = await enviar(link.token, { nome: "A".repeat(121) });
  assert.equal(nome.texto.includes(msgMaximo(120)), true);
  const descricao = await enviar(link.token, { descricao: "D".repeat(201) });
  assert.equal(descricao.texto.includes(msgMaximo(200)), true);
  const invisivel = await enviar(link.token, { nome: `Ana\u202eExemplo` });
  assert.equal(invisivel.resposta.status, 400);
  assert.equal(invisivel.texto.includes(MSG_CARACTERES_PROIBIDOS), true);
  assert.equal(invisivel.texto.includes("\u202e"), false);
  for (const extra of [{ papel: "Compras" }, { situacao: "ativo" }, { aprovado_por: "Leandro" }, { ativo: true }]) {
    const resposta = await enviar(link.token, extra);
    assert.equal(resposta.resposta.status, 400, JSON.stringify(extra));
    assert.equal(resposta.texto, JSON.stringify({ ok: false, message: MSG_CORPO_CADASTRO }));
  }
  const noLimite = await enviar(link.token, { nome: "A".repeat(120), descricao: "D".repeat(200) });
  assert.equal(noLimite.resposta.status, 200);
  assert.equal(total(), antes + 1);
});

test("A60 U-G4 U-G5: setor inativo ou desconhecido é 400; a página lista só os 148 ativos", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  const inativo = await enviar(link.token, { setores: ["15"] });
  assert.equal(inativo.resposta.status, 400);
  assert.equal(inativo.texto.includes(MSG_SETOR_INVALIDO), true);
  const desconhecido = await enviar(link.token, { setores: ["NAO-EXISTE"] });
  assert.equal(desconhecido.resposta.status, 400);
  const vazio = await enviar(link.token, { setores: [] });
  assert.equal(vazio.resposta.status, 400);
  assert.equal(total(), 0);
  const varios = await enviar(link.token, { setores: ["55D", "16", "55D"] });
  assert.equal(varios.resposta.status, 200);
  const id = (getDb().prepare("SELECT id FROM bot_usuario").get() as { id: string }).id;
  const vinculos = getDb().prepare("SELECT setor_codigo FROM bot_usuario_setor WHERE usuario_id = ? ORDER BY setor_codigo").all(id) as Array<{
    setor_codigo: string;
  }>;
  assert.deepEqual(
    vinculos.map((item) => item.setor_codigo),
    ["16", "55D"],
  );

  const pagina = await abrir(link.token);
  assert.equal(pagina.html.includes("Meu setor não está na lista"), false);
  assert.equal(/turnstile|captcha/i.test(pagina.html), false);
  const json = /<script type="application\/json" id="setores-dados">([^<]*)<\/script>/.exec(pagina.html)?.[1] ?? "[]";
  const setores = JSON.parse(json) as Array<{ codigo: string; nome: string }>;
  assert.equal(setores.length, 148);
  assert.equal(setores.some((setor) => setor.codigo === "15"), false);
  assert.equal(setores.some((setor) => setor.codigo === "55D"), true);
  assert.equal(typeof setores.find((setor) => setor.codigo === "55D")?.codigo, "string");
});

test("A61 U-G7 U-G9: vencido ou revogado não grava; reemitir invalida o anterior na hora", async () => {
  const primeiro = emitirConviteGrupo(AGORA);
  if (!primeiro.ok) return;
  getDb().prepare("UPDATE bot_convite_grupo SET expira_em = ? WHERE id = ?").run("2026-11-01T00:00:00.000Z", primeiro.id);
  const vencido = await enviar(primeiro.token);
  assert.equal(vencido.resposta.status, 400);
  assert.equal(vencido.texto, JSON.stringify({ ok: false, message: MSG_LINK_INATIVO }));
  assert.equal(total(), 0);
  const paginaVencida = await abrir(primeiro.token);
  assert.equal(paginaVencida.html.includes(MSG_LINK_INATIVO), true);
  assert.equal(paginaVencida.html.includes("Enviar cadastro"), false);

  const segundo = emitirConviteGrupo(AGORA);
  if (!segundo.ok) return;
  assert.equal(revogarConviteAtivo(AGORA).ok, true);
  const revogado = await enviar(segundo.token);
  assert.equal(revogado.texto, JSON.stringify({ ok: false, message: MSG_LINK_INATIVO }));
  assert.equal(total(), 0);

  const terceiro = emitirConviteGrupo(AGORA);
  if (!terceiro.ok) return;
  const ok = await enviar(terceiro.token);
  assert.equal(ok.resposta.status, 200);
  const quarto = emitirConviteGrupo(new Date(AGORA.getTime() + 1000));
  if (!quarto.ok) return;
  const antigo = await enviar(terceiro.token, { telefone: "11900000004", confirmacao: "11900000004" });
  assert.equal(antigo.resposta.status, 400);
  assert.equal(antigo.texto.includes(MSG_LINK_INATIVO), true);
  const novo = await enviar(quarto.token, { telefone: "11900000004", confirmacao: "11900000004" });
  assert.equal(novo.resposta.status, 200);
  const revogados = getDb().prepare("SELECT COUNT(*) n FROM bot_convite_grupo WHERE revogado_em IS NOT NULL").get() as { n: number };
  assert.ok(revogados.n >= 1);
  assert.equal(total(), 2);
});

test("A62: limite por IP ignora CF-Connecting-IP até TRUST_CF_CONNECTING_IP=true", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  process.env[LIMITE_IP_ENV] = "2";
  process.env[TRUST_CF_CONNECTING_IP] = "false";
  const cru = (ip: string, cf: string) =>
    post(link.token, { csrf: "a" }, { ip, cf, cookie: "aion_convite_csrf=aa" });
  assert.equal((await cru("9.9.9.9", "1.1.1.1")).status, 403);
  assert.equal((await cru("9.9.9.9", "2.2.2.2")).status, 403);
  assert.equal((await cru("9.9.9.9", "3.3.3.3")).status, 429);
  assert.equal((await cru("8.8.8.8", "1.1.1.1")).status, 403);
  assert.equal(total(), 0);

  getDb().exec("DELETE FROM bot_convite_limite");
  process.env[TRUST_CF_CONNECTING_IP] = "true";
  assert.equal((await cru("9.9.9.9", "1.1.1.1")).status, 403);
  assert.equal((await cru("8.8.8.8", "1.1.1.1")).status, 403);
  assert.equal((await cru("7.7.7.7", "1.1.1.1")).status, 429);
  assert.equal((await cru("9.9.9.9", "4.4.4.4")).status, 403);
  assert.equal(total(), 0);
});

test("A62 U-G2 U-G10: CSRF, armadilha, cabeçalhos e textos da página", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  const pagina = await abrir(link.token);
  assert.equal(pagina.resposta.headers.get("referrer-policy"), "no-referrer");
  assert.equal(pagina.resposta.headers.get("x-robots-tag"), "noindex");
  assert.equal(pagina.resposta.headers.get("cache-control"), "no-store");
  const head = await conviteRota.HEAD(new Request(`http://local/convite/${link.token}`), { params: Promise.resolve({ token: link.token }) });
  assert.equal(head.headers.get("referrer-policy"), "no-referrer");
  assert.equal(head.headers.get("x-robots-tag"), "noindex");
  assert.equal(head.headers.get("cache-control"), "no-store");
  for (const trecho of ["Nome completo", "WhatsApp com DDD", "Confirme o WhatsApp", "E-mail", "Sua função", "Descreva sua função", "Setores que você atende", "Li e concordo com o aviso de privacidade", "Enviar cadastro"]) {
    assert.equal(pagina.html.includes(trecho), true, trecho);
  }
  const ordem = ["Nome completo", "WhatsApp com DDD", "Confirme o WhatsApp", "E-mail", "Sua função", "Descreva sua função no hospital", "Setores que você atende"];
  for (let i = 1; i < ordem.length; i += 1) {
    assert.ok(pagina.html.indexOf(ordem[i - 1]!) < pagina.html.indexOf(ordem[i]!), ordem[i]);
  }
  for (const paragrafo of AVISO_PRIVACIDADE) assert.equal(pagina.html.includes(paragrafo), true);
  assert.equal(pagina.html.includes("aria-live=\"polite\""), true);
  assert.equal(pagina.html.includes("min-height: 44px"), true);
  assert.equal(pagina.html.includes("Outro"), false);

  const semOrigem = await post(link.token, pedido({}, pagina.csrf), { cookie: pagina.cookie, origin: null });
  assert.equal(semOrigem.status, 403);
  const armadilha = await enviar(link.token, { empresa: "spam" });
  assert.equal(armadilha.resposta.status, 400);
  assert.equal(armadilha.texto.includes(MSG_CONVITE_ARMADILHA), true);
  assert.equal(total(), 0);

  process.env[LIMITE_TEL_ENV] = "2";
  const um = await enviar(link.token, { telefone: "11900000005", confirmacao: "11900000005" }, "203.0.113.20");
  const dois = await enviar(link.token, { telefone: "11900000005", confirmacao: "11900000005", nome: "Diana Exemplo" }, "203.0.113.21");
  const tres = await enviar(link.token, { telefone: "11900000005", confirmacao: "11900000005" }, "203.0.113.22");
  assert.equal(um.resposta.status, 200);
  assert.equal(dois.resposta.status, 200);
  assert.equal(tres.resposta.status, 429);
  assert.ok(tres.resposta.headers.get("retry-after"));
  const outro = await enviar(link.token, { telefone: "11900000006", confirmacao: "11900000006" }, "203.0.113.23");
  assert.equal(outro.resposta.status, 200);
});

test("A59 A63: a função declarada não libera o bot; aprovar grava o papel escolhido", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  assert.equal((await enviar(link.token, { funcao: "Outro" })).resposta.status, 400);
  assert.equal((await enviar(link.token)).resposta.status, 200);
  const linha = getDb().prepare("SELECT id, situacao, papel, funcao_declarada, descricao_funcao FROM bot_usuario").get() as {
    id: string;
    situacao: string;
    papel: string;
    funcao_declarada: string;
    descricao_funcao: string;
  };
  assert.equal(linha.situacao, "pendente");
  assert.equal(linha.papel, "");
  assert.equal(linha.funcao_declarada, "Compras");
  assert.equal(resolverRemetente(E164).permitido, false);
  const aprovado = aplicarAcao(linha.id, { acao: "aprovar", papel: "Manutenção" });
  assert.equal(aprovado.ok, true);
  if (!aprovado.ok) return;
  assert.equal(aprovado.data.papel, "Manutenção");
  assert.equal(aprovado.data.funcao_declarada, "Compras");
  assert.equal(aprovado.data.descricao_funcao, DESCRICAO);
  const permitido = resolverRemetente(E164);
  assert.equal(permitido.permitido, true);
  if (permitido.permitido) {
    assert.equal(JSON.stringify(permitido).includes(EMAIL), false);
    assert.equal(JSON.stringify(permitido).includes(DESCRICAO), false);
  }
});

test("A64: excluir pendente, aprovado e recusado apaga o dado e a auditoria fica sem ele", async () => {
  const link = emitirConviteGrupo(AGORA);
  if (!link.ok) return;
  assert.equal((await enviar(link.token)).resposta.status, 200);
  assert.equal((await enviar(link.token, { telefone: "11900000007", confirmacao: "11900000007", nome: "Bruno Exemplo", email: "bruno@aion.local" })).resposta.status, 200);
  assert.equal((await enviar(link.token, { telefone: "11900000008", confirmacao: "11900000008", nome: "Carla Exemplo", email: "carla@aion.local" })).resposta.status, 200);
  const linhas = getDb().prepare("SELECT id, telefone_e164 FROM bot_usuario ORDER BY telefone_e164").all() as Array<{ id: string; telefone_e164: string }>;
  const pendente = linhas[0]!;
  const aprovadoId = linhas[1]!.id;
  const recusadoId = linhas[2]!.id;
  assert.equal(aplicarAcao(aprovadoId, { acao: "aprovar", papel: "Compras" }).ok, true);
  assert.equal(aplicarAcao(recusadoId, { acao: "recusar" }).ok, true);
  assert.equal(resolverRemetente(linhas[1]!.telefone_e164).permitido, true);

  const semSessao = await itemRota.DELETE(new Request(`http://local/api/cadastros/bot-usuarios/${pendente.id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: pendente.id }),
  });
  assert.equal(semSessao.status, 403);
  assert.equal(total(), 3);

  async function excluir(id: string) {
    return itemRota.DELETE(
      new Request(`http://local/api/cadastros/bot-usuarios/${id}`, {
        method: "DELETE",
        headers: { cookie: `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`, origin: ORIGEM },
      }),
      { params: Promise.resolve({ id }) },
    );
  }

  for (const id of [pendente.id, aprovadoId, recusadoId]) {
    const resposta = await excluir(id);
    assert.equal(resposta.status, 200, id);
    assert.equal(getDb().prepare("SELECT id FROM bot_usuario WHERE id = ?").get(id), undefined);
    assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_usuario_setor WHERE usuario_id = ?").get(id) as { n: number }).n, 0);
  }
  assert.equal(total(), 0);
  assert.equal(resolverRemetente(linhas[1]!.telefone_e164).permitido, false);
  const trilha = getDb().prepare("SELECT usuario_id, ator, acao, recurso, criado_em FROM bot_auditoria WHERE acao = 'excluir'").all() as Array<{
    usuario_id: string;
    ator: string;
    acao: string;
    recurso: string;
    criado_em: string;
  }>;
  assert.equal(trilha.length, 3);
  const texto = JSON.stringify(getDb().prepare("SELECT * FROM bot_auditoria").all());
  for (const trecho of [NOME, EMAIL, DIGITOS, DESCRICAO, "Bruno Exemplo", "bruno@aion.local", "Carla Exemplo"]) {
    assert.equal(texto.includes(trecho), false, trecho);
  }
  assert.deepEqual(
    trilha.map((evento) => evento.usuario_id).sort(),
    [pendente.id, aprovadoId, recusadoId].sort(),
  );
  assert.equal(trilha.every((evento) => evento.ator === "admin" && evento.acao === "excluir" && evento.recurso === "cadastro" && evento.criado_em), true);
});

const FRASE_RECEBIDO = "Recebemos seu cadastro. A Aion Engenharia vai conferir e liberar seu acesso.";
const AVISO_CONTROLADOR =
  "A Engenharia Clínica da Aion Engenharia (AionScope) usa estes dados só para liberar e controlar seu acesso ao assistente de consultas de ordens de serviço e equipamentos.";
const AVISO_APROVACAO =
  "Enviar o cadastro não libera o acesso: a Aion Engenharia confere e aprova cada pessoa. Você pode recusar ou pedir a exclusão dos seus dados a qualquer momento, sem prejuízo: é só mandar uma mensagem para a Aion Engenharia no WhatsApp.";

function semNomePessoal(texto: string, estado: string) {
  assert.equal(/leandro/i.test(texto), false, `${estado}: Leandro`);
  assert.equal(/borges/i.test(texto), false, `${estado}: Borges`);
}

function assertLogo(html: string, estado: string) {
  const marcas = (html.match(/<img\b[^>]*>/gi) ?? []).filter(
    (tag) => tag.includes('src="/aion-logo.png"') && tag.includes('alt="Aion Engenharia"'),
  );
  assert.equal(marcas.length, 1, estado);
  const marca = marcas[0]!;
  assert.match(marca, /\bwidth="980"/, estado);
  assert.match(marca, /\bheight="285"/, estado);
  assert.match(html, /\.marca\s*\{[^}]*width:\s*100%/, estado);
  assert.match(html, /\.marca\s*\{[^}]*max-width:\s*180px/, estado);
  assert.match(html, /\.marca\s*\{[^}]*max-height:\s*64px/, estado);
  assert.match(html, /\.marca\s*\{[^}]*aspect-ratio:\s*980\s*\/\s*285/, estado);
  assert.ok(html.indexOf(marca) < html.indexOf("<h1>"), `${estado}: logo no topo`);
}

test("marca pública: HTML do convite e mensagens ao convidado não citam Leandro", async () => {
  assert.equal(MSG_CONVITE_RECEBIDO, FRASE_RECEBIDO);
  assert.equal(AVISO_PRIVACIDADE[0], AVISO_CONTROLADOR);
  assert.equal(AVISO_PRIVACIDADE[2], AVISO_APROVACAO);
  assert.equal(APROVADOR_BOT_V1, "Leandro");

  const link = emitirConviteGrupo(AGORA);
  assert.equal(link.ok, true);
  if (!link.ok) return;
  const valido = await abrir(link.token);

  getDb().prepare("UPDATE bot_convite_grupo SET expira_em = ? WHERE id = ?").run("2026-11-01T00:00:00.000Z", link.id);
  const expirado = await abrir(link.token);

  const outro = emitirConviteGrupo(AGORA);
  assert.equal(outro.ok, true);
  if (!outro.ok) return;
  assert.equal(revogarConviteAtivo(AGORA).ok, true);
  const revogado = await abrir(outro.token);
  const invalido = await abrir("token-inexistente-convite-publico");

  const geradoValido = paginaFormulario({
    csrf: "b".repeat(64),
    setores: [{ codigo: "55D", nome: "UTI exemplo" }],
    papeis: ["Compras"],
  });
  const geradoInativo = paginaInativa();

  const paginas = [
    ["válido", valido.html],
    ["expirado", expirado.html],
    ["revogado", revogado.html],
    ["inválido", invalido.html],
    ["gerado válido", geradoValido],
    ["gerado inativo", geradoInativo],
  ] as const;
  for (const [estado, html] of paginas) {
    semNomePessoal(html, estado);
    assertLogo(html, estado);
    assert.equal(html.toLowerCase().includes(APROVADOR_BOT_V1.toLowerCase()), false, `${estado}: aprovador`);
  }

  assert.equal(valido.html.includes('id="sucesso"'), true);
  semNomePessoal(MSG_CONVITE_RECEBIDO, "enviado");
  assert.equal(valido.html.includes(MSG_CONVITE_OFFLINE), true);
  for (const [estado, texto] of [
    ["erro agora", MSG_CONVITE_AGORA],
    ["erro offline", MSG_CONVITE_OFFLINE],
    ["erro armadilha", MSG_CONVITE_ARMADILHA],
    ["erro link", MSG_LINK_INATIVO],
  ] as const) {
    semNomePessoal(texto, estado);
  }
  assert.equal(expirado.html.includes(MSG_LINK_INATIVO), true);
  assert.equal(invalido.html.includes(MSG_LINK_INATIVO), true);
  assert.equal(revogado.html.includes("Enviar cadastro"), false);

  semNomePessoal(RESPOSTA_PUBLICA_CADASTRO.message, "bot");
  for (const paragrafo of AVISO_PRIVACIDADE) semNomePessoal(paragrafo, "aviso");
  assert.equal(valido.html.includes(AVISO_CONTROLADOR), true);
  assert.equal(valido.html.includes(AVISO_APROVACAO), true);
});

test("validade editável recalcula o link ativo e o código não fixa host", () => {
  const link = emitirConviteGrupo(AGORA);
  assert.equal(link.ok, true);
  if (!link.ok) return;
  const mudou = definirValidadeDias(3, AGORA);
  assert.equal(mudou.ok, true);
  if (!mudou.ok) return;
  assert.equal(Date.parse(mudou.data.ativo?.expira_em ?? "") - AGORA.getTime(), 3 * DIA);
  const fonte = [
    "lib/bot/convite.ts",
    "lib/bot/convite-publico.ts",
    "lib/bot/convite-pagina.ts",
    "lib/bot/convite-limite.ts",
    "app/convite/[token]/route.ts",
  ]
    .map((arquivo) => readFileSync(arquivo, "utf8"))
    .join("\n");
  assert.equal(fonte.includes("console."), false);
  assert.equal(fonte.includes("hef.aion.eng.br"), false);
  assert.equal(fonte.includes("scope.aion.eng.br"), false);
  assert.equal(/\d{10,}/.test(fonte), false);
});
