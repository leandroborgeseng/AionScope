import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import {
  _resetTreinamentosCache,
  carregarPainelTreinamentos,
  carregarParticipantes,
  estadoTreinamentos,
  semearTreinamentosSeFaltar,
} from "./load";
import * as health from "../../app/api/v1/health/route";
import * as resumo from "../../app/api/treinamentos/resumo/route";

// Fixture 100% fictícia (repo público): nomes "Pessoa Demo N", matrículas 9000N, setores "SETOR DEMO".
const NOMES = ["Pessoa Demo Um", "Pessoa Demo Dois", "Pessoa Demo Tres"];
function fixture(ano: number) {
  return NOMES.map((nome, i) => ({
    ano, nome, matricula: `9000${i}`, setor: i === 2 ? "SETOR DEMO B" : "SETOR DEMO A", setor_original: "SETOR DEMO",
    data_treinamento: `${ano}-03-0${i + 1}`, periodo_original: "MANHÃ", carga_min: 60, carga_estimada: false,
    instrutor: "Instrutor Demo", equipamento: "BOMBA DEMO", fonte: "fixture", reciclagem: ano === 2026 ? i === 0 : null,
    vinculo_2025: null, leitura_incerta: false,
  }));
}

let dir = "";
let semente = "";
let volume = "";
const envAntes = { ...process.env };
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-trein-load-"));
});
after(() => {
  process.env = envAntes;
  _resetTreinamentosCache();
  rmSync(dir, { recursive: true, force: true });
});
let n = 0;
beforeEach(() => {
  n++;
  semente = path.join(dir, `semente-${n}`);
  volume = path.join(dir, `volume-${n}`);
  mkdirSync(semente, { recursive: true });
  writeFileSync(path.join(semente, "treinamentos.json"), JSON.stringify([...fixture(2025), ...fixture(2026)]));
  writeFileSync(path.join(semente, "kpis.json"), JSON.stringify({ atualizado_em: "2026-10-01" }));
  writeFileSync(path.join(semente, "treinamentos.csv"), "ano;nome\n2026;Pessoa Demo Um\n");
  process.env.TREINAMENTOS_SEED_PATH = semente;
  process.env.TREINAMENTOS_DATA_PATH = volume;
  process.env.DATABASE_PATH = path.join(dir, `db-${n}.sqlite`);
  _resetTreinamentosCache();
});

test("copia a semente para o volume quando falta e passa a ler do volume", () => {
  const r = semearTreinamentosSeFaltar();
  assert.deepEqual(r, { copiados: 3, mantidos: 0, erro: false });
  assert.deepEqual(readdirSync(volume).sort(), ["kpis.json", "treinamentos.csv", "treinamentos.json"]);
  assert.equal(carregarParticipantes().length, 6);
  assert.ok(carregarPainelTreinamentos());
  assert.deepEqual(estadoTreinamentos(), { linhas: 6, origem: "volume" });
});

test("não sobrescreve arquivo já existente no volume (copia só o que falta)", () => {
  mkdirSync(volume, { recursive: true });
  const doVolume = JSON.stringify(fixture(2026).slice(0, 1));
  writeFileSync(path.join(volume, "treinamentos.json"), doVolume);
  const r = semearTreinamentosSeFaltar();
  assert.deepEqual(r, { copiados: 2, mantidos: 1, erro: false });
  assert.equal(readFileSync(path.join(volume, "treinamentos.json"), "utf8"), doVolume, "volume mantido");
  assert.equal(carregarParticipantes().length, 1, "lê do volume, não do repo");
  // Segunda semeadura: nada muda.
  assert.deepEqual(semearTreinamentosSeFaltar(), { copiados: 0, mantidos: 3, erro: false });
});

test("lê do volume mesmo se a semente mudar depois (repo não é a fonte)", () => {
  semearTreinamentosSeFaltar();
  writeFileSync(path.join(semente, "treinamentos.json"), "[]");
  _resetTreinamentosCache();
  assert.equal(carregarParticipantes().length, 6);
});

test("sem volume nem semente: app sobe, painel null, resumo 503 com aviso, health ausente", async () => {
  process.env.TREINAMENTOS_SEED_PATH = path.join(dir, "nao-existe");
  process.env.TREINAMENTOS_DATA_PATH = path.join(dir, "nao-existe-volume");
  _resetTreinamentosCache();
  assert.deepEqual(carregarParticipantes(), []);
  assert.equal(carregarPainelTreinamentos(), null);
  assert.deepEqual(estadoTreinamentos(), { linhas: 0, origem: "ausente" });
  const r = await resumo.GET();
  assert.equal(r.status, 503);
  assert.match(((await r.json()) as { erro: string }).erro, /indisponíveis/);
  const h = (await (await health.GET(new Request("http://local/api/v1/health"))).json()) as { treinamentos?: unknown };
  assert.deepEqual(h.treinamentos, { linhas: 0, origem: "ausente" });
});

test("volume não gravável (caminho é um arquivo): não lança e reporta erro", () => {
  const arquivo = path.join(dir, `arquivo-${n}`);
  writeFileSync(arquivo, "x");
  process.env.TREINAMENTOS_DATA_PATH = path.join(arquivo, "treinamentos");
  _resetTreinamentosCache();
  assert.equal(semearTreinamentosSeFaltar().erro, true);
  assert.equal(carregarPainelTreinamentos(), null);
  assert.equal(existsSync(path.join(arquivo, "treinamentos")), false);
});

test("health expõe só treinamentos:{linhas, origem} — sem nomes, matrículas, setores nem caminhos", async () => {
  semearTreinamentosSeFaltar();
  for (const q of ["", "?persistencia=1"]) {
    const corpo = JSON.stringify(await (await health.GET(new Request(`http://local/api/v1/health${q}`))).json());
    const t = (JSON.parse(corpo) as { treinamentos: Record<string, unknown> }).treinamentos;
    assert.deepEqual(t, { linhas: 6, origem: "volume" }, q);
    for (const proibido of [...NOMES, "90000", "Instrutor Demo", "SETOR DEMO", volume, semente, "treinamentos.json", "/data/treinamentos"]) {
      assert.equal(corpo.includes(proibido), false, `${q} contém ${proibido}`);
    }
  }
});
