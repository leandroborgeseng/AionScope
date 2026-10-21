import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import Database from "better-sqlite3";

const dir = mkdtempSync(path.join(os.tmpdir(), "pbi-cache-"));
process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
for (const t of ["OS_ANALITICO", "OS_ANALITICO_RESUMIDO", "EQUIPAMENTOS", "MONITOR_REACAO", "MONITOR_ATENDIMENTO", "CRONOGRAMA", "TIPO_MANUTENCAO", "TMEF", "TPM", "DISP_EQUIPAMENTO_MES", "ANEXOS_EQUIPAMENTO", "ANEXOS_OS"]) process.env[`PBI_TOKEN_${t}`] = "tok-test";
process.env.PBI_BASE_URL = "http://gt.invalid";

import { closeDbForTests, getDb } from "@/lib/db/client";
import { aplicarMigration012PbiCache } from "@/lib/db/migrations/012_pbi_cache";
import { SCHEMA_SQL } from "@/lib/db/schema";
import { __setClockForTests, __setFetchForTests, fetchPbi, invalidarCachePbi, isRefreshing, cacheKeyFor } from "./client";
import { cacheAgeBand, formatCacheDateBRT, DAY_MS, HOUR_MS, MIN_MS, OS_RESOURCES, SCHEDULED_RESOURCES } from "./cache-policy";
import { resumirFreshness } from "./freshness";
import { defaultScheduledQueries, runSchedulerTick } from "./scheduler";

let now = Date.parse("2026-10-20T12:00:00Z");
__setClockForTests(() => now);

type Mode = { kind: "ok"; data: unknown } | { kind: "status"; status: number } | { kind: "network" };
let mode: Mode = { kind: "ok", data: [{ OS: "1" }] };
let calls: string[] = [];
let gate: Promise<void> | null = null;
__setFetchForTests((async (url: string | URL | Request, init?: RequestInit) => {
  calls.push(String(url));
  const headers = init?.headers as Record<string, string>;
  assert.ok(Object.values(headers).includes("tok-test"));
  if (gate) await gate;
  if (mode.kind === "network") throw new TypeError("fetch failed");
  if (mode.kind === "status") return new Response(JSON.stringify({ Message: `erro ${mode.status}` }), { status: mode.status });
  return new Response(JSON.stringify(mode.data), { status: 200 });
}) as typeof fetch);

const P = new URLSearchParams({ periodo: "AnoAtual" });
const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  getDb().exec("DELETE FROM pbi_cache");
  invalidarCachePbi();
  calls = [];
  gate = null;
  mode = { kind: "ok", data: [{ OS: "1" }] };
  now = Date.parse("2026-10-20T12:00:00Z");
});
after(() => {
  closeDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

async function semearCopia(resource: "os-analitico" | "equipamentos", idadeMs: number, data: unknown = [{ OS: "1" }]) {
  const t = now;
  now = t - idadeMs;
  mode = { kind: "ok", data };
  const r = await fetchPbi(resource, P);
  assert.equal(r.ok, true);
  now = t;
  calls = [];
}

test("migração 012: aditiva e idempotente, não guarda token", async () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  aplicarMigration012PbiCache(db);
  aplicarMigration012PbiCache(db);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE id = 12").get() as { n: number }).n, 1);
  db.close();
  await semearCopia("os-analitico", 0);
  const rows = getDb().prepare("SELECT * FROM pbi_cache").all();
  assert.ok(!JSON.stringify(rows).includes("tok-test"));
});

test("sem cópia e API ok: busca, grava e devolve com data", async () => {
  const r = await fetchPbi("os-analitico", P);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(r.cache?.refreshing, false);
  assert.equal(r.cache?.fetchedAt, new Date(now).toISOString());
});

test("cópia fresca (< 2 min, OS): servida sem chamar a GlobalThings (K2)", async () => {
  await semearCopia("os-analitico", 60_000);
  const r = await fetchPbi("os-analitico", P);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 0);
  assert.equal(r.cache?.refreshing, false);
});

test("abertura com cópia > 2 min (OS): serve a cópia na hora e atualiza em segundo plano; troca os dados", async () => {
  await semearCopia("os-analitico", 3 * MIN_MS, [{ OS: "velha" }]);
  let release!: () => void;
  gate = new Promise((r) => (release = r));
  mode = { kind: "ok", data: [{ OS: "nova" }] };
  const r = await fetchPbi<Array<{ OS: string }>>("os-analitico", P);
  assert.equal(r.ok && r.data[0].OS, "velha");
  assert.equal(r.cache?.refreshing, true);
  release();
  await flush();
  const r2 = await fetchPbi<Array<{ OS: string }>>("os-analitico", P);
  assert.equal(r2.ok && r2.data[0].OS, "nova");
  assert.equal(r2.cache?.refreshing, false);
  assert.equal(r2.cachedAt, new Date(now).toISOString());
});

test("cadastros: abertura com cópia de 59 min não busca; > 1 h busca", async () => {
  await semearCopia("equipamentos", 59 * MIN_MS);
  await fetchPbi("equipamentos", P);
  assert.equal(calls.length, 0);
  now += 2 * MIN_MS;
  await fetchPbi("equipamentos", P);
  await flush();
  assert.equal(calls.length, 1);
});

test("falha com cópia (rede e 5xx): continua com a cópia, sem piscar erro (K1/K10)", async () => {
  for (const m of [{ kind: "network" } as Mode, { kind: "status", status: 503 } as Mode]) {
    getDb().exec("DELETE FROM pbi_cache");
    invalidarCachePbi();
    await semearCopia("os-analitico", 3 * HOUR_MS);
    mode = m;
    const r = await fetchPbi("os-analitico", P);
    assert.equal(r.ok, true);
    await flush();
    const r2 = await fetchPbi("os-analitico", P);
    assert.equal(r2.ok, true);
    assert.equal(r2.cache?.refreshing, false);
    assert.ok(r2.cache?.lastErrorAt);
    assert.equal(r2.cache?.tokenError, false);
    assert.equal(cacheAgeBand(Date.parse(r2.cache!.fetchedAt), now), "normal");
  }
});

test("falha sem cópia: erro (custos avulsos indisponíveis na tela) (K4)", async () => {
  mode = { kind: "network" };
  const r = await fetchPbi("os-analitico", P);
  assert.equal(r.ok, false);
  mode = { kind: "status", status: 500 };
  now += 2 * MIN_MS;
  const r2 = await fetchPbi("os-analitico", P);
  assert.equal(r2.ok, false);
});

test("cópia entre 24 h e 7 dias + falha: mantém dados, faixa âmbar 'desatualizado'", async () => {
  await semearCopia("os-analitico", 3 * DAY_MS);
  mode = { kind: "network" };
  await fetchPbi("os-analitico", P);
  await flush();
  const r = await fetchPbi("os-analitico", P);
  assert.equal(r.ok, true);
  assert.equal(cacheAgeBand(Date.parse(r.cache!.fetchedAt), now), "desatualizado");
  assert.equal(cacheAgeBand(now - 24 * HOUR_MS, now), "normal");
  assert.equal(cacheAgeBand(now - 24 * HOUR_MS - 1, now), "desatualizado");
});

test("cópia > 7 dias: abre com a cópia e 'Atualizando'; se a atualização falha, indisponível (K5)", async () => {
  await semearCopia("os-analitico", 8 * DAY_MS);
  let release!: () => void;
  gate = new Promise((r) => (release = r));
  mode = { kind: "network" };
  const r = await fetchPbi("os-analitico", P);
  assert.equal(r.ok, true);
  assert.equal(r.cache?.refreshing, true);
  release();
  await flush();
  const r2 = await fetchPbi("os-analitico", P);
  assert.equal(r2.ok, false);
  assert.equal(cacheAgeBand(now - 8 * DAY_MS, now), "expirado");
});

test("cópia > 7 dias e atualização ok: troca para o dado novo", async () => {
  await semearCopia("os-analitico", 8 * DAY_MS);
  mode = { kind: "ok", data: [{ OS: "nova" }] };
  await fetchPbi("os-analitico", P);
  await flush();
  const r = await fetchPbi<Array<{ OS: string }>>("os-analitico", P);
  assert.equal(r.ok && r.data[0].OS, "nova");
});

test("401/403: continua com a cópia e marca tokenError (aviso vermelho)", async () => {
  for (const status of [401, 403]) {
    getDb().exec("DELETE FROM pbi_cache");
    invalidarCachePbi();
    await semearCopia("os-analitico", 10 * MIN_MS);
    mode = { kind: "status", status };
    await fetchPbi("os-analitico", P);
    await flush();
    const r = await fetchPbi("os-analitico", P);
    assert.equal(r.ok, true);
    assert.equal(r.cache?.tokenError, true);
    assert.equal(r.cache?.lastErrorStatus, status);
    const f = resumirFreshness([r]);
    assert.equal(f.tokenError, true);
    assert.equal(f.tokenStatus, status);
  }
});

test("single-flight: várias aberturas simultâneas fazem uma única busca (K12)", async () => {
  let release!: () => void;
  gate = new Promise((r) => (release = r));
  const all = Promise.all(Array.from({ length: 5 }, () => fetchPbi("os-analitico", P)));
  await flush();
  assert.equal(calls.length, 1);
  release();
  const rs = await all;
  assert.ok(rs.every((r) => r.ok));
  assert.equal(calls.length, 1);
  // com cópia velha: 5 aberturas, 1 busca em segundo plano
  now += 10 * MIN_MS;
  calls = [];
  gate = new Promise((r) => (release = r));
  await Promise.all(Array.from({ length: 5 }, () => fetchPbi("os-analitico", P)));
  assert.equal(calls.length, 1);
  assert.equal(isRefreshing(cacheKeyFor("os-analitico", P).key), true);
  release();
  await flush();
});

const recursoDe = (key: string) => key.slice(0, key.indexOf(":"));
const T0 = Date.parse("2026-10-20T12:00:00Z");

test("agendador: recursos nunca abertos são renovados (lista explícita SCHEDULED_RESOURCES)", async () => {
  const feitos = await runSchedulerTick();
  const recursos = new Set(feitos.map(recursoDe));
  for (const r of SCHEDULED_RESOURCES) assert.ok(recursos.has(r), `faltou ${r}`);
  assert.equal(feitos.length, defaultScheduledQueries().length);
  const r = await fetchPbi("equipamentos", defaultScheduledQueries().find((q) => q.resource === "equipamentos")!.params);
  assert.equal(r.ok, true);
  assert.equal(calls.length, feitos.length); // a abertura usou a cópia renovada, sem nova busca
});

test("agendador: consulta sem acesso há 40 dias continua sendo renovada", async () => {
  await semearCopia("equipamentos", 0);
  const key = cacheKeyFor("equipamentos", P).key;
  getDb().prepare("UPDATE pbi_cache SET last_access_at = ? WHERE cache_key = ?").run(now - 40 * DAY_MS, key);
  await runSchedulerTick(); // prepara as consultas padrão
  now += 61 * MIN_MS;
  const feitos = await runSchedulerTick();
  assert.ok(feitos.includes(key));
});

test("agendador: OS não renova antes de 5 min; renova aos 5 min, sem acesso", async () => {
  await runSchedulerTick();
  now = T0 + 4 * MIN_MS + 59_000;
  assert.deepEqual(await runSchedulerTick(), []);
  now = T0 + 5 * MIN_MS;
  const feitos = await runSchedulerTick();
  assert.ok(feitos.length > 0);
  assert.ok(feitos.every((k) => OS_RESOURCES.has(recursoDe(k) as never)));
  for (const r of OS_RESOURCES) assert.ok(feitos.some((k) => recursoDe(k) === r));
  assert.deepEqual(await runSchedulerTick(), []);
});

test("agendador: cadastros não renovam antes de 60 min", async () => {
  await runSchedulerTick();
  for (const m of [5, 30, 59]) {
    now = T0 + m * MIN_MS;
    const feitos = await runSchedulerTick();
    assert.ok(feitos.every((k) => OS_RESOURCES.has(recursoDe(k) as never)), `cadastro renovado aos ${m} min`);
  }
  now = T0 + 60 * MIN_MS;
  const feitos = await runSchedulerTick();
  for (const r of SCHEDULED_RESOURCES.filter((x) => !OS_RESOURCES.has(x))) assert.ok(feitos.some((k) => recursoDe(k) === r), `faltou ${r} aos 60 min`);
});

test("agendador: uma busca por vez (serial), e falha não apaga a cópia", async () => {
  await semearCopia("os-analitico", 0);
  now += 2 * HOUR_MS;
  let ativas = 0;
  let max = 0;
  __setFetchForTests((async () => {
    ativas++;
    max = Math.max(max, ativas);
    await new Promise((r) => setTimeout(r, 2));
    ativas--;
    throw new TypeError("fetch failed");
  }) as typeof fetch);
  try {
    const [a, b] = await Promise.all([runSchedulerTick(), runSchedulerTick()]);
    assert.ok(a.length + b.length >= SCHEDULED_RESOURCES.length);
    assert.ok(a.length === 0 || b.length === 0);
    assert.equal(max, 1);
    const r = await fetchPbi("os-analitico", P);
    assert.equal(r.ok, true);
  } finally {
    __setFetchForTests((async (url: string | URL | Request) => {
      calls.push(String(url));
      if (mode.kind === "network") throw new TypeError("fetch failed");
      if (mode.kind === "status") return new Response("{}", { status: mode.status });
      return new Response(JSON.stringify(mode.data), { status: 200 });
    }) as typeof fetch);
  }
});

test("cópia corrompida é ignorada e sobrescrita na próxima busca (K7)", async () => {
  await semearCopia("os-analitico", 0);
  getDb().prepare("UPDATE pbi_cache SET payload = '{quebrado'").run();
  invalidarCachePbi();
  const r = await fetchPbi("os-analitico", P);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
});

test("data no formato dd/mm HH:MM (BRT)", () => {
  assert.equal(formatCacheDateBRT("2026-10-20T12:05:00Z"), "20/10 09:05");
});
