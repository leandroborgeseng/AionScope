import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { closeDbForTests, getDb } from "@/lib/db/client";
import {
  BOT_AUDITORIA_DIAS_VISIVEIS_ENV,
  BOT_AUDITORIA_DIAS_VISIVEIS_PADRAO,
  BOT_AUDITORIA_MESES_BANCO_ENV,
  BOT_AUDITORIA_MESES_BANCO_PADRAO,
  diasVisiveisAuditoria,
  listarAuditoria,
  mesesBancoAuditoria,
  registrarAuditoria,
} from "./auditoria";
import {
  MSG_AUDITORIA_RECUSADA,
  MSG_CORPO_ACAO,
  MSG_CORPO_CADASTRO,
  MSG_OUTROS_SETORES_INVALIDO,
  MSG_SETOR_INVALIDO,
  MSG_TELEFONE_APROVADO,
  RECUSA_CADASTRO,
  RESPOSTA_PUBLICA_CADASTRO,
  respostaPublicaCadastro,
} from "./mensagens";
import { APROVADOR_BOT_V1, PAPEIS_BOT_ENV, PAPEIS_BOT_PADRAO, canonizarPapel, papeisBot } from "./papeis";
import { SETOR_TAMANHO_MAXIMO } from "./texto-livre";
import { aplicarAcao, criarUsuario, listarConflito, listarUsuarios, resolverRemetente } from "./usuarios";

const TEL = "+55 11 90000-0001";
const TEL_SEM_55 = "11 90000-0001";
const TEL_SEM_9 = "+55 11 0000-0001";
const TEL_DIGITO = "5511900000001";
const OUTRO = "+55 11 90000-0002";
const EMAIL = "ana.zzteste@exemplo.invalid";
const SETOR = "UTI ZZTESTE";
const OUTROS = "Plantao ZZTESTE";
const MARCA_HTML = "ZZHTMLSETOR";
const MARCA_CTRL = "ZZCTRLSETOR";

let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "bot-usuarios-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env[PAPEIS_BOT_ENV];
  delete process.env[BOT_AUDITORIA_DIAS_VISIVEIS_ENV];
  delete process.env[BOT_AUDITORIA_MESES_BANCO_ENV];
  getDb().exec("DELETE FROM bot_auditoria; DELETE FROM bot_usuario;");
});

function pedido(telefone = TEL, extra: Record<string, unknown> = {}) {
  return { nome: "Ana Exemplo", papel: "Compras", telefone, email: EMAIL, setor: SETOR, outros_setores: OUTROS, ...extra };
}

function ids(situacao: string) {
  return getDb()
    .prepare("SELECT id FROM bot_usuario WHERE telefone_e164 = ? AND situacao = ? ORDER BY criado_em")
    .all("+5511900000001", situacao) as Array<{ id: string }>;
}

function auditoriaTexto() {
  return JSON.stringify(getDb().prepare("SELECT * FROM bot_auditoria").all());
}

function totalUsuarios() {
  return (getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n;
}

async function semLog(trechos: string[], fn: () => Promise<void> | void) {
  const saida: string[] = [];
  const metodos = ["log", "info", "warn", "error", "debug"] as const;
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
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

test("grafias do mesmo número resolvem o mesmo cadastro; unicidade só entre aprovados", () => {
  const falso = criarUsuario(pedido(TEL));
  const verdadeiro = criarUsuario(pedido(TEL_SEM_9, { nome: "Bruno Exemplo" }));
  assert.equal(falso.ok, true);
  assert.equal(verdadeiro.ok, true);
  assert.equal(ids("pendente").length, 2);

  const aprovado = aplicarAcao(verdadeiro.ok ? verdadeiro.data.id : "", { acao: "aprovar" });
  assert.equal(aprovado.ok, true);
  if (aprovado.ok) {
    assert.equal(aprovado.data.situacao, "ativo");
    assert.equal(aprovado.data.aprovado_por, APROVADOR_BOT_V1);
    assert.ok(aprovado.data.verificado_em);
  }

  const bloqueado = aplicarAcao(falso.ok ? falso.data.id : "", { acao: "aprovar" });
  assert.deepEqual(bloqueado, { ok: false, status: 409, message: MSG_TELEFONE_APROVADO });
  assert.equal(JSON.stringify(bloqueado).includes(TEL_DIGITO), false);
  assert.equal(ids("pendente").length, 1);
  assert.equal(ids("ativo").length, 1);

  const antes = totalUsuarios();
  const direto = criarUsuario(pedido(TEL_SEM_55, { situacao: "ativo", nome: "Carla Exemplo" }));
  assert.deepEqual(direto, { ok: false, status: 400, message: MSG_CORPO_CADASTRO });
  assert.equal(totalUsuarios(), antes);

  const porMais = resolverRemetente(TEL);
  const porMenos = resolverRemetente("(11) 0000-0001");
  assert.equal(porMais.permitido, true);
  assert.equal(porMenos.permitido, true);
  if (porMais.permitido && porMenos.permitido) {
    assert.equal(porMais.usuario.id, porMenos.usuario.id);
    assert.deepEqual(Object.keys(porMais.usuario).sort(), ["dono", "id", "nome", "papel", "situacao"]);
    assert.equal(JSON.stringify(porMais).includes(TEL_DIGITO), false);
    assert.equal(JSON.stringify(porMais).includes(EMAIL), false);
    assert.equal(JSON.stringify(porMais).includes(SETOR), false);
  }

  const conflito = listarConflito("551100000001");
  assert.equal(conflito.ok, true);
  if (conflito.ok) {
    assert.equal(conflito.data.pendentes.length, 1);
    assert.equal(conflito.data.aprovados.length, 1);
    assert.equal(conflito.data.telefone_mascarado, "+55 11 •••••-0001");
    assert.equal(JSON.stringify(conflito).includes(TEL_DIGITO), false);
  }

  assert.equal(criarUsuario(pedido(OUTRO, { nome: "Diana Exemplo" })).ok, true);
});

test("inativo continua ocupando o número; recusado não ocupa", () => {
  const primeiro = criarUsuario(pedido(TEL));
  assert.equal(primeiro.ok, true);
  const id = primeiro.ok ? primeiro.data.id : "";
  assert.equal(aplicarAcao(id, { acao: "aprovar" }).ok, true);
  assert.equal(aplicarAcao(id, { acao: "inativar" }).ok, true);

  const pendente = criarUsuario(pedido(TEL_SEM_55));
  assert.equal(pendente.ok, true);
  const negado = aplicarAcao(pendente.ok ? pendente.data.id : "", { acao: "aprovar" });
  assert.equal(negado.ok, false);
  if (!negado.ok) assert.equal(negado.message, MSG_TELEFONE_APROVADO);

  getDb().exec("DELETE FROM bot_auditoria; DELETE FROM bot_usuario;");
  const recusado = criarUsuario(pedido(TEL));
  assert.equal(recusado.ok, true);
  assert.equal(aplicarAcao(recusado.ok ? recusado.data.id : "", { acao: "recusar" }).ok, true);
  const depois = criarUsuario(pedido(TEL_SEM_9, { nome: "Bruno Exemplo" }));
  assert.equal(depois.ok, true);
  assert.equal(aplicarAcao(depois.ok ? depois.data.id : "", { acao: "aprovar" }).ok, true);
});

test("A12: fora do cadastro, inativo e mal formatado recusam sem nenhum dado", () => {
  const criado = criarUsuario(pedido(OUTRO, { nome: "Bruno Exemplo" }));
  assert.equal(criado.ok, true);
  const id = criado.ok ? criado.data.id : "";
  assert.equal(aplicarAcao(id, { acao: "aprovar" }).ok, true);
  assert.equal(aplicarAcao(id, { acao: "inativar" }).ok, true);

  const fora = resolverRemetente(TEL);
  const inativo = resolverRemetente(OUTRO);
  const outraGrafia = resolverRemetente("11 90000-0002");
  const ruim = resolverRemetente("abc");
  assert.equal(fora, RECUSA_CADASTRO);
  assert.equal(inativo, RECUSA_CADASTRO);
  assert.equal(outraGrafia, RECUSA_CADASTRO);
  assert.equal(ruim, RECUSA_CADASTRO);

  const trilha = getDb()
    .prepare("SELECT usuario_id, status FROM bot_auditoria WHERE acao = 'consulta' ORDER BY id")
    .all() as Array<{ usuario_id: string | null; status: number }>;
  const dosInativos = trilha.filter((linha) => linha.usuario_id === id);
  assert.equal(dosInativos.length, 2);
  assert.ok(dosInativos.every((linha) => linha.status === 403));
  assert.equal(trilha.some((linha) => linha.usuario_id === null && linha.status === 403), true);
  assert.equal(trilha.some((linha) => linha.status === 400), true);
  assert.equal(auditoriaTexto().includes("900000002"), false);
});

test("resposta pública é a mesma para número novo e já cadastrado", () => {
  criarUsuario(pedido(TEL));
  assert.equal(respostaPublicaCadastro(TEL), RESPOSTA_PUBLICA_CADASTRO);
  assert.equal(respostaPublicaCadastro(TEL_SEM_9), respostaPublicaCadastro("numero-novo-zz"));
  assert.equal(respostaPublicaCadastro("abc"), RESPOSTA_PUBLICA_CADASTRO);
  const json = JSON.stringify(RESPOSTA_PUBLICA_CADASTRO);
  assert.equal(json.includes(TEL_DIGITO), false);
  assert.equal(json.includes("Ana Exemplo"), false);
  assert.equal(json.includes(EMAIL), false);
});

test("listagem mascara telefone e e-mail; auditoria não leva dado sensível nem corpo", async () => {
  await semLog([TEL_DIGITO, "900000001", EMAIL, SETOR, OUTROS, MARCA_HTML, APROVADOR_BOT_V1], () => {
    const criado = criarUsuario(pedido());
    assert.equal(criado.ok, true);
    if (!criado.ok) return;
    assert.equal(criado.data.telefone_mascarado, "+55 11 •••••-0001");
    assert.equal(criado.data.email_mascarado, "a•••@e•••");
    assert.equal(criado.data.setor, SETOR);
    assert.equal(criado.data.outros_setores, OUTROS);
    assert.deepEqual(Object.keys(criado.data).sort(), [
      "aprovado_por",
      "atualizado_em",
      "criado_em",
      "dono",
      "email_mascarado",
      "id",
      "nome",
      "outros_setores",
      "papel",
      "setor",
      "situacao",
      "telefone_mascarado",
      "verificado_em",
    ]);

    const lista = JSON.stringify(listarUsuarios());
    assert.equal(lista.includes(EMAIL), false);
    assert.equal(lista.includes("ana.zzteste"), false);
    assert.equal(lista.includes(TEL_DIGITO), false);
    assert.equal(lista.includes("900000001"), false);

    const html = criarUsuario(pedido(OUTRO, { setor: `<b>${MARCA_HTML}</b>` }));
    assert.deepEqual(html, { ok: false, status: 400, message: MSG_SETOR_INVALIDO });
    const controle = criarUsuario(pedido(OUTRO, { outros_setores: `${MARCA_CTRL}\nplantao` }));
    assert.deepEqual(controle, { ok: false, status: 400, message: MSG_OUTROS_SETORES_INVALIDO });
    const longo = criarUsuario(pedido(OUTRO, { setor: "S".repeat(SETOR_TAMANHO_MAXIMO + 1) }));
    assert.equal(longo.ok, false);
    const noLimite = criarUsuario(pedido(OUTRO, { nome: "Bruno Exemplo", setor: "S".repeat(SETOR_TAMANHO_MAXIMO) }));
    assert.equal(noLimite.ok, true);

    const preenchimento = aplicarAcao(criado.data.id, { acao: "aprovar", setor: MARCA_HTML, email: EMAIL });
    assert.deepEqual(preenchimento, { ok: false, status: 400, message: MSG_CORPO_ACAO });
    assert.equal(JSON.stringify(preenchimento).includes(MARCA_HTML), false);
  });

  const trilha = auditoriaTexto();
  for (const trecho of [TEL_DIGITO, "900000001", EMAIL, "ana.zzteste", SETOR, OUTROS, MARCA_HTML, MARCA_CTRL, "Ana Exemplo", APROVADOR_BOT_V1]) {
    assert.equal(trilha.includes(trecho), false, trecho);
  }
  const colunas = (getDb().prepare("PRAGMA table_info(bot_auditoria)").all() as Array<{ name: string }>).map((c) => c.name);
  assert.deepEqual(colunas, ["id", "criado_em", "usuario_id", "ator", "acao", "recurso", "status"]);
});

test("POST cria só pendente; ativação só pela ação aprovar", () => {
  const antes = totalUsuarios();
  for (const extra of [
    { situacao: "ativo" },
    { situacao: "inativo" },
    { aprovado_por: "Leandro" },
    { verificado_em: "2026-11-10T00:00:00.000Z" },
    { ativo: true },
  ]) {
    const recusado = criarUsuario(pedido(TEL, extra));
    assert.deepEqual(recusado, { ok: false, status: 400, message: MSG_CORPO_CADASTRO });
    assert.equal(JSON.stringify(recusado).includes("ativo"), false);
    assert.equal(JSON.stringify(recusado).includes(TEL_DIGITO), false);
  }
  assert.equal(totalUsuarios(), antes);
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_auditoria").get() as { n: number }).n, 0);

  const explicito = criarUsuario(pedido(OUTRO, { situacao: "pendente", nome: "Bruno Exemplo" }));
  assert.equal(explicito.ok, true);
  if (explicito.ok) {
    assert.equal(explicito.data.situacao, "pendente");
    assert.equal(explicito.data.aprovado_por, null);
    assert.equal(explicito.data.verificado_em, null);
  }

  const criado = criarUsuario(pedido(TEL));
  assert.equal(criado.ok, true);
  if (!criado.ok) return;
  assert.equal(criado.data.situacao, "pendente");
  assert.equal(criado.data.aprovado_por, null);
  assert.equal(criado.data.verificado_em, null);
  const linha = getDb()
    .prepare("SELECT situacao, aprovado_por, verificado_em FROM bot_usuario WHERE id = ?")
    .get(criado.data.id) as { situacao: string; aprovado_por: string | null; verificado_em: string | null };
  assert.deepEqual(linha, { situacao: "pendente", aprovado_por: null, verificado_em: null });

  assert.equal(resolverRemetente(TEL), RECUSA_CADASTRO);
  assert.equal(resolverRemetente(TEL_SEM_9), RECUSA_CADASTRO);

  const pulo = aplicarAcao(criado.data.id, { situacao: "ativo" });
  assert.deepEqual(pulo, { ok: false, status: 400, message: MSG_CORPO_ACAO });
  const reativar = aplicarAcao(criado.data.id, { acao: "reativar" });
  assert.equal(reativar.ok, false);
  assert.equal(
    (getDb().prepare("SELECT situacao FROM bot_usuario WHERE id = ?").get(criado.data.id) as { situacao: string }).situacao,
    "pendente",
  );

  const aprovado = aplicarAcao(criado.data.id, { acao: "aprovar" });
  assert.equal(aprovado.ok, true);
  if (aprovado.ok) {
    assert.equal(aprovado.data.situacao, "ativo");
    assert.equal(aprovado.data.aprovado_por, APROVADOR_BOT_V1);
    assert.ok(aprovado.data.verificado_em);
  }
  const liberado = resolverRemetente(TEL_SEM_55);
  assert.equal(liberado.permitido, true);
  if (liberado.permitido) assert.equal(liberado.usuario.id, criado.data.id);
});

test("auditoria recusa telefone, corpo ou campo extra e não grava a tentativa", () => {
  assert.throws(
    () =>
      registrarAuditoria({
        usuarioId: null,
        ator: "canal",
        acao: "consulta",
        recurso: "cadastro",
        status: 200,
        telefone: TEL,
      } as never),
    (erro: unknown) => erro instanceof Error && erro.message === MSG_AUDITORIA_RECUSADA,
  );
  assert.deepEqual(getDb().prepare("SELECT COUNT(*) n FROM bot_auditoria").get(), { n: 0 });
});

test("papel e retenção são configuráveis; papel não é a lista de setor", () => {
  assert.deepEqual(papeisBot(), [...PAPEIS_BOT_PADRAO]);
  assert.equal(canonizarPapel("compras"), "Compras");
  assert.equal(canonizarPapel("enfermagem"), null);
  assert.equal(diasVisiveisAuditoria(), BOT_AUDITORIA_DIAS_VISIVEIS_PADRAO);
  assert.equal(mesesBancoAuditoria(), BOT_AUDITORIA_MESES_BANCO_PADRAO);
  assert.equal(BOT_AUDITORIA_DIAS_VISIVEIS_PADRAO, 90);
  assert.equal(BOT_AUDITORIA_MESES_BANCO_PADRAO, 12);

  process.env[PAPEIS_BOT_ENV] = "Papel ZZTESTE";
  assert.equal(canonizarPapel("Compras"), null);
  assert.equal(canonizarPapel("papel zzteste"), "Papel ZZTESTE");
  const livre = criarUsuario(pedido(TEL, { papel: "Papel ZZTESTE", setor: "Texto livre que não é papel" }));
  assert.equal(livre.ok, true);
  delete process.env[PAPEIS_BOT_ENV];

  process.env[BOT_AUDITORIA_DIAS_VISIVEIS_ENV] = "abc";
  process.env[BOT_AUDITORIA_MESES_BANCO_ENV] = "0";
  assert.equal(diasVisiveisAuditoria(), 90);
  assert.equal(mesesBancoAuditoria(), 12);

  process.env[BOT_AUDITORIA_DIAS_VISIVEIS_ENV] = "10";
  process.env[BOT_AUDITORIA_MESES_BANCO_ENV] = "1";
  const pessoa = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  registrarAuditoria({ usuarioId: pessoa, ator: "admin", acao: "criar", recurso: "cadastro", status: 201 }, new Date("2026-05-01T00:00:00.000Z"));
  registrarAuditoria({ usuarioId: pessoa, ator: "admin", acao: "aprovar", recurso: "cadastro", status: 200 }, new Date("2026-06-01T00:00:00.000Z"));
  registrarAuditoria({ usuarioId: pessoa, ator: "admin", acao: "consulta", recurso: "cadastro", status: 200 }, new Date("2026-06-15T00:00:00.000Z"));
  const visivel = listarAuditoria(pessoa, new Date("2026-06-15T00:00:00.000Z"));
  assert.equal(visivel.length, 1);
  assert.equal(visivel[0]?.acao, "consulta");
  const noBanco = getDb()
    .prepare("SELECT COUNT(*) n FROM bot_auditoria WHERE usuario_id = ?")
    .get(pessoa) as { n: number };
  assert.equal(noBanco.n, 2);
});

test("código de produção do cadastro não loga e não traz número", () => {
  const arquivos = [
    "lib/bot/mensagens.ts",
    "lib/bot/papeis.ts",
    "lib/bot/telefone.ts",
    "lib/bot/texto-livre.ts",
    "lib/bot/auditoria.ts",
    "lib/bot/usuarios.ts",
    "lib/db/migrations/015_bot_usuario.ts",
    "app/api/cadastros/bot-usuarios/route.ts",
    "app/api/cadastros/bot-usuarios/conflitos/route.ts",
    "app/api/cadastros/bot-usuarios/[id]/route.ts",
    "app/api/cadastros/bot-usuarios/[id]/auditoria/route.ts",
  ];
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.equal(fonte.includes("console."), false, arquivo);
    assert.equal(/\d{10,}/.test(fonte), false, arquivo);
    assert.equal(fonte.includes("setores_adicionais"), false, arquivo);
  }
});
