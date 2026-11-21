import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { closeDbForTests, getDb } from "@/lib/db/client";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import { AJUDA_CALIBRACAO_ENV } from "@/lib/bot/api/calibracao";
import { consultarOsNumero, consultarOsPorSetor } from "@/lib/bot/api/os";
import { BOT_LIMITE_ENV, BOT_LIMITE_MS_ENV, chaveLimite, consumirLimiteApi, resetLimiteApi } from "@/lib/bot/api/limite";
import { contagemRecusaAuth, resetRecusaAuth } from "@/lib/bot/api/recusa";
import { BOT_TOKEN_ENV } from "@/lib/bot/api/token";
import { permissoesPorPapel } from "@/lib/bot/permissoes";
import { aplicarAcao, criarUsuario } from "@/lib/bot/usuarios";
import * as health from "../../app/api/bot/v1/health/route";
import * as freshness from "../../app/api/bot/v1/meta/freshness/route";
import * as osLista from "../../app/api/bot/v1/os/route";
import * as osItem from "../../app/api/bot/v1/os/[numero]/route";
import * as equipamento from "../../app/api/bot/v1/equipamentos/[tag]/route";
import * as calibracao from "../../app/api/bot/v1/calibracao/route";
import * as porSetor from "../../app/api/bot/v1/os/por-setor/route";
import * as usuario from "../../app/api/bot/v1/usuario/route";

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
  resetRecusaAuth();
  getDb().exec(
    "DELETE FROM bot_api_auditoria; DELETE FROM bot_usuario_setor; DELETE FROM bot_usuario; DELETE FROM pbi_cache; DELETE FROM bot_setor_apelido;",
  );
  getDb().prepare("INSERT INTO bot_setor_apelido (apelido, nome) VALUES ('CC', 'Centro Cirúrgico')").run();
});

function pedido(rota: string, extra?: { token?: string | null; telefone?: string | null }) {
  const headers = new Headers();
  if (extra?.token !== null) headers.set("authorization", `Bearer ${extra?.token ?? TOKEN}`);
  if (extra?.telefone !== null) headers.set("x-bot-telefone", extra?.telefone ?? TEL);
  return new Request(`http://local${rota}`, { headers });
}

function pessoa(
  telefone = TEL,
  situacao: "ativo" | "inativo" | "pendente" | "recusado" = "ativo",
  papel = "Compras",
  email?: string,
) {
  const criado = criarUsuario({ nome: "Pessoa ZZTESTE", papel, telefone, setor: "ZZ", email });
  assert.equal(criado.ok, true);
  if (!criado.ok) return "";
  if (situacao === "pendente") return criado.data.id;
  if (situacao === "recusado") {
    const recusa = aplicarAcao(criado.data.id, { acao: "recusar", motivo: "motivo secreto zz" });
    assert.equal(recusa.ok, true);
    return criado.data.id;
  }
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

const CHAVES_ETAPA = [
  ...CHAVES_OS,
  "dias",
  "diasNaEtapa",
  "diasNaEtapaOrigem",
  "etapa",
  "horas",
  "manutencaoExterna",
  "pendenciaCompra",
  "tempoAteAtendimento",
  "textoEtapa",
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
  const rotas = [health, freshness, osLista, osItem, porSetor, equipamento, calibracao];
  const antesTrilha = (getDb().prepare("SELECT COUNT(*) n FROM bot_api_auditoria").get() as { n: number }).n;
  const antesRecusa = contagemRecusaAuth();
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
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_api_auditoria").get() as { n: number }).n, antesTrilha);
  assert.equal(contagemRecusaAuth(), antesRecusa + rotas.length * 4);
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
  assert.deepEqual([...chaves(jsonDetalhe.os)].sort(), [...CHAVES_ETAPA].sort());
  assert.deepEqual([...chaves(jsonDetalhe.historico)].sort(), ["em", "tipo"]);
  assert.equal(jsonDetalhe.os.solicitante, "Solicitante ZZTESTE");
  assert.equal(jsonDetalhe.os.tecnico, "Tecnico ZZTESTE");
  assert.equal(jsonDetalhe.os.responsavel, "Responsavel ZZTESTE");
  assert.equal(Object.hasOwn(jsonDetalhe.os, "matriculaResponsavel"), false);
  assert.equal(Object.hasOwn(jsonDetalhe.os, "matriculaTecnico"), false);
  assert.equal(Object.hasOwn(jsonDetalhe.os, "solicitacao"), false);
  assert.equal(jsonOutra.os.matriculaResponsavel, "ZZMAT1");
  assert.equal(jsonOutra.os.matriculaTecnico, "ZZMAT2");
  assert.equal(jsonOutra.os.solicitacao, "ZZSERVICO");
  assert.equal(jsonLista.itens.length, 1);
  assert.equal(jsonLista.itens[0].numero, "1001");
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
  const setor = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=Centro%20ZZ&equipamento=outro"))).json()) as {
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
  const negado = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: "nao-e-telefone" }));
  assert.equal(negado.status, 403);
  const saudeSemFone = await health.GET(pedido("/api/bot/v1/health", { telefone: null }));
  assert.equal(saudeSemFone.status, 200);
  delete process.env[BOT_TOKEN_ENV];
  const off = await health.GET(pedido("/api/bot/v1/health"));
  assert.equal(off.status, 503);
  const status = getDb().prepare("SELECT status, telefone_mascarado FROM bot_api_auditoria ORDER BY id").all() as Array<{
    status: number;
    telefone_mascarado: string | null;
  }>;
  assert.deepEqual(status.map((item) => item.status), [200, 403, 200]);
  assert.equal(JSON.stringify(status).includes("nao-e-telefone"), false);
  assert.equal(JSON.stringify(getDb().prepare("SELECT * FROM bot_api_auditoria").all()).includes(TOKEN), false);
  assert.equal(contagemRecusaAuth(), 2);

  process.env[BOT_TOKEN_ENV] = TOKEN;
  resetRecusaAuth();
  const antes = (getDb().prepare("SELECT COUNT(*) n FROM bot_api_auditoria").get() as { n: number }).n;
  const logs: string[] = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  };
  try {
    for (let i = 0; i < 30; i++) {
      const recusa = await health.GET(pedido("/api/bot/v1/health", { token: "token-errado-zzteste-0123456789abcd" }));
      assert.equal(recusa.status, 401);
    }
  } finally {
    console.log = original;
  }
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_api_auditoria").get() as { n: number }).n, antes);
  assert.equal(contagemRecusaAuth(), 30);
  assert.equal(logs.length, 1);
  assert.match(logs[0] ?? "", /status=401/);
  assert.equal(logs.join("\n").includes(TOKEN), false);
  assert.equal(logs.join("\n").includes(DIGITOS), false);
  assert.equal(logs.join("\n").includes("nao-e-telefone"), false);
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
  const fora = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: "+55 11 90000-0099" }));
  pessoa(TEL_OUTRA, "inativo");
  const inativo = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: TEL_OUTRA }));
  pessoa("+55 11 90000-0003", "pendente");
  const pendente = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: "+55 11 90000-0003" }));
  const ruim = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: "abc<script>" }));
  const semHeader = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: null }));
  assert.equal((await health.GET(pedido("/api/bot/v1/health", { telefone: null }))).status, 200);
  assert.equal((await health.GET(pedido("/api/bot/v1/health", { telefone: "+55 11 90000-0099" }))).status, 200);
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
  assert.equal(varios.status, 404);
  assert.equal(((await varios.json()) as { status: string }).status, "nao_encontrado");
  const exatoBloco = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=bloco%20zz%20a&ano=2026"))).json()) as {
    status: string;
    setor: string;
  };
  assert.equal(exatoBloco.status, "ok");
  assert.equal(exatoBloco.setor, "BLOCO ZZ A");

  const inserirApelido = getDb().prepare("INSERT INTO bot_setor_apelido (apelido, nome) VALUES (?, ?)");
  inserirApelido.run("BLOCO", "Bloco Zz A");
  inserirApelido.run("BLOCO", "Bloco Zz B");
  const alias = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=bloco&ano=2026"))).json()) as {
    status: string;
    candidatos: Array<{ ordem: number; setor: string }>;
  };
  assert.equal(alias.status, "ambiguo");
  assert.deepEqual(alias.candidatos, [
    { ordem: 1, setor: "BLOCO ZZ A" },
    { ordem: 2, setor: "BLOCO ZZ B" },
  ]);
  assert.equal(JSON.stringify(alias).includes("Equip ZZ"), false);

  for (const nome of ["A", "B", "C", "D", "E"]) inserirApelido.run("NAVIO", `Navio Zz ${nome}`);
  const cinco = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=navio&ano=2026"))).json()) as {
    status: string;
    candidatos: unknown[];
  };
  assert.equal(cinco.status, "ambiguo");
  assert.equal(cinco.candidatos.length, 5);

  for (let n = 1; n <= 6; n++) inserirApelido.run("SALA", `Sala Zz ${n}`);
  const muitos = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=sala&ano=2026"));
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
  const restrito = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=bloco%20zz%20a&ano=2026"))).json()) as {
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

  const antesAuth = (getDb().prepare("SELECT COUNT(*) n FROM bot_api_auditoria").get() as { n: number }).n;
  const semToken = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=uti%20zzteste&ano=2026", { token: null }));
  assert.equal(semToken.status, 401);
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_api_auditoria").get() as { n: number }).n, antesAuth);
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
  assert.equal(
    (getDb().prepare("SELECT status FROM bot_api_auditoria ORDER BY id DESC LIMIT 1").get() as { status: number }).status,
    503,
  );
});

test("F1 R1 plano vencido conta só meses de 1 a 12 e ano vazio é o corrente", async () => {
  pessoa();
  gravar("cronograma", [
    plano({
      Setor: "Setor Vencido Zz",
      Tag: "ZZVENC1",
      Perioridicade: "Anual",
      ProximaRealizacao: "10/05/2024",
    }),
    plano({
      Setor: "Setor Vencido Zz",
      Tag: "ZZVENC2",
      Perioridicade: "Semestral",
      ProximaRealizacao: "20/01/2025",
    }),
  ]);
  const ano = nowInSaoPaulo().getFullYear();
  assert.equal(ano >= 2026, true);
  const esperado = (alvo: number) => [
    { mes: `${alvo}-01`, equipamentos: 1 },
    { mes: `${alvo}-05`, equipamentos: 1 },
    { mes: `${alvo}-07`, equipamentos: 1 },
  ];
  for (const alvo of [ano, ano + 1]) {
    const resposta = await calibracao.GET(pedido(`/api/bot/v1/calibracao?setor=setor%20vencido%20zz&ano=${alvo}`));
    assert.equal(resposta.status, 200);
    const json = (await resposta.json()) as { status: string; ano: number; meses: Array<{ mes: string; equipamentos: number }> };
    assert.equal(json.status, "ok");
    assert.equal(json.ano, alvo);
    assert.deepEqual(json.meses, esperado(alvo));
    for (const item of json.meses) assert.match(item.mes, /^\d{4}-(0[1-9]|1[0-2])$/);
    assert.equal(JSON.stringify(json).includes("--"), false);
  }
  const semAno = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=setor%20vencido%20zz"))).json()) as {
    ano: number;
    meses: Array<{ mes: string; equipamentos: number }>;
  };
  const anoVazio = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=setor%20vencido%20zz&ano="))).json()) as {
    ano: number;
    meses: Array<{ mes: string; equipamentos: number }>;
  };
  assert.equal(semAno.ano, ano);
  assert.deepEqual(semAno.meses, esperado(ano));
  assert.equal(anoVazio.ano, ano);
  assert.deepEqual(anoVazio.meses, esperado(ano));
  assert.equal((await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=setor%20vencido%20zz&ano=1999"))).status, 400);
  assert.equal((await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=setor%20vencido%20zz&ano=20261"))).status, 400);
});

test("usuario devolve a situacao real, sem dado pessoal, e as permissoes da v1", async () => {
  const ativos = ["os", "equipamentos", "calibracao"];
  assert.deepEqual(permissoesPorPapel("Diretoria/Gestão", "ativo"), ativos);
  assert.deepEqual(permissoesPorPapel("Compras", "ativo"), ativos);
  assert.equal(ativos.includes("indicadores"), false);
  for (const situacao of ["pendente", "inativo", "recusado", "nao_cadastrado"]) {
    assert.deepEqual(permissoesPorPapel("Diretoria/Gestão", situacao), []);
  }

  const idAtivo = pessoa(TEL, "ativo", "Compras", "zzteste@example.com");
  const idPendente = pessoa("+55 11 90000-0002", "pendente");
  const idInativo = pessoa("+55 11 90000-0003", "inativo");
  const idRecusado = pessoa("+55 11 90000-0004", "recusado");
  const antes = getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number };

  const casos = [
    { telefone: TEL, id: idAtivo, situacao: "ativo", pode: true },
    { telefone: "+55 11 90000-0002", id: idPendente, situacao: "pendente", pode: false },
    { telefone: "+55 11 90000-0003", id: idInativo, situacao: "inativo", pode: false },
    { telefone: "+55 11 90000-0004", id: idRecusado, situacao: "recusado", pode: false },
    { telefone: "+55 11 90000-0005", id: null, situacao: "nao_cadastrado", pode: false },
  ];
  for (const caso of casos) {
    const resposta = await usuario.GET(pedido("/api/bot/v1/usuario", { telefone: caso.telefone }));
    assert.equal(resposta.status, 200);
    const json = (await resposta.json()) as Record<string, unknown>;
    assert.equal(json.situacao, caso.situacao);
    assert.equal(json.podeResponder, caso.pode);
    assert.deepEqual(json.permissoes, caso.pode ? ativos : []);
    const texto = JSON.stringify(json);
    for (const proibido of ["telefone", "email", "motivo", "auditoria", "criado_em", "atualizado_em", "verificado_em", "@", "ZZTESTE", "secreto", "example.com", "zzteste@"]) {
      assert.equal(texto.toLowerCase().includes(proibido.toLowerCase()), false, proibido);
    }
    if (caso.id) assert.equal(texto.includes(caso.id), false);
    if (caso.situacao === "ativo") {
      assert.deepEqual(Object.keys(json).sort(), ["papel", "permissoes", "podeResponder", "primeiroNome", "setor", "situacao"]);
      assert.equal(json.primeiroNome, "Pessoa");
      assert.equal(json.papel, "Compras");
      assert.equal(json.setor, "ZZ");
    } else if (caso.situacao === "nao_cadastrado") {
      assert.deepEqual(json, { situacao: "nao_cadastrado", podeResponder: false, permissoes: [] });
    } else {
      assert.deepEqual(Object.keys(json).sort(), ["permissoes", "podeResponder", "situacao"]);
      assert.equal(texto.includes("Pessoa"), false);
      assert.equal(texto.includes("Compras"), false);
      assert.equal(texto.includes("ZZ"), false);
    }
    if (caso.situacao !== "ativo") {
      assert.equal((await osLista.GET(pedido("/api/bot/v1/os?abertas=1", { telefone: caso.telefone }))).status, 403);
      assert.equal((await health.GET(pedido("/api/bot/v1/health", { telefone: caso.telefone }))).status, 200);
    }
  }

  const grafia = (await (await usuario.GET(pedido("/api/bot/v1/usuario", { telefone: "11 0000-0001" }))).json()) as {
    situacao: string;
    primeiroNome: string;
  };
  assert.equal(grafia.situacao, "ativo");
  assert.equal(grafia.primeiroNome, "Pessoa");
  pessoa("+55 11 90000-0006", "ativo", "Diretoria/Gestão");
  const diretoria = (await (await usuario.GET(pedido("/api/bot/v1/usuario", { telefone: "+55 11 90000-0006" }))).json()) as {
    permissoes: string[];
    papel: string;
  };
  assert.equal(diretoria.papel, "Diretoria/Gestão");
  assert.deepEqual(diretoria.permissoes, ativos);
  assert.equal((getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number }).n, antes.n + 1);

  const semToken = await usuario.GET(pedido("/api/bot/v1/usuario", { token: null }));
  assert.equal(semToken.status, 401);
  assert.equal(await semToken.text(), JSON.stringify({ ok: false }));
  const errado = await usuario.GET(pedido("/api/bot/v1/usuario", { token: "token-errado-zzteste-0123456789abcd" }));
  assert.equal(errado.status, 401);
  assert.equal(await errado.text(), JSON.stringify({ ok: false }));
  delete process.env[BOT_TOKEN_ENV];
  const off = await usuario.GET(pedido("/api/bot/v1/usuario"));
  assert.equal(off.status, 503);
  assert.equal((await off.json() as { message: string }).message, "API desativada.");
  process.env[BOT_TOKEN_ENV] = TOKEN;

  const post = await usuario.POST(pedido("/api/bot/v1/usuario"));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
  assert.equal(await post.text(), JSON.stringify({ ok: false }));
  assert.equal(
    (getDb().prepare("SELECT situacao FROM bot_usuario WHERE id = ?").get(idAtivo) as { situacao: string }).situacao,
    "ativo",
  );

  const trilha = auditarTexto();
  assert.equal(trilha.includes("ZZTESTE"), false);
  assert.equal(trilha.includes("example.com"), false);
  assert.equal(trilha.includes("secreto"), false);
  assert.equal(trilha.includes(DIGITOS), false);
  assert.equal(trilha.includes(TOKEN), false);
  const linhas = getDb()
    .prepare("SELECT usuario_id, rota, status, telefone_mascarado FROM bot_api_auditoria WHERE rota = '/api/bot/v1/usuario'")
    .all() as Array<{ usuario_id: string | null; rota: string; status: number; telefone_mascarado: string | null }>;
  assert.equal(linhas.find((linha) => linha.status === 200 && linha.usuario_id === idRecusado)?.telefone_mascarado?.includes("0004"), true);
  assert.equal(linhas.some((linha) => linha.status === 200 && linha.usuario_id === null), true);
  assert.equal(linhas.some((linha) => linha.status === 401), false);
  assert.equal(linhas.some((linha) => linha.status === 405), true);
  assert.equal(linhas.some((linha) => linha.status === 503), false);
  assert.equal(contagemRecusaAuth() >= 3, true);
});

function vincular(usuarioId: string, codigo: string, nome: string) {
  getDb()
    .prepare(
      `INSERT INTO bot_setor (codigo, nome, unidade, ativo, exportado_em)
       VALUES (?, ?, '', 1, '2026-01-01T00:00:00.000Z')
       ON CONFLICT(codigo) DO UPDATE SET nome = excluded.nome`,
    )
    .run(codigo, nome);
  getDb().prepare("INSERT OR IGNORE INTO bot_usuario_setor (usuario_id, setor_codigo) VALUES (?, ?)").run(usuarioId, codigo);
}

test("escopo EC, setor exato, resumo, privacidade, por setor e andamento", async () => {
  const compras = pessoa();
  const chefia = pessoa("+55 11 90000-0101", "ativo", "Chefia de Enfermagem");
  const manutencao = pessoa("+55 11 90000-0102", "ativo", "Manutenção");
  const solicitante = pessoa("+55 11 90000-0103", "ativo", "Solicitante assistencial");
  const semSetor = pessoa("+55 11 90000-0104", "ativo", "Chefia de Enfermagem");
  const diretoria = pessoa("+55 11 90000-0105", "ativo", "Diretoria/Gestão");
  vincular(chefia, "ZZCC", "Centro Cirúrgico");
  vincular(manutencao, "ZZCC", "Centro Cirúrgico");
  vincular(solicitante, "ZZCC", "Centro Cirúrgico");
  vincular(diretoria, "ZZCC", "Centro Cirúrgico");

  const pedidoLongo = `Paciente Exemplo ZZ 123.456.789-09 zz@exemplo.invalid +55 11 98888-7777 ${"A".repeat(300)}`;
  const agora = new Date("2026-03-12T15:00:00.000Z");
  gravar("os-analitico", [
    osBase({
      OS: "2001",
      CodigoSerialOS: 2001,
      Oficina: "Engenharia Clínica",
      TipoDeManutencao: "A - CORRETIVA",
      Setor: "Centro Cirúrgico",
      Tag: "ZZ-CC-1",
      Equipamento: "Bomba ZZCC",
      Abertura: "01/03/2026 10:00",
      DataDoAtendimento: "03/03/2026 10:00",
      Pendencia: "PECA ZZ",
      PendenciaAbertaEm: "02/03/2026 10:00",
      TecnicoResolvedor: "",
      Prioridade: "Alta",
      ObservacaoDaRequisicao: pedidoLongo,
      Servico: "",
      Ocorrencia: "",
    }),
    osBase({
      OS: "2002",
      CodigoSerialOS: 2002,
      Oficina: "  engenharia   clínica ",
      TipoDeManutencao: "Corretiva",
      Setor: "Centro Cirúrgico",
      Tag: "ZZ-CC-2",
      Equipamento: "Monitor ZZCC",
      Abertura: "12/03/2026 08:00",
      DataDoAtendimento: "",
      Pendencia: "",
      TecnicoResolvedor: "Tec ZZ",
      Prioridade: "Baixa",
    }),
    osBase({
      OS: "2003",
      CodigoSerialOS: 2003,
      Oficina: "ENGENHARIA CLINICA",
      TipoDeManutencao: "CORRETIVA",
      Setor: "UTI ZZTESTE",
      Tag: "ZZ-UTI",
      Equipamento: "Bomba ZZUTI",
    }),
    osBase({
      OS: "2004",
      CodigoSerialOS: 2004,
      Oficina: "REFRIGERAÇÃO",
      TipoDeManutencao: "CORRETIVA",
      Setor: "Centro Cirúrgico",
      Tag: "ZZ-REFRI",
      Equipamento: "Evaporadora ZZ",
    }),
    osBase({
      OS: "2005",
      CodigoSerialOS: 2005,
      Oficina: "Engenharia Clínica",
      TipoDeManutencao: "Preventiva",
      Setor: "Centro Cirúrgico",
      Tag: "ZZ-CC-3",
      Equipamento: "Bomba ZZPREV",
      Abertura: "10/03/2026 09:00",
      Prioridade: "Média",
    }),
    osBase({
      OS: "2006",
      CodigoSerialOS: 2006,
      Oficina: "Preventiva Equipamentos",
      TipoDeManutencao: "Preventiva",
      Setor: "Centro Cirúrgico",
      Tag: "ZZ-CC-4",
      Equipamento: "Bomba ZZPLANO",
      Abertura: "11/03/2026 09:00",
      Prioridade: "Média",
    }),
    osBase({
      OS: "2007",
      CodigoSerialOS: 2007,
      Oficina: "Calibração de Equipamentos",
      TipoDeManutencao: "Calibração",
      Setor: "Centro Cirúrgico Ambulatorial",
      Tag: "ZZ-AMB",
      Equipamento: "Bomba ZZAMB",
    }),
    osBase({
      OS: "2008",
      CodigoSerialOS: 2008,
      Oficina: "ENGENHARIA CLÍNICA",
      TipoDeManutencao: "Corretiva",
      Setor: "Farmácia Satélite Centro Cirúrgico",
      Tag: "ZZ-FARM",
      Equipamento: "Bomba ZZFARM",
    }),
    osBase({
      OS: "2009",
      CodigoSerialOS: 2009,
      Oficina: "REFRIGERAÇÃO",
      TipoDeManutencao: "CORRETIVA",
      Setor: "Centro Cirúrgico",
      Tag: "ZZ-CC-1",
      Equipamento: "Evaporadora ZZ",
    }),
  ]);
  gravar("equipamentos", [
    equipBase({ Tag: "ZZ-CC-1", Setor: "Centro Cirúrgico", Equipamento: "Bomba ZZCC" }),
    equipBase({ Tag: "ZZ-UTI", Setor: "UTI ZZTESTE", Equipamento: "Bomba ZZUTI" }),
    equipBase({ Tag: "ZZ-REFRI", Setor: "Centro Cirúrgico", Equipamento: "Evaporadora ZZ" }),
  ]);
  gravar("cronograma", [
    plano({ Setor: "Setor Plano ZZ", Tag: "ZZP1", TipoDeManutencao: "Calibração", Oficina: "REFRIGERAÇÃO" }),
    plano({
      Setor: "Setor Plano ZZ",
      Tag: "ZZP2",
      TipoDeManutencao: "Calibração",
      Oficina: "Calibração de Equipamentos",
      ProximaRealizacao: "15/06/2026",
    }),
    plano({ Setor: "Setor Plano ZZ", Tag: "ZZP3", TipoDeManutencao: "Calibração", ProximaRealizacao: "15/03/2026" }),
  ]);

  const lista = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=Centro%20Cir%C3%BArgico", { telefone: "+55 11 90000-0102" }))).json()) as {
    itens: Array<{ numero: string; matriculaTecnico?: string }>;
    resumo: { total: number; porPrioridade: Record<string, number>; maisAntiga: { numero: string } | null; semTecnico: number };
  };
  assert.deepEqual(lista.itens.map((item) => item.numero).sort(), ["2001", "2002", "2005", "2006"]);
  assert.equal(Object.hasOwn(lista.itens[0]!, "matriculaTecnico"), true);
  assert.deepEqual(Object.keys(lista.resumo).sort(), ["maisAntiga", "porPrioridade", "semTecnico", "total"]);
  assert.equal(lista.resumo.total, 4);
  assert.equal(lista.resumo.maisAntiga?.numero, "2001");
  assert.equal(lista.resumo.semTecnico, 1);
  assert.equal(lista.resumo.porPrioridade.Alta, 1);
  assert.equal(JSON.stringify(lista.resumo).includes("vencid"), false);
  assert.equal(JSON.stringify(lista.resumo).includes("prazo"), false);
  assert.equal(JSON.stringify(lista.resumo).includes("Limite"), false);

  const curto = await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=centro", { telefone: "+55 11 90000-0102" }));
  assert.equal(curto.status, 404);
  const jsonCurto = (await curto.json()) as { status: string; message: string };
  assert.equal(jsonCurto.status, "nao_encontrado");
  assert.equal(jsonCurto.message, "setor não encontrado");
  assert.equal(Object.hasOwn(jsonCurto, "itens"), false);
  assert.equal(JSON.stringify(jsonCurto).includes("2001"), false);

  const espaco = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=Centro%20%20Cirurgico", { telefone: "+55 11 90000-0102" }))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(espaco.itens.map((item) => item.numero).sort(), ["2001", "2002", "2005", "2006"]);
  const apelido = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=cc", { telefone: "+55 11 90000-0102" }))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(apelido.itens.map((item) => item.numero).sort(), ["2001", "2002", "2005", "2006"]);

  getDb().prepare("INSERT INTO bot_setor_apelido (apelido, nome) VALUES ('ZZX', 'Centro Cirúrgico'), ('ZZX', 'UTI ZZTESTE')").run();
  const ambiguo = await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=zzx", { telefone: "+55 11 90000-0102" }));
  assert.equal(ambiguo.status, 200);
  const jsonAmbiguo = (await ambiguo.json()) as { status: string; candidatos: Array<{ setor: string }>; itens?: unknown };
  assert.equal(jsonAmbiguo.status, "ambiguo");
  assert.deepEqual(
    jsonAmbiguo.candidatos.map((item) => item.setor),
    ["CENTRO CIRÚRGICO", "UTI ZZTESTE"],
  );
  assert.equal(Object.hasOwn(jsonAmbiguo, "itens"), false);

  const chefiaLista = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=UTI%20ZZTESTE", { telefone: "+55 11 90000-0101" }))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(chefiaLista.itens.map((item) => item.numero).sort(), ["2001", "2002", "2005", "2006"]);
  const solto = await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=Centro%20Cir%C3%BArgico", { telefone: "+55 11 90000-0104" }));
  assert.equal(solto.status, 200);
  const jsonSolto = (await solto.json()) as { status: string; message: string };
  assert.equal(jsonSolto.status, "setor_nao_cadastrado");
  assert.match(jsonSolto.message, /Cadastre o setor/);
  assert.equal(JSON.stringify(jsonSolto).includes("2001"), false);

  const diretoriaUti = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=UTI%20ZZTESTE", { telefone: "+55 11 90000-0105" }))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(diretoriaUti.itens.map((item) => item.numero), ["2003"]);

  const sumida = await osItem.GET(pedido("/api/bot/v1/os/9999", { telefone: "+55 11 90000-0102" }), {
    params: Promise.resolve({ numero: "9999" }),
  });
  const refrig = await osItem.GET(pedido("/api/bot/v1/os/2004", { telefone: "+55 11 90000-0102" }), {
    params: Promise.resolve({ numero: "2004" }),
  });
  assert.equal(sumida.status, 404);
  assert.equal(refrig.status, 404);
  assert.equal(await refrig.text(), await sumida.text());

  const detalheChefia = await osItem.GET(pedido("/api/bot/v1/os/2001", { telefone: "+55 11 90000-0101" }), {
    params: Promise.resolve({ numero: "2001" }),
  });
  const jsonChefia = (await detalheChefia.json()) as { os: Record<string, unknown> };
  assert.equal(Object.hasOwn(jsonChefia.os, "solicitacao"), false);
  assert.equal(Object.hasOwn(jsonChefia.os, "matriculaTecnico"), false);
  assert.equal(Object.hasOwn(jsonChefia.os, "matriculaResponsavel"), false);
  assert.equal(JSON.stringify(jsonChefia).includes("123.456.789-09"), false);
  const outraSetor = await osItem.GET(pedido("/api/bot/v1/os/2003", { telefone: "+55 11 90000-0101" }), {
    params: Promise.resolve({ numero: "2003" }),
  });
  assert.equal(outraSetor.status, 404);
  assert.equal(await outraSetor.text(), JSON.stringify({ ok: false, message: "Não encontrei." }));

  const detalhe = await consultarOsNumero("2001", manutencao, agora);
  const jsonDetalhe = (await detalhe.json()) as {
    os: {
      solicitacao: string;
      etapa: string;
      pendenciaCompra: boolean;
      manutencaoExterna: boolean;
      dataAtendimento: string;
      tempoAteAtendimento: { horas: number; dias: number };
      diasNaEtapa: number;
      diasNaEtapaOrigem: string;
      textoEtapa: string;
      matriculaTecnico: string;
    };
  };
  assert.equal(jsonDetalhe.os.matriculaTecnico, "ZZMAT2");
  assert.equal(jsonDetalhe.os.etapa, "Aguarda peça/compra");
  assert.equal(jsonDetalhe.os.pendenciaCompra, true);
  assert.equal(jsonDetalhe.os.dataAtendimento, "03/03/2026 10:00");
  assert.deepEqual(jsonDetalhe.os.tempoAteAtendimento, { horas: 48, dias: 2 });
  assert.equal(jsonDetalhe.os.diasNaEtapaOrigem, "pendencia");
  assert.equal(jsonDetalhe.os.diasNaEtapa, 10);
  assert.equal(jsonDetalhe.os.textoEtapa, "Aguarda peça/compra há 10 dias");
  assert.equal(jsonDetalhe.os.solicitacao.includes("Paciente Exemplo ZZ"), true);
  assert.equal(jsonDetalhe.os.solicitacao.includes("123.456.789-09"), false);
  assert.equal(jsonDetalhe.os.solicitacao.includes("@"), false);
  assert.equal(jsonDetalhe.os.solicitacao.includes("98888"), false);
  assert.equal(jsonDetalhe.os.solicitacao.length <= 280, true);
  assert.equal(JSON.stringify(jsonDetalhe.os).includes("vencid"), false);

  const semAtendimento = await consultarOsNumero("2002", manutencao, agora);
  const jsonSem = (await semAtendimento.json()) as {
    os: { dataAtendimento: null; tempoAteAtendimento: null; diasNaEtapa: number; diasNaEtapaOrigem: string; textoEtapa: string };
  };
  assert.equal(jsonSem.os.dataAtendimento, null);
  assert.equal(jsonSem.os.tempoAteAtendimento, null);
  assert.equal(jsonSem.os.diasNaEtapaOrigem, "abertura");
  assert.equal(jsonSem.os.diasNaEtapa, 0);
  assert.equal(jsonSem.os.textoEtapa, "Sem 1º atendimento desde hoje");

  const negado = await porSetor.GET(pedido("/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva", { telefone: "+55 11 90000-0101" }));
  const negadoSol = await porSetor.GET(pedido("/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva", { telefone: "+55 11 90000-0103" }));
  const negadoCompras = await porSetor.GET(pedido("/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva", { telefone: TEL }));
  assert.equal(negado.status, 403);
  assert.equal(await negado.text(), JSON.stringify({ ok: false }));
  assert.equal(negadoSol.status, 403);
  assert.equal(negadoCompras.status, 403);
  assert.equal(compras.length > 0, true);

  const vista = await consultarOsPorSetor(
    new Request("http://local/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva"),
    manutencao,
    agora,
  );
  const jsonVista = (await vista.json()) as {
    tipo: string;
    setores: Array<{ setor: string; quantidade: number; porEtapa: Array<{ etapa: string; quantidade: number; os: Array<{ numero: string; solicitacao?: string }> }> }>;
  };
  assert.equal(jsonVista.tipo, "corretiva");
  const cc = jsonVista.setores.find((item) => item.setor === "CENTRO CIRÚRGICO");
  assert.equal(cc?.quantidade, 2);
  assert.deepEqual(cc?.porEtapa.map((item) => item.etapa), ["Sem 1º atendimento", "Aguarda peça/compra"]);
  assert.deepEqual(cc?.porEtapa.map((item) => item.quantidade), [1, 1]);
  assert.deepEqual(cc?.porEtapa[1]?.os.map((item) => item.numero), ["2001"]);
  assert.equal(cc?.porEtapa[1]?.os[0]?.solicitacao?.includes("123.456.789-09"), false);
  assert.equal(JSON.stringify(jsonVista).includes("2004"), false);
  assert.equal(JSON.stringify(jsonVista).includes("2005"), false);
  assert.equal(JSON.stringify(jsonVista).includes("2006"), false);
  assert.equal(JSON.stringify(jsonVista).includes("2007"), false);
  assert.equal(jsonVista.setores.some((item) => item.setor.includes("FARMÁCIA") || item.setor.includes("FARMACIA")), true);

  const ficha = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-CC-1", { telefone: "+55 11 90000-0102" }), {
    params: Promise.resolve({ tag: "ZZ-CC-1" }),
  });
  assert.equal(ficha.status, 200);
  const jsonFicha = (await ficha.json()) as { ultimasOs: Array<{ numero: string }> };
  assert.deepEqual(jsonFicha.ultimasOs.map((item) => item.numero), ["2001"]);
  const refri = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-REFRI", { telefone: "+55 11 90000-0102" }), {
    params: Promise.resolve({ tag: "ZZ-REFRI" }),
  });
  const nenhuma = await equipamento.GET(pedido("/api/bot/v1/equipamentos/NAOTEM", { telefone: "+55 11 90000-0102" }), {
    params: Promise.resolve({ tag: "NAOTEM" }),
  });
  assert.equal(refri.status, 404);
  assert.equal(await refri.text(), await nenhuma.text());
  const utiChefia = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-UTI", { telefone: "+55 11 90000-0101" }), {
    params: Promise.resolve({ tag: "ZZ-UTI" }),
  });
  assert.equal(utiChefia.status, 404);

  const planoZz = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=setor%20plano%20zz&ano=2026", { telefone: "+55 11 90000-0102" }))).json()) as {
    status: string;
    meses: Array<{ mes: string; equipamentos: number }>;
  };
  assert.equal(planoZz.status, "ok");
  assert.deepEqual(planoZz.meses, [
    { mes: "2026-03", equipamentos: 1 },
    { mes: "2026-06", equipamentos: 1 },
  ]);
});
