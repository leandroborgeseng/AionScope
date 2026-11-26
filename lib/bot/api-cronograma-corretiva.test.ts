/**
 * Fluxo do Centro Cirúrgico só pela API do bot, com dados fictícios.
 * Cobre cronograma, datas da TAG, apelido CC, calibração, parque e corretiva.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { closeDbForTests, getDb } from "@/lib/db/client";
import { BOT_TOKEN_ENV } from "@/lib/bot/api/token";
import { resetLimiteApi } from "@/lib/bot/api/limite";
import { resetRecusaAuth } from "@/lib/bot/api/recusa";
import { aplicarAcao, criarUsuario } from "@/lib/bot/usuarios";
import * as osLista from "../../app/api/bot/v1/os/route";
import * as porSetor from "../../app/api/bot/v1/os/por-setor/route";
import * as equipamento from "../../app/api/bot/v1/equipamentos/[tag]/route";
import * as calibracao from "../../app/api/bot/v1/calibracao/route";
import * as cronograma from "../../app/api/bot/v1/cronograma/route";
import * as usuario from "../../app/api/bot/v1/usuario/route";

const TOKEN = "token-ficticio-zzteste-0123456789abcd";
/** Linha real do catálogo (`data/setores-effort-20261111.csv`): 10A = CENTRO CIRÚRGICO. */
const COD_CC = "10A";
const NOME_CC = "CENTRO CIRÚRGICO";
/** Formato da OS no Effort (smoke 21/11): código no fim. */
const SETOR = "CENTRO CIRÚRGICO - 10A";
const AMB = "CENTRO CIRÚRGICO AMBULATORIAL - 97";
const TEL_CC = "+55 11 90000-0201";
const TEL_SEM = "+55 11 90000-0202";
const TEL_GEST = "+55 11 90000-0203";
const TEL_ENDO = "+55 11 90000-0204";
const TEL_LIVRE = "+55 11 90000-0205";
const TEL_COMPRAS = "+55 11 90000-0206";
const FARMACIA = "FARMÁCIA SATÉLITE CENTRO CIRÚRGICO - 17B";

let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "bot-cc-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env[BOT_TOKEN_ENV] = TOKEN;
  resetLimiteApi();
  resetRecusaAuth();
  getDb().exec(
    "DELETE FROM bot_api_auditoria; DELETE FROM bot_usuario_setor; DELETE FROM bot_usuario; DELETE FROM pbi_cache; DELETE FROM bot_setor_apelido;",
  );
  getDb().prepare("INSERT INTO bot_setor_apelido (apelido, nome) VALUES ('CC', 'Centro Cirúrgico')").run();
});

function pedido(rota: string, telefone: string) {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${TOKEN}`);
  headers.set("x-bot-telefone", telefone);
  return new Request(`http://local${rota}`, { headers });
}

function pessoa(telefone: string, papel: string) {
  const criado = criarUsuario({ nome: "Pessoa ZZTESTE", papel, telefone, setor: "ZZ" });
  assert.equal(criado.ok, true);
  if (!criado.ok) return "";
  const aprovado = aplicarAcao(criado.data.id, { acao: "aprovar", papel });
  assert.equal(aprovado.ok, true);
  getDb().prepare("UPDATE bot_usuario SET setor = NULL WHERE id = ?").run(criado.data.id);
  return criado.data.id;
}

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

function gravar(resource: string, data: unknown) {
  const agora = Date.now() - 30_000;
  getDb()
    .prepare(
      `INSERT INTO pbi_cache (
         cache_key, resource, query, payload, fetched_at, last_attempt_at, last_error_at, last_access_at
       ) VALUES (?, ?, 'zz=1', ?, ?, ?, NULL, ?)`,
    )
    .run(`${resource}:zzcc`, resource, JSON.stringify({ data }), agora, agora, agora);
}

function osBase(parcial: Record<string, unknown>) {
  return {
    CodigoSerialOS: 9100,
    OS: "9100",
    SituacaoDaOS: "Aberta",
    Tipo: "",
    TipoDeManutencao: "",
    Prioridade: "Alta",
    Oficina: "Engenharia Clínica",
    Tag: "",
    Equipamento: "",
    Modelo: "",
    Fabricante: "",
    Setor: SETOR,
    CentroDeCusto: "",
    Patrimonio: "",
    NumeroDeSerie: "",
    Abertura: "01/03/2026 10:00",
    Fechamento: "",
    DataDaSolucao: "",
    DataDoAtendimento: "",
    DataLimiteDoAtendimento: "",
    DataLimiteDaSolucao: "",
    Requisitante: "",
    TecnicoResolvedor: "",
    Responsavel: "",
    Ocorrencia: "",
    Causa: "",
    Servico: "",
    Pendencia: "",
    ...parcial,
  };
}

function plano(parcial: Record<string, string>) {
  return {
    Setor: SETOR,
    Equipamento: "Bomba ZZ",
    Modelo: "",
    Fabricante: "",
    Tag: "ZZ-02932",
    PlanoDeManutencao: "",
    TipoDeManutencao: "",
    DataDaUltima: "",
    ProximaRealizacao: "",
    Perioridicade: "",
    Observacao: "ZZOBS cronograma",
    ...parcial,
  };
}

test("usuário assistencial com setor null recebe setor_nao_cadastrado", async () => {
  pessoa(TEL_SEM, "Chefia de Enfermagem");
  gravar("os-analitico", [osBase({ OS: "9101", CodigoSerialOS: 9101, TipoDeManutencao: "Corretiva", Tag: "ZZ-CORR" })]);
  const ficha = (await (await usuario.GET(pedido("/api/bot/v1/usuario", TEL_SEM))).json()) as { setor: string | null };
  assert.equal(ficha.setor, null);
  const resposta = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", TEL_SEM));
  assert.equal(resposta.status, 200);
  const json = (await resposta.json()) as { ok: boolean; status: string; message: string; itens?: unknown };
  assert.equal(json.ok, false);
  assert.equal(json.status, "setor_nao_cadastrado");
  assert.match(json.message, /Cadastre o setor/);
  assert.equal(Object.hasOwn(json, "itens"), false);
});

test("Centro Cirúrgico: corretiva, parque e datas de preventiva, TSE e calibração", async () => {
  const cc = pessoa(TEL_CC, "Chefia de Enfermagem");
  vincular(cc, COD_CC, NOME_CC);
  const gestao = pessoa(TEL_GEST, "Manutenção");
  assert.equal(gestao.length > 0, true);

  gravar("os-analitico", [
    osBase({ OS: "9101", CodigoSerialOS: 9101, Tipo: "Corretiva", TipoDeManutencao: "Corretiva", Tag: "ZZ-CORR", Equipamento: "Bomba ZZCORR", Abertura: "01/03/2026 08:00" }),
    osBase({ OS: "9102", CodigoSerialOS: 9102, Tipo: "Compra", TipoDeManutencao: "Compra de peça", Tag: "ZZ-COMPRA", Equipamento: "Monitor ZZCOMPRA", Abertura: "02/03/2026 08:00" }),
    osBase({ OS: "9103", CodigoSerialOS: 9103, Tipo: "Externa", TipoDeManutencao: "Manutenção Externa", Tag: "ZZ-EXT", Equipamento: "Foco ZZEXT", Abertura: "03/03/2026 08:00" }),
    osBase({ OS: "9104", CodigoSerialOS: 9104, Tipo: "", TipoDeManutencao: "", Tag: "", Equipamento: "", Abertura: "04/03/2026 08:00" }),
    osBase({ OS: "9105", CodigoSerialOS: 9105, Tipo: "Preventiva", TipoDeManutencao: "Preventiva", Tag: "ZZ-PREV", Equipamento: "Bomba ZZPREV", Abertura: "05/03/2026 08:00" }),
    osBase({ OS: "9106", CodigoSerialOS: 9106, Tipo: "TSE", TipoDeManutencao: "Segurança Elétrica", Tag: "ZZ-TSE", Equipamento: "Bomba ZZTSE", Abertura: "06/03/2026 08:00" }),
    osBase({ OS: "9107", CodigoSerialOS: 9107, Tipo: "Calibração", TipoDeManutencao: "Calibração", Tag: "ZZ-CAL", Equipamento: "Bomba ZZCAL", Abertura: "07/03/2026 08:00" }),
    osBase({ OS: "9108", CodigoSerialOS: 9108, Oficina: "REFRIGERAÇÃO", TipoDeManutencao: "Compra", Tag: "ZZ-REFRI", Equipamento: "Evaporadora ZZ", Abertura: "08/03/2026 08:00" }),
    osBase({ OS: "9201", CodigoSerialOS: 9201, Setor: AMB, TipoDeManutencao: "Corretiva", Tag: "ZZ-AMB", Equipamento: "Bomba ZZAMB", Abertura: "01/03/2026 09:00" }),
    osBase({ OS: "9301", CodigoSerialOS: 9301, Setor: "SETOR SO OS ZZ", TipoDeManutencao: "Corretiva", Tag: "ZZ-SOOS", Equipamento: "Bomba ZZSOOS" }),
  ]);
  gravar("equipamentos", [
    { Tag: "ZZ-02932", Equipamento: "Bomba ZZ2932", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-PARQUE", Equipamento: "Mesa ZZPARQUE", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-CORR", Equipamento: "Bomba ZZCORR", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-COMPRA", Equipamento: "Monitor ZZCOMPRA", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-EXT", Equipamento: "Foco ZZEXT", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-CAL", Equipamento: "Bomba ZZCAL", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-AMB", Equipamento: "Bomba ZZAMB", Setor: AMB, Modelo: "", Fabricante: "", Patrimonio: "" },
  ]);
  gravar("cronograma", [
    plano({
      Tag: "ZZ02932",
      Equipamento: "Bomba ZZ2932",
      TipoDeManutencao: "A - MANUTENÇÃO DE EQUIPAMENTOS",
      PlanoDeManutencao: "MONITOR MULTIPARAMETRO SEMESTRAL ZZ",
      ProximaRealizacao: "209909735",
      Perioridicade: "6 Mês(Es)",
    }),
    plano({
      Tag: "ZZ-02932",
      TipoDeManutencao: "A - SEGURANÇA ELÉTRICA",
      PlanoDeManutencao: "TSE ZZ",
      DataDaUltima: "01/02/2026",
      ProximaRealizacao: "15/08/2026",
      Perioridicade: "Anual",
    }),
    plano({
      Tag: "ZZ-02932",
      TipoDeManutencao: "A - CALIBRAÇÃO DE EQUIPAMENTOS MÉDICOS",
      PlanoDeManutencao: "CALIBRAÇÃO ZZ",
      DataDaUltima: "10/01/2026",
      ProximaRealizacao: "15/06/2026",
    }),
    plano({
      Tag: "ZZ-CAL",
      Equipamento: "Bomba ZZCAL",
      TipoDeManutencao: "Calibração",
      ProximaRealizacao: "15/06/2026",
    }),
    plano({ Tag: "ZZ-AMB", Equipamento: "Bomba ZZAMB", Setor: AMB, TipoDeManutencao: "Calibração", ProximaRealizacao: "15/04/2026" }),
  ]);

  const fichaCc = (await (await usuario.GET(pedido("/api/bot/v1/usuario", TEL_CC))).json()) as { setor: string };
  assert.equal(fichaCc.setor, NOME_CC);

  const abertas = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&tipo=corretiva", TEL_CC))).json()) as {
    itens: Array<{ numero: string; tag: string }>;
    resumo: { total: number; corretivas: number };
  };
  assert.deepEqual(abertas.itens.map((item) => item.numero).sort(), ["9101", "9102", "9103", "9104"]);
  assert.equal(abertas.resumo.total, 4);
  assert.equal(abertas.resumo.corretivas, 4);
  assert.equal(JSON.stringify(abertas).includes("9105"), false);
  assert.equal(JSON.stringify(abertas).includes("9108"), false);
  assert.equal(JSON.stringify(abertas).includes("9201"), false);

  const vista = (await (
    await porSetor.GET(pedido(`/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva&setor=${encodeURIComponent(SETOR)}`, TEL_GEST))
  ).json()) as { total: number; setores: Array<{ setor: string; quantidade: number; porEtapa: Array<{ os: Array<{ numero: string; tag: string }> }> }> };
  assert.equal(vista.total, 4);
  assert.equal(vista.setores[0]?.setor, SETOR);
  const numeros = vista.setores.flatMap((setor) => setor.porEtapa.flatMap((etapa) => etapa.os.map((os) => os.numero))).sort();
  assert.deepEqual(numeros, ["9101", "9102", "9103", "9104"]);
  assert.equal(JSON.stringify(vista).includes("9105"), false);

  const nomes = await porSetor.GET(pedido("/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva&setor=Centro%20Cir%C3%BArgico", TEL_GEST));
  assert.equal(nomes.status, 200);
  const jsonNomes = (await nomes.json()) as { status: string; candidatos: Array<{ setor: string }> };
  assert.equal(jsonNomes.status, "ambiguo");
  assert.deepEqual(
    jsonNomes.candidatos.map((item) => item.setor),
    [SETOR, AMB],
  );
  const apelido = await porSetor.GET(pedido("/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva&setor=cc", TEL_GEST));
  const jsonApelido = (await apelido.json()) as { status: string; candidatos: Array<{ setor: string }> };
  assert.equal(jsonApelido.status, "ambiguo");
  assert.deepEqual(
    jsonApelido.candidatos.map((item) => item.setor),
    [SETOR, AMB],
  );

  const planoSetor = (await (await cronograma.GET(pedido("/api/bot/v1/cronograma", TEL_CC))).json()) as {
    ok: boolean;
    setor: string;
    equipamentos: Array<{
      tag: string;
      preventiva: { ultima: string | null; proxima: string | null };
      tse: { ultima: string | null; proxima: string | null };
      calibracao: { ultima: string | null; proxima: string | null };
    }>;
  };
  assert.equal(planoSetor.ok, true);
  assert.equal(planoSetor.setor, NOME_CC);
  const tags = planoSetor.equipamentos.map((item) => item.tag).sort();
  assert.equal(tags.includes("ZZ-PARQUE"), true);
  assert.equal(tags.includes("ZZ-02932"), true);
  assert.equal(tags.includes("ZZ-AMB"), false);
  const bomba = planoSetor.equipamentos.find((item) => item.tag === "ZZ-02932");
  assert.ok(bomba);
  assert.equal(bomba.preventiva.ultima, null);
  assert.match(bomba.preventiva.proxima ?? "", /^(03\/2027|09\/2099|\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{4})$/);
  assert.notEqual(bomba.preventiva.proxima, null);
  assert.equal(bomba.tse.ultima, "01/02/2026");
  assert.notEqual(bomba.tse.proxima, null);
  assert.equal(bomba.calibracao.ultima, "10/01/2026");
  assert.equal(bomba.calibracao.proxima, "15/06/2026");
  assert.equal(JSON.stringify(planoSetor).includes("ZZOBS"), false);

  const ficha = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-02932", TEL_CC), {
    params: Promise.resolve({ tag: "ZZ-02932" }),
  });
  assert.equal(ficha.status, 200);
  const jsonFicha = (await ficha.json()) as {
    preventiva: { proxima: string | null };
    tse: { proxima: string | null };
    calibracao: { proxima: string | null };
    proximaPreventiva: { mes: string; plano: string } | null;
  };
  assert.notEqual(jsonFicha.preventiva.proxima, null);
  assert.notEqual(jsonFicha.tse.proxima, null);
  assert.equal(jsonFicha.calibracao.proxima, "15/06/2026");
  assert.notEqual(jsonFicha.proximaPreventiva, null);
  assert.match(jsonFicha.proximaPreventiva?.mes ?? "", /^\d{4}-\d{2}$/);

  const calib = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?ano=2026", TEL_CC))).json()) as {
    status: string;
    setor: string;
    meses: Array<{ mes: string }>;
    equipamentos: Array<{ tag: string; proxima: string | null }>;
  };
  assert.equal(calib.status, "ok");
  assert.equal(calib.setor, NOME_CC);
  assert.equal(calib.equipamentos.some((item) => item.tag === "ZZ-02932"), true);
  assert.equal(calib.equipamentos.some((item) => item.tag === "ZZ-CAL"), true);
  assert.equal(calib.equipamentos.some((item) => item.tag === "ZZ-AMB"), false);

  const exato = (await (
    await calibracao.GET(pedido(`/api/bot/v1/calibracao?setor=${encodeURIComponent(SETOR)}&ano=2026`, TEL_GEST))
  ).json()) as { status: string; equipamentos: Array<{ tag: string }> };
  assert.equal(exato.status, "ok");
  assert.equal(exato.equipamentos.some((item) => item.tag === "ZZ-CAL"), true);

  const soOs = await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=SETOR%20SO%20OS%20ZZ&ano=2026", TEL_GEST));
  assert.equal(soOs.status, 200);
  const jsonSoOs = (await soOs.json()) as { status: string; meses: unknown[]; equipamentos: unknown[] };
  assert.equal(jsonSoOs.status, "ok");
  assert.deepEqual(jsonSoOs.meses, []);
  assert.deepEqual(jsonSoOs.equipamentos, []);
});

test("vínculo casa OS por código no fim e por nome normalizado; texto livre não filtra", async () => {
  const id = pessoa(TEL_ENDO, "Chefia de Enfermagem");
  getDb().prepare("UPDATE bot_usuario SET setor = ? WHERE id = ?").run("SETOR LIVRE ZZ", id);
  vincular(id, "67", "ENDOSCOPIA TERCEIRIZADA");
  const cc = pessoa(TEL_CC, "Chefia de Enfermagem");
  vincular(cc, COD_CC, NOME_CC);
  gravar("os-analitico", [
    osBase({
      OS: "6701",
      CodigoSerialOS: 6701,
      Setor: "ENDOSCOPIA ZZ",
      SetorCodigo: "67",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-ENDO",
      Equipamento: "Endoscopio ZZ",
    }),
    osBase({
      OS: "6702",
      CodigoSerialOS: 6702,
      Setor: "endoscopia   terceirizada",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-ENDO2",
      Equipamento: "Endoscopio ZZ2",
    }),
    osBase({
      OS: "6703",
      CodigoSerialOS: 6703,
      Setor: "67 - ENDOSCOPIA ZZ",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-ENDO3",
      Equipamento: "Endoscopio ZZ3",
    }),
    osBase({
      OS: "6704",
      CodigoSerialOS: 6704,
      Setor: "RAIO-X ZZ",
      SetorCodigo: "30",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-RAIO",
      Equipamento: "Raio ZZ",
    }),
    osBase({
      OS: "6705",
      CodigoSerialOS: 6705,
      Setor: "ENDOSCOPIA TERCEIRIZADA",
      SetorCodigo: "99",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-OUTRO",
      Equipamento: "Outro ZZ",
    }),
    osBase({
      OS: "6706",
      CodigoSerialOS: 6706,
      Setor: "ENDOSCOPIA TERCEIRIZADA - 67",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-ENDO67",
      Equipamento: "Endoscopio ZZ67",
    }),
    osBase({
      OS: "6707",
      CodigoSerialOS: 6707,
      Setor: "OUTRO ZZ - 670",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-670",
      Equipamento: "Outro ZZ670",
    }),
    osBase({
      OS: "6708",
      CodigoSerialOS: 6708,
      Setor: "OUTRO ZZ - 167",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-167",
      Equipamento: "Outro ZZ167",
    }),
    osBase({
      OS: "1001",
      CodigoSerialOS: 1001,
      Setor: SETOR,
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-10A",
      Equipamento: "Bomba ZZ10A",
    }),
    osBase({
      OS: "1002",
      CodigoSerialOS: 1002,
      Setor: "CENTRO CIRÚRGICO - 10AB",
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-10AB",
      Equipamento: "Bomba ZZ10AB",
    }),
    osBase({
      OS: "1003",
      CodigoSerialOS: 1003,
      Setor: AMB,
      TipoDeManutencao: "Corretiva",
      Tag: "ZZ-97",
      Equipamento: "Bomba ZZ97",
    }),
  ]);
  gravar("equipamentos", [
    { Tag: "ZZ-ENDO", Equipamento: "Endoscopio ZZ", Setor: "ENDOSCOPIA ZZ", SetorCodigo: "67", Modelo: "", Fabricante: "", Patrimonio: "" },
  ]);

  const fichaUsuario = (await (await usuario.GET(pedido("/api/bot/v1/usuario", TEL_ENDO))).json()) as { setor: string | null };
  assert.equal(fichaUsuario.setor, "ENDOSCOPIA TERCEIRIZADA");

  const abertas = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", TEL_ENDO));
  assert.equal(abertas.status, 200);
  const json = (await abertas.json()) as { ok: boolean; total?: number; itens: Array<{ numero: string }> };
  assert.equal(json.ok, true);
  assert.deepEqual(json.itens.map((item) => item.numero).sort(), ["6701", "6702", "6703", "6706"]);

  const doCc = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", TEL_CC));
  const jsonCc = (await doCc.json()) as { itens: Array<{ numero: string }> };
  assert.deepEqual(jsonCc.itens.map((item) => item.numero), ["1001"]);

  const ficha = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-ENDO", TEL_ENDO), {
    params: Promise.resolve({ tag: "ZZ-ENDO" }),
  });
  assert.equal(ficha.status, 200);

  const livre = pessoa(TEL_LIVRE, "Chefia de Enfermagem");
  getDb().prepare("UPDATE bot_usuario SET setor = ? WHERE id = ?").run("ENDOSCOPIA TERCEIRIZADA ZZ", livre);
  const semVinculo = await osLista.GET(pedido("/api/bot/v1/os?abertas=1", TEL_LIVRE));
  const jsonLivre = (await semVinculo.json()) as { status: string; itens?: unknown };
  assert.equal(jsonLivre.status, "setor_nao_cadastrado");
  assert.equal(Object.hasOwn(jsonLivre, "itens"), false);
});

test("ficha acha equipamento que só existe no parque", async () => {
  const cc = pessoa(TEL_CC, "Chefia de Enfermagem");
  vincular(cc, COD_CC, NOME_CC);
  gravar("os-analitico", [
    osBase({ OS: "9108", CodigoSerialOS: 9108, Oficina: "REFRIGERAÇÃO", TipoDeManutencao: "Compra", Tag: "ZZ-REFRI", Equipamento: "Evaporadora ZZ" }),
  ]);
  gravar("equipamentos", [
    { Tag: "ZZ-PARQUE", Equipamento: "Mesa ZZPARQUE", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-FORA", Equipamento: "Mesa ZZFORA", Setor: AMB, Modelo: "", Fabricante: "", Patrimonio: "" },
  ]);
  gravar("cronograma", []);
  const ficha = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-PARQUE", TEL_CC), {
    params: Promise.resolve({ tag: "ZZ-PARQUE" }),
  });
  assert.equal(ficha.status, 200);
  const json = (await ficha.json()) as { preventiva: { proxima: string | null }; equipamento: { tag: string } };
  assert.equal(json.equipamento.tag, "ZZ-PARQUE");
  assert.equal(json.preventiva.proxima, null);
  const fora = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-FORA", TEL_CC), {
    params: Promise.resolve({ tag: "ZZ-FORA" }),
  });
  assert.equal(fora.status, 404);
  const refri = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-REFRI", TEL_CC), {
    params: Promise.resolve({ tag: "ZZ-REFRI" }),
  });
  assert.equal(refri.status, 404);
});

test("filtro de tag da OS ignora hífen e zero à esquerda, como a ficha", async () => {
  pessoa(TEL_GEST, "Manutenção");
  gravar("os-analitico", [
    osBase({ OS: "801", CodigoSerialOS: 801, Tag: "HSJ-02932", TipoDeManutencao: "Corretiva", Equipamento: "Bomba ZZ801" }),
    osBase({ OS: "802", CodigoSerialOS: 802, Tag: "HSJ-29320", TipoDeManutencao: "Corretiva", Equipamento: "Bomba ZZ802" }),
  ]);
  const semHifen = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&tag=HSJ02932", TEL_GEST))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(semHifen.itens.map((item) => item.numero), ["801"]);
  const zero = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&tag=HSJ-2932", TEL_GEST))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(zero.itens.map((item) => item.numero), ["801"]);
});

test("compras com vínculo 10A não recebe OS do Ambulatorial nem da Farmácia", async () => {
  const compras = pessoa(TEL_COMPRAS, "Compras");
  vincular(compras, COD_CC, NOME_CC);
  pessoa(TEL_GEST, "Manutenção");
  gravar("os-analitico", [
    osBase({ OS: "501", CodigoSerialOS: 501, TipoDeManutencao: "Corretiva", Tag: "ZZ-501", Equipamento: "Bomba ZZ501" }),
    osBase({ OS: "506", CodigoSerialOS: 506, Setor: AMB, TipoDeManutencao: "Corretiva", Tag: "ZZ-506", Equipamento: "Bomba ZZ506" }),
    osBase({ OS: "507", CodigoSerialOS: 507, Setor: FARMACIA, TipoDeManutencao: "Corretiva", Tag: "ZZ-507", Equipamento: "Bomba ZZ507" }),
  ]);
  gravar("equipamentos", [
    { Tag: "ZZ-501", Equipamento: "Bomba ZZ501", Setor: SETOR, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-506", Equipamento: "Bomba ZZ506", Setor: AMB, Modelo: "", Fabricante: "", Patrimonio: "" },
    { Tag: "ZZ-507", Equipamento: "Bomba ZZ507", Setor: FARMACIA, Modelo: "", Fabricante: "", Patrimonio: "" },
  ]);
  gravar("cronograma", [
    plano({ Tag: "ZZ-501", Equipamento: "Bomba ZZ501", TipoDeManutencao: "Calibração", ProximaRealizacao: "15/06/2027" }),
    plano({ Tag: "ZZ-506", Equipamento: "Bomba ZZ506", Setor: AMB, TipoDeManutencao: "Calibração", ProximaRealizacao: "15/06/2027" }),
    plano({ Tag: "ZZ-507", Equipamento: "Bomba ZZ507", Setor: FARMACIA, TipoDeManutencao: "Calibração", ProximaRealizacao: "15/06/2027" }),
  ]);

  const abertas = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1", TEL_COMPRAS))).json()) as {
    itens: Array<{ numero: string }>;
  };
  assert.deepEqual(abertas.itens.map((item) => item.numero), ["501"]);

  const busca = (await (await osLista.GET(pedido("/api/bot/v1/os?abertas=1&setor=Centro%20Cir%C3%BArgico", TEL_COMPRAS))).json()) as {
    ok: boolean;
    status?: string;
    itens: Array<{ numero: string }>;
  };
  assert.equal(busca.ok, true);
  assert.equal(busca.status, undefined);
  assert.deepEqual(busca.itens.map((item) => item.numero), ["501"]);

  const planoCompras = (await (
    await cronograma.GET(pedido("/api/bot/v1/cronograma?setor=Centro%20Cir%C3%BArgico", TEL_COMPRAS))
  ).json()) as { ok: boolean; equipamentos: Array<{ tag: string }> };
  assert.equal(planoCompras.ok, true);
  assert.deepEqual(planoCompras.equipamentos.map((item) => item.tag).sort(), ["ZZ-501"]);

  const calib = (await (await calibracao.GET(pedido("/api/bot/v1/calibracao?setor=Centro%20Cir%C3%BArgico&ano=2027", TEL_COMPRAS))).json()) as {
    status: string;
    equipamentos: Array<{ tag: string }>;
  };
  assert.equal(calib.status, "ok");
  assert.deepEqual(calib.equipamentos.map((item) => item.tag), ["ZZ-501"]);

  const fichaVizinha = await equipamento.GET(pedido("/api/bot/v1/equipamentos/ZZ-506", TEL_COMPRAS), {
    params: Promise.resolve({ tag: "ZZ-506" }),
  });
  assert.equal(fichaVizinha.status, 404);

  const gestao = (await (
    await porSetor.GET(pedido("/api/bot/v1/os/por-setor?abertas=1&tipo=corretiva&setor=Centro%20Cir%C3%BArgico", TEL_GEST))
  ).json()) as { status: string; candidatos: Array<{ setor: string }> };
  assert.equal(gestao.status, "ambiguo");
  assert.deepEqual(gestao.candidatos.map((item) => item.setor).sort(), [AMB, FARMACIA, SETOR].sort());
});
