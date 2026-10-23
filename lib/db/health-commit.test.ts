import test from "node:test";
import assert from "node:assert/strict";
import * as health from "../../app/api/v1/health/route";

test("health mostra o commit curto quando RAILWAY_GIT_COMMIT_SHA existe", async () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = "289817fabcdef0123456789abcdef0123456789a";
  const j = await (await health.GET(new Request("http://local/api/v1/health"))).json();
  assert.equal(j.commit, "289817f");
});

test("health devolve commit null sem variável ou com valor inválido", async () => {
  const ler = async () => (await (await health.GET(new Request("http://local/api/v1/health"))).json()).commit;
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  assert.equal(await ler(), null);
  process.env.RAILWAY_GIT_COMMIT_SHA = "não-é-sha";
  assert.equal(await ler(), null);
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
});
