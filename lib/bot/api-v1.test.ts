import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { closeDbForTests, getDb } from "@/lib/db/client";
import { AJUDA_CALIBRACAO_ENV } from "@/lib/bot/api/calibracao";
import { BOT_LIMITE_ENV, BOT_LIMITE_MS_ENV, chaveLimite, consumirLimiteApi, resetLimiteApi } from "@/lib/bot/api/limite";
import { BOT_TOKEN_ENV } from "@/lib/bot/api/token";
import { aplicarAcao, criarUsuario } from "@/lib/bot/usuarios";
import * as health from "../../app/api/bot/v1/health/route";
import * as freshness from "../../app/api/bot/v1/meta/freshness/route";
import * as osLista from "../../app/api/bot/v1/os/route";
import * as osItem from "../../app/api/bot/v1/os/[numero]/route";
import * as equipamento from "../../app/api/bot/v1/equipamentos/[tag]/route";
import * as calibracao from "../../app/api/bot/v1/calibracao/route";

const TOKEN = "token-ficticio-zzteste-0123456789abcd";
const TEL = "+55 11 90000-0001";
const TEL_OUTRA = "+55 11 90000-0002";
const DIGITOS = "5511900000001";

let dir = "";
const envAntes = { ...process.env };
const fetchAntes = globalThis.fetch;

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "bot-api-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  process.env = envAntes;
  globalThis.fetch = fetchAntes;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env[BOT_TOKEN_ENV] = TOKEN;
  delete process.env[BOT_LIMITE_ENV];
  delete process.env[BOT_LIMITE_MS_ENV];
  delete process.env[AJUDA_CALIBRACAO_ENV];
  resetLimiteApi();
  getDb().exec("DELETE FROM bot_api_auditoria; DELETE FROM bot_usuario_setor; DELETE FROM bot_usuario; DELETE FROM pbi_cache;");
});

function pedido(rota: string, extra?: { token?: string | null; telefone?: string | null }) {
  const headers = new Headers();
  if (extra?.token !== null) headers.set("authorization", `Bearer ${extra?.token ?? TOKEN}`);
  if (extra?.telefone !== null) headers.set("x-bot-telefone", extra?.telefone ?? TEL);
  return new Request(`http://local${rota}`, { headers });
}

function pessoa(telefone = TEL, situacao: "ativo" | "inativo" | "pendente" = "ativo", papel = "Compras") {
  const criado = criarUsuario({ nome: "Pessoa ZZTESTE", papel, telefone, setor: "ZZ" });
  assert.equal(criado.ok, true);
  if (!criado.ok) return "";
  if (situacao === "pendente") return criado.data.id;
  const aprovado = aplicarAcao(criado.data.id, { acao: "aprovar", papel });
  assert.equal(aprovado.ok, true);
  if (situacao === "inativo") {
    const off = aplicarAcao(criado.data.id, { acao: "inativar" });
    assert.equal(off.ok, true);
  }
  return criado.data.id;
}

function gravar(resource: string, data: unknown, opts?: { fetchedAt?: number; erroEm?: number | null }) {
  const agora = opts?.fetchedAt ?? Date.now() - 30_000;
  getDb()
    .prepare(
      `INSERT INTO pbi_cache (
         cache_key, resource, query, payload, fetched_at, last_attempt_at, last_error_at, last_access_at
       ) VALUES (?, ?, 'zz=1', ?, ?, ?, ?, ?)`,
    )
    .run(`${resource}:zz`, resource, JSON.stringify({ data }), agora, agora, opts?.erroEm ?? null, agora);
}

function osBase(parcial: Record<string, unknown> = {}) {
  return {
    CodigoSerialOS: 1001,
    OS: "1001",
    SituacaoDaOS: "Aberta",
    Tipo: "Corretiva",
    TipoDeManutencao: "Corretiva",
    Prioridade: "Alta",
    Oficina: "Engenharia Clínica",
    Tag: "ZZTAG",
    Equipamento: "Bomba ZZEQUIP",
    Modelo: "Modelo ZZMOD",
    Fabricante: "Fab ZZ",
    Setor: "UTI ZZTESTE",
    CentroDeCusto: "CC ZZ",
    Patrimonio: "PAT-ZZ",
    NumeroDeSerie: "NS-ZZ",
    Abertura: "01/03/2026 10:00",
    Fechamento: "",
    DataDaSolucao: "",
    DataDoAtendimento: "01/03/2026 11:00",
    DataLimiteDoAtendimento: "01/03/2026 12:00",
    DataLimiteDaSolucao: "02/03/2026 10:00",
    Requisitante: "Solicitante ZZTESTE",
    TecnicoResolvedor: "Tecnico ZZTESTE",
    MatriculaResolvedor: "ZZMAT2",
    Responsavel: "Responsavel ZZTESTE",
    MatriculaResponsavel: "ZZMAT1",
    Ocorrencia: "ZZOCORRENCIA 123.456.789-09",
    Causa: "ZZCAUSA",
    ObservacaoDaOS: "ZZOBS",
    Servico: "ZZSERVICO",
    Pendencia: "ZZPENDENCIA",
    Custo: "R$ 999,00",
    Deslocamento: "R$ 10,00",
    LinkAnexo: "https://exemplo.invalid/bytoken/ZZSEGREDO",
    ...parcial,
  };
}

function equipBase(parcial: Record<string, unknown> = {}) {
  return {
    Tag: "ZZTAG",
    Equipamento: "Bomba ZZEQUIP",
    Modelo: "Modelo ZZMOD",
    Fabricante: "Fab ZZ",
    NSerie: "NS-ZZ",
    Patrimonio: "PAT-ZZ",
    Criticidade: "Alta",
    Prioridade: "Alta",
    Status: "Ativo",
    Situacao: "Em operação",
    Setor: "UTI ZZTESTE",
    CentroDeCusto: "CC ZZ",
    GrupoDeSetores: "Grupo ZZ",
    RegistroAnvisa: "ZZANVISA",
    ValidadeDoRegistroAnvisa: "01/01/2030",
    DataDeAquisicao: "01/01/2020",
    "DataDeInstalação": "02/01/2020",
    "DataDeInativação": "",
    DataDeFabricacao: "01/01/2019",
    EndOfLife: "01/01/2035",
    EndOfService: "01/01/2032",
    Fornecedor: "Fornecedor ZZ",
    Endereco: "Rua ZZENDERECO 100",
    Cep: "12345-678",
    Bairro: "Bairro ZZ",
    Cidade: "Cidade ZZ",
    UF: "ZZ",
    ValorDeAquisicao: "R$ 10.000,00",
    ValorDeSubstituicao: "R$ 20.000,00",
    Observacao: "ZZOBS equipamento",
    NotaFiscal: "NF-ZZ",
    ...parcial,
  };
}

function plano(parcial: Record<string, string> = {}) {
  return {
    Setor: "Uti Zzteste",
    Equipamento: "Bomba ZZEQUIP",
    Modelo: "Modelo ZZMOD",
    Fabricante: "Fab ZZ",
    Tag: "ZZTAG",
    PlanoDeManutencao: "Plano ZZ",
    TipoDeManutencao: "Calibração",
    DataDaUltima: "",
    ProximaRealizacao: "15/03/2026",
    Perioridicade: "",
    Observacao: "ZZOBS cronograma",
    Patrimonio: "PAT-ZZ",
    ...parcial,
  };
}

function semVazamento(texto: string) {
  for (const trecho of [
    "R$",
    "ZZOCORRENCIA",
    "ZZCAUSA",
    "ZZOBS",
    "ZZSERVICO",
    "ZZPENDENCIA",
    "ZZENDERECO",
    "12345-678",
    "123.456.789-09",
    "bytoken",
    "ZZSEGREDO",
    TOKEN,
    DIGITOS,
    "900000001",
    "Pessoa ZZTESTE",
    "zzteste@exemplo.invalid",
  ]) {
    assert.equal(texto.includes(trecho), false, trecho);
  }
}

function chaves(valor: unknown, acc = new Set<string>()) {
  if (Array.isArray(valor)) {
    for (const item of valor) chaves(item, acc);
    return acc;
  }
  if (valor && typeof valor === "object") {
    for (const [chave, item] of Object.entries(valor)) {
      acc.add(chave);
      chaves(item, acc);
    }
  }
  return acc;
}

function auditarTexto() {
  return JSON.stringify(getDb().prepare("SELECT * FROM bot_api_auditoria").all());
}

const CHAVES_OS = [
  "abertura",
  "centroDeCusto",
  "dataAtendimento",
  "dataLimiteAtendimento",
  "dataLimiteSolucao",
  "dataSolucao",
  "equipamento",
  "fabricante",
  "fechamento",
  "matriculaResponsavel",
  "matriculaTecnico",
  "modelo",
  "numero",
  "numeroSerie",
  "oficina",
  "patrimonio",
  "prioridade",
  "responsavel",
  "setor",
  "situacao",
  "solicitante",
  "tag",
  "tecnico",
  "tipo",
  "tipoManutencao",
];

test("A1 sem token e token errado respondem 401 igual; variável ausente responde 503", async () => {
  pessoa();
  const sem = await health.GET(pedido("/api/bot/v1/health", { token: null }));
  const errado = await health.GET(pedido("/api/bot/v1/health", { token: "token-errado-zzteste-0123456789abcd" }));
  assert.equal(sem.status, 401);
  assert.equal(errado.status, 401);
  const textoSem = await sem.text();
  const textoErrado = await errado.text();
  assert.equal(textoSem, JSON.stringify({ ok: false }));
  assert.equal(textoErrado, textoSem);
  assert.equal(textoSem.includes("token"), false);
  delete process.env[BOT_TOKEN_ENV];
  const off = await health.GET(pedido("/api/bot/v1/health"));
  assert.equal(off.status, 503);
  assert.equal(await off.text(), JSON.stringify({ ok: false, message: "API desativada." }));
  process.env[BOT_TOKEN_ENV] = "curto";
  assert.equal((await health.GET(pedido("/api/bot/v1/health"))).status, 503);
});

test("A1 token válido e telefone aprovado respondem 200", async () => {
  pessoa();
  const ok = await health.GET(pedido("/api/bot/v1/health"));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true });
});

test("A2 A22 A25 A28 POST PUT PATCH DELETE respondem 405 e não gravam negócio", async () => {
  const id = pessoa();
  const antes = {
    usuarios: (getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n,
    cache: (getDb().prepare("SELECT COUNT(*) n FROM pbi_cache").get() as { n: number }).n,
    pessoa: getDb().prepare("SELECT situacao, papel, telefone_e164 FROM bot_usuario WHERE id = ?").get(id),
  };
  const rotas = [health, freshness, osLista, osItem, equipamento, calibracao];
  for (const rota of rotas) {
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const resposta = await rota[metodo](pedido("/api/bot/v1/health", { token: null, telefone: null }));
      assert.equal(resposta.status, 405);
      assert.equal(resposta.headers.get("allow"), "GET");
      assert.equal(await resposta.text(), JSON.stringify({ ok: false }));
    }
  }
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n, antes.usuarios);
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM pbi_cache").get() as { n: number }).n, antes.cache);
  assert.deepEqual(getDb().prepare("SELECT situacao, papel, telefone_e164 FROM bot_usuario WHERE id = ?").get(id), antes.pessoa);
});

test("A3 A15 A17 A23 allowlist omite dinheiro, endereço, texto livre, CPF e e-mail", async () => {
  pessoa();
  pessoa(TEL_OUTRA, "ativo", "Diretoria/Gestão");
  gravar("os-analitico", [osBase(), osBase({ OS: "1002", CodigoSerialOS: 1002, SituacaoDaOS: "Fechada", Fechamento: "02/03/2026 10:00" })]);
  gravar("equipamentos", [equipBase()]);
  gravar("cronograma", [plano({ TipoDeManutencao: "Preventiva", ProximaRealizacao: "15/12/2026", Tag: "ZZTAG" })]);
  const lista = await osLista.GET(pedido("/api/bot/v1/os?abertas=1"));
  const detalhe = await osItem.GET(pedido("/api/bot/v1/os/1001"), { params: Promise.resolve({ numero: "1001" }) });
  const ficha = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZTAG"), { params: Promise.resolve({ tag: "ZZTAG" }) });
  const outra = await osItem.GET(pedido("/api/bot/v1/os/1001", { telefone: TEL_OUTRA }), {
    params: Promise.resolve({ numero: "1001" }),
  });
  assert.equal(lista.status, 200);
  assert.equal(detalhe.status, 200);
  assert.equal(ficha.status, 200);
  const jsonLista = await lista.json();
  const jsonDetalhe = await detalhe.json();
  const jsonFicha = await ficha.json();
  const jsonOutra = await outra.json();
  assert.deepEqual([...chaves(jsonLista.itens)].sort(), CHAVES_OS);
  assert.deepEqual([...chaves(jsonDetalhe.os)].sort(), CHAVES_OS);
  assert.deepEqual([...chaves(jsonDetalhe.historico)].sort(), ["em", "tipo"]);
  assert.equal(jsonDetalhe.os.solicitante, "Solicitante ZZTESTE");
  assert.equal(jsonDetalhe.os.tecnico, "Tecnico ZZTESTE");
  assert.equal(jsonDetalhe.os.responsavel, "Responsavel ZZTESTE");
  assert.equal(jsonDetalhe.os.matriculaResponsavel, "ZZMAT1");
  assert.equal(jsonLista.itens.length, 1);
  assert.equal(jsonLista.itens[0].numero, "1001");
  assert.deepEqual(jsonOutra.os, jsonDetalhe.os);
  assert.deepEqual(jsonOutra.historico, jsonDetalhe.historico);
  for (const corpo of [jsonLista, jsonDetalhe, jsonFicha]) {
    semVazamento(JSON.stringify(corpo));
    assert.equal(JSON.stringify(corpo).includes("@"), false);
    assert.equal(chaves(corpo).has("email"), false);
    assert.equal(chaves(corpo).has("custo"), false);
    assert.equal(chaves(corpo).has("endereco"), false);
    assert.equal(chaves(corpo).has("cep"), false);
    assert.equal(chaves(corpo).has("ocorrencia"), false);
  }
  const semTel = await osItem.GET(pedido("/api/bot/v1/os/1001", { telefone: null }), {
    params: Promise.resolve({ numero: "1001" }),
  });
  const textoSem = await semTel.text();
  assert.equal(semTel.status, 403);
  assert.equal(textoSem.includes("Solicitante"), false);
  assert.equal(textoSem.includes("ZZTAG"), false);
});

test("A4 freshness mostra a idade e a cópia vencida não vira zero", async () => {
  pessoa();
  const agora = Date.now();
  gravar("os-analitico", [osBase()], { fetchedAt: agora - 20_000 });
  gravar("equipamentos", [equipBase()], { fetchedAt: agora - 40_000 });
  const fresco = await freshness.GET(pedido("/api/bot/v1/meta/freshness"));
  assert.equal(fresco.status, 200);
  const corpo = (await fresco.json()) as { recursos: Array<{ recurso: string; fetchedAt: string | null; idadeSegundos: number | null }> };
  const os = corpo.recursos.find((item) => item.recurso === "os-analitico");
  const monitor = corpo.recursos.find((item) => item.recurso === "monitor-reacao");
  assert.ok(os?.fetchedAt);
  assert.equal(typeof os?.idadeSegundos, "number");
  assert.equal((os?.idadeSegundos ?? 0) > 0, true);
  assert.equal(monitor?.fetchedAt, null);
  assert.equal(monitor?.idadeSegundos, null);

  getDb().exec("DELETE FROM pbi_cache");
  const velho = agora - 8 * 86_400_000;
  gravar("os-analitico", [osBase()], { fetchedAt: velho, erroEm: agora - 1_000 });
  const ruim = await freshness.GET(pedido("/api/bot/v1/meta/freshness"));
  assert.equal(ruim.status, 503);
  const texto = await ruim.text();
  assert.match(texto, /mais de 7 dias/);
  assert.equal(texto.includes('"itens"'), false);
  assert.equal(texto.includes("1001"), false);
  const lista = await osLista.GET(pedido("/api/bot/v1/os?abertas=1"));
  assert.equal(lista.status, 503);
  const textoLista = await lista.text();
  assert.match(textoLista, /mais de 7 dias/);
  assert.equal(textoLista.includes("1001"), false);
  assert.equal(textoLista.includes('"itens"'), false);
});

test("A5 cem chamadas não consultam o Effort", async () => {
  pessoa();
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas += 1;
    throw new Error("effort");
  }) as typeof fetch;
  try {
    for (let i = 0; i < 100; i++) {
      const resposta = await health.GET(pedido("/api/bot/v1/health"));
      assert.equal(resposta.status, 200);
    }
  } finally {
    globalThis.fetch = fetchAntes;
  }
  assert.equal(chamadas, 0);
  const fontes = readdirSync("lib/bot/api");
  for (const nome of fontes) {
    const fonte = readFileSync(path.join("lib/bot/api", nome), "utf8");
    assert.equal(fonte.includes("fetchPbi"), false, nome);
    assert.equal(fonte.includes("refreshPbi"), false, nome);
  }
});

test("A6 limit e pageSize acima de 100 respondem 400; cursor e offset paginam", async () => {
  pessoa();
  gravar("os-analitico", [
    osBase({ OS: "1001", Abertura: "01/03/2026 10:00", Tag: "ZZTAG", Setor: "UTI ZZTESTE", Equipamento: "Bomba ZZEQUIP" }),
    osBase({ OS: "1002", CodigoSerialOS: 1002, Abertura: "02/03/2026 10:00", Tag: "ZZTAG2", Setor: "Centro ZZ", Equipamento: "Outro ZZ" }),
    osBase({ OS: "1003", CodigoSerialOS: 1003, Abertura: "03/03/2026 10:00", Tag: "ZZTAG", Setor: "UTI ZZTESTE", Equipamento: "Bomba ZZEQUIP" }),
  ]);
  assert.equal((await osLista.GET(pedido("/api/bot/v1/os?abertas=1&limit=101"))).status, 400);
  assert.equal((await osLista.GET(pedido("/api/bot/v1/os?abertas=1&pageSize=150"))).status, 400);
  const cem = await osLista.GET(pedido("/api/bot/v1/os?abertas=1&limit=100"));
  assert.equal(cem.status, 200);
  const primeira = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&limit=1"))).json()) as {
    itens: Array<{ numero: string }>;
    proximoCursor: string;
    offset: number;
  };
  assert.equal(primeira.itens.length, 1);
  assert.equal(primeira.itens[0]?.numero, "1003");
  const segunda = (await (await osLista.GET(pedido(`/api/bot/v1/os?abertas=1&limit=1&cursor=${primeira.proximoCursor}`))).json()) as {
    itens: Array<{ numero: string }>;
    offset: number;
  };
  assert.equal(segunda.offset, 1);
  assert.equal(segunda.itens[0]?.numero, "1002");
  const porOffset = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&limit=1&offset=2"))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.equal(porOffset.itens[0]?.numero, "1001");
  const filtro = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&tag=ZZTAG2"))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(filtro.itens.map((item) => item.numero), ["1002"]);
  const setor = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=centro&equipamento=outro"))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(setor.itens.map((item) => item.numero), ["1002"]);
});

test("A7 OS e tag inexistentes respondem 404", async () => {
  pessoa();
  gravar("os-analitico", [osBase()]);
  gravar("equipamentos", [equipBase()]);
  const os = await osItem.GET(pedido("/api/bot/v1/os/9999"), { params: Promise.resolve({ numero: "9999" }) });
  const tag = await equipamento.GET(pedido("/api/bot/v1/equipamentos/NAOTEM"), { params: Promise.resolve({ tag: "NAOTEM" }) });
  assert.equal(os.status, 404);
  assert.equal(tag.status, 404);
  assert.equal(await os.text(), JSON.stringify({ ok: false, message: "Não encontrei." }));
  assert.equal(await tag.text(), JSON.stringify({ ok: false, message: "Não encontrei." }));
});

test("A8 A14 A27 auditoria grava a chamada sem corpo, token, telefone completo, nome ou setor", async () => {
  const id = pessoa();
  gravar("os-analitico", [osBase()]);
  const saida: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    saida.push(args.map((item) => String(item)).join(" "));
  };
  try {
    const resposta = await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=UTI%20ZZTESTE"));
    assert.equal(resposta.status, 200);
    await resposta.text();
  } finally {
    console.log = original;
  }
  const linhas = getDb().prepare("SELECT * FROM bot_api_auditoria").all() as Array<Record<string, unknown>>;
  assert.equal(linhas.length, 1);
  const linha = linhas[0]!;
  assert.equal(linha.usuario_id, id);
  assert.equal(linha.rota, "/api/bot/v1/os");
  assert.equal(typeof linha.query_hash, "string");
  assert.equal(String(linha.query_hash).length, 64);
  assert.match(String(linha.telefone_mascarado), /^\+55 11 •{5}-0001$/);
  assert.equal(linha.status, 200);
  assert.equal(typeof linha.latencia_ms, "number");
  assert.equal(Object.hasOwn(linha, "corpo"), false);
  const texto = JSON.stringify(linha);
  semVazamento(texto);
  assert.equal(texto.includes("UTI ZZTESTE"), false);
  assert.equal(texto.includes("abertas"), false);
  assert.equal(saida.join("\n").includes(DIGITOS), false);
  assert.equal(saida.join("\n").includes(TOKEN), false);

  const ruim = await health.GET(pedido("/api/bot/v1/health", { token: "token-errado-zzteste-0123456789abcd" }));
  assert.equal(ruim.status, 401);
  const negado = await health.GET(pedido("/api/bot/v1/health", { telefone: "nao-e-telefone" }));
  assert.equal(negado.status, 403);
  delete process.env[BOT_TOKEN_ENV];
  const off = await health.GET(pedido("/api/bot/v1/health"));
  assert.equal(off.status, 503);
  const status = getDb().prepare("SELECT status, telefone_mascarado FROM bot_api_auditoria ORDER BY id").all() as Array<{
    status: number;
    telefone_mascarado: string | null;
  }>;
  assert.deepEqual(status.map((item) => item.status), [200, 401, 403, 503]);
  assert.equal(JSON.stringify(status).includes("nao-e-telefone"), false);
  assert.equal(JSON.stringify(getDb().prepare("SELECT * FROM bot_api_auditoria").all()).includes(TOKEN), false);
});

test("A9 A18 limite por token e por pessoa responde 429 com Retry-After", async () => {
  pessoa();
  pessoa(TEL_OUTRA);
  process.env[BOT_LIMITE_ENV] = "2";
  process.env[BOT_LIMITE_MS_ENV] = "60000";
  assert.equal((await health.GET(pedido("/api/bot/v1/health"))).status, 200);
  assert.equal((await health.GET(pedido("/api/bot/v1/health"))).status, 200);
  const bloqueado = await health.GET(pedido("/api/bot/v1/health", { telefone: TEL_OUTRA }));
  assert.equal(bloqueado.status, 429);
  const retry = Number(bloqueado.headers.get("retry-after"));
  assert.equal(Number.isInteger(retry) && retry > 0, true);
  assert.equal(await bloqueado.text(), JSON.stringify({ ok: false }));
  process.env[BOT_LIMITE_ENV] = "1";
  resetLimiteApi();
  const tokenA = chaveLimite("token", "a");
  const pessoa1 = chaveLimite("pessoa", "11111111-1111-4111-8111-111111111111");
  const pessoa2 = chaveLimite("pessoa", "22222222-2222-4222-8222-222222222222");
  assert.equal(consumirLimiteApi([tokenA, pessoa1]).permitido, true);
  assert.equal(consumirLimiteApi([tokenA, pessoa2]).permitido, false);
  resetLimiteApi();
  assert.equal(consumirLimiteApi([chaveLimite("token", "b"), pessoa1]).permitido, true);
  assert.equal(consumirLimiteApi([chaveLimite("token", "c"), pessoa1]).permitido, false);
});

test("A10 A11 A16 A19 A30 fixtures sintéticas, token só da env, sem envio", () => {
  const doc = readFileSync("docs/api-bot-v1.md", "utf8");
  assert.match(doc, /AIONSCOPE_BOT_TOKEN/);
  assert.match(doc, /Railway/);
  assert.match(doc, /não envia mensagem/);
  const token = readFileSync("lib/bot/api/token.ts", "utf8");
  assert.match(token, /timingSafeEqual/);
  assert.equal(token.includes(TOKEN), false);
  const andar = (pasta: string) => {
    for (const nome of readdirSync(pasta)) {
      const abs = path.join(pasta, nome);
      if (statSync(abs).isDirectory()) andar(abs);
      else {
        const fonte = readFileSync(abs, "utf8");
        assert.equal(fonte.includes("sendMail"), false, abs);
        assert.equal(fonte.includes("whatsapp"), false, abs);
        assert.equal(fonte.includes(DIGITOS), false, abs);
      }
    }
  };
  andar("app/api/bot");
  andar("lib/bot/api");
  assert.equal(TEL.startsWith("+55 11 90000-"), true);
});

test("A12 A13 A20 A21 A24 A26 A29 telefone, identidade e nenhuma escrita de cadastro", async () => {
  const id = pessoa();
  const antes = getDb().prepare("SELECT situacao, papel, telefone_e164 FROM bot_usuario WHERE id = ?").get(id);
  const grafia = await health.GET(pedido("/api/bot/v1/health", { telefone: "11 0000-0001" }));
  assert.equal(grafia.status, 200);
  const fora = await health.GET(pedido("/api/bot/v1/health", { telefone: "+55 11 90000-0099" }));
  pessoa(TEL_OUTRA, "inativo");
  const inativo = await health.GET(pedido("/api/bot/v1/health", { telefone: TEL_OUTRA }));
  pessoa("+55 11 90000-0003", "pendente");
  const pendente = await health.GET(pedido("/api/bot/v1/health", { telefone: "+55 11 90000-0003" }));
  const ruim = await health.GET(pedido("/api/bot/v1/health", { telefone: "abc<script>" }));
  const semHeader = await health.GET(pedido("/api/bot/v1/health", { telefone: null }));
  const corpos = await Promise.all([fora, inativo, pendente, ruim, semHeader].map((item) => item.text()));
  for (const item of [fora, inativo, pendente, ruim, semHeader]) assert.equal(item.status, 403);
  assert.equal(new Set(corpos).size, 1);
  assert.equal(corpos[0], JSON.stringify({ ok: false }));
  assert.equal(corpos[0]?.includes("script"), false);
  assert.equal(corpos[0]?.includes("inativo"), false);
  const troca = await health.GET(pedido(`/api/bot/v1/health?telefone=${encodeURIComponent(TEL_OUTRA)}`));
  assert.equal(troca.status, 200);
  const dono = getDb().prepare("SELECT usuario_id FROM bot_api_auditoria WHERE status = 200 ORDER BY id DESC").get() as {
    usuario_id: string;
  };
  assert.equal(dono.usuario_id, id);
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n, 3);
  assert.deepEqual(getDb().prepare("SELECT situacao, papel, telefone_e164 FROM bot_usuario WHERE id = ?").get(id), antes);
  await health.GET(pedido("/api/bot/v1/health"));
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n, 3);
});

test("A65 A66 A67 A68 A69 A70 calibração por setor, só do cache", async () => {
  const id = pessoa();
  const linhas = [
    plano(),
    plano({ Tag: "ZZTAG" }),
    plano({ Tag: "ZZTAG2" }),
    plano({ TipoDeManutencao: "Preventiva", Setor: "Vazio Zzteste", Tag: "ZZPREV", ProximaRealizacao: "15/04/2026" }),
    plano({ Setor: "Bloco Zz A", Tag: "ZZA", Equipamento: "Equip ZZ A" }),
    plano({ Setor: "Bloco Zz B", Tag: "ZZB", Equipamento: "Equip ZZ B" }),
    plano({ Setor: "Unidade ZZ Á", Tag: "ZZACENTO", Equipamento: "Equip ZZ Acento" }),
  ];
  for (const nome of ["A", "B", "C", "D", "E"]) linhas.push(plano({ Setor: `Navio Zz ${nome}`, Tag: `ZZN${nome}` }));
  for (let n = 1; n <= 6; n++) linhas.push(plano({ Setor: `Sala Zz ${n}`, Tag: `ZZS${n}` }));
  gravar("cronograma", linhas);
  let chamadas = 0;
  globalThis.fetch = (async () => {
    chamadas += 1;
    throw new Error("effort");
  }) as typeof fetch;

  const planoUti = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026"));
  assert.equal(planoUti.status, 200);
  const uti = (await planoUti.json()) as {
    status: string;
    setor: string;
    meses: Array<{ mes: string; equipamentos: number }>;
    fetchedAt: string;
    idadeSegundos: number;
    comoConsultarNoEffort: null;
  };
  assert.equal(uti.status, "ok");
  assert.equal(uti.setor, "UTI ZZTESTE");
  assert.deepEqual(uti.meses, [{ mes: "2026-03", equipamentos: 2 }]);
  assert.ok(uti.fetchedAt);
  assert.equal(typeof uti.idadeSegundos, "number");
  assert.equal(uti.comoConsultarNoEffort, null);
  const textoUti = JSON.stringify(uti);
  assert.equal(chaves(uti).has("tag"), false);
  assert.equal(chaves(uti).has("patrimonio"), false);
  assert.equal(chaves(uti).has("modelo"), false);
  assert.equal(chaves(uti).has("equipamento"), false);
  assert.equal(textoUti.includes("ZZEQUIP"), false);
  assert.equal(textoUti.includes("ZZTAG"), false);
  assert.equal(textoUti.includes("ZZMOD"), false);
  assert.equal(textoUti.includes("PAT-ZZ"), false);
  semVazamento(textoUti);

  const outroAno = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2027"))).json()) as {
    status: string;
    meses: unknown[];
  };
  assert.equal(outroAno.status, "ok");
  assert.deepEqual(outroAno.meses, []);

  const vazio = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=vazio%20zzteste&ano=2026"));
  assert.equal(vazio.status, 200);
  const jsonVazio = (await vazio.json()) as { status: string; meses: unknown[] };
  assert.equal(jsonVazio.status, "ok");
  assert.deepEqual(jsonVazio.meses, []);

  const acento = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=unidade%20zz%20a&ano=2026"))).json()) as {
    status: string;
    setor: string;
  };
  assert.equal(acento.status, "ok");
  assert.equal(acento.setor, "UNIDADE ZZ Á");

  const varios = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=bloco%20zz&ano=2026"));
  assert.equal(varios.status, 200);
  const jsonVarios = (await varios.json()) as { status: string; candidatos: Array<{ ordem: number; setor: string }> };
  assert.equal(jsonVarios.status, "ambiguo");
  assert.deepEqual(jsonVarios.candidatos, [
    { ordem: 1, setor: "BLOCO ZZ A" },
    { ordem: 2, setor: "BLOCO ZZ B" },
  ]);
  assert.equal(JSON.stringify(jsonVarios).includes("Equip ZZ"), false);

  const cinco = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=navio%20zz&ano=2026"))).json()) as {
    status: string;
    candidatos: unknown[];
  };
  assert.equal(cinco.status, "ambiguo");
  assert.equal(cinco.candidatos.length, 5);

  const muitos = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=sala%20zz&ano=2026"));
  assert.equal(muitos.status, 200);
  const textoMuitos = await muitos.text();
  const jsonMuitos = JSON.parse(textoMuitos) as { status: string; message: string };
  assert.equal(jsonMuitos.status, "refinar");
  assert.equal(jsonMuitos.message, "Informe o nome do setor com mais detalhe.");
  assert.equal(textoMuitos.includes("SALA ZZ"), false);
  assert.equal(Object.hasOwn(jsonMuitos, "candidatos"), false);

  const nenhum = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=inexistente%20zz&ano=2026"));
  assert.equal(nenhum.status, 404);
  const jsonNenhum = (await nenhum.json()) as { status: string; message: string };
  assert.equal(jsonNenhum.status, "nao_encontrado");
  assert.equal(jsonNenhum.message, "setor não encontrado");
  assert.equal(JSON.stringify(jsonNenhum).includes("inexistente"), false);

  process.env[AJUDA_CALIBRACAO_ENV] = "";
  const vazia = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026"))).json()) as {
    comoConsultarNoEffort: null;
  };
  assert.equal(vazia.comoConsultarNoEffort, null);
  process.env[AJUDA_CALIBRACAO_ENV] = "Texto ficticio ZZ";
  const ajuda = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026"))).json()) as {
    comoConsultarNoEffort: string;
  };
  assert.equal(ajuda.comoConsultarNoEffort, "Texto ficticio ZZ");

  getDb()
    .prepare(
      `INSERT INTO bot_setor (codigo, nome, unidade, ativo, exportado_em)
       VALUES ('ZZA', 'Bloco Zz A', '', 1, '2026-01-01T00:00:00.000Z')`,
    )
    .run();
  getDb().prepare("INSERT INTO bot_usuario_setor (usuario_id, setor_codigo) VALUES (?, 'ZZA')").run(id);
  const restrito = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=bloco%20zz&ano=2026"))).json()) as {
    status: string;
    setor?: string;
    meses?: Array<{ equipamentos: number }>;
  };
  assert.equal(restrito.status, "ok");
  assert.equal(restrito.setor, "BLOCO ZZ A");
  assert.equal(restrito.meses?.[0]?.equipamentos, 1);
  const foraDoVinculo = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026"));
  assert.equal(foraDoVinculo.status, 404);
  assert.equal(((await foraDoVinculo.json()) as { status: string }).status, "nao_encontrado");

  const semToken = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026", { token: null }));
  assert.equal(semToken.status, 401);
  const semFone = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026", { telefone: "+55 11 90000-0099" }));
  assert.equal(semFone.status, 403);
  const trilha = auditarTexto();
  assert.equal(trilha.includes("ZZEQUIP"), false);
  assert.equal(trilha.includes("Bloco Zz"), false);
  assert.equal(trilha.includes(DIGITOS), false);
  assert.equal(trilha.includes("Texto ficticio"), false);
  assert.equal(chamadas, 0);
  globalThis.fetch = fetchAntes;

  getDb().exec("DELETE FROM pbi_cache");
  const semCopia = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026"));
  assert.equal(semCopia.status, 503);
  assert.equal((await semCopia.text()).includes('"meses"'), false);
});
