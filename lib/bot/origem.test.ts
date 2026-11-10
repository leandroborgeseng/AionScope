import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  MSG_ORIGEM_NEGADA,
  ORIGENS_PERMITIDAS_ENV,
  canonizarOrigem,
  exigirOrigemPermitida,
  origemDaRequisicao,
  origensPermitidas,
  textoAvisoOrigens,
} from "./origem";

const envAntes = process.env[ORIGENS_PERMITIDAS_ENV];

afterEach(() => {
  if (envAntes === undefined) delete process.env[ORIGENS_PERMITIDAS_ENV];
  else process.env[ORIGENS_PERMITIDAS_ENV] = envAntes;
});

function pedido(headers: Record<string, string>) {
  return new Request("https://painel.exemplo.test/api/cadastros/bot-usuarios", { headers });
}

test("origem compara o tuple exato e ignora caminho", () => {
  assert.equal(canonizarOrigem("https://painel.exemplo.test/admin/bot-usuarios"), "https://painel.exemplo.test");
  assert.equal(canonizarOrigem("https://painel.exemplo.test/"), "https://painel.exemplo.test");
  assert.equal(canonizarOrigem("https://hef.aion.eng.br"), "https://hef.aion.eng.br");
  assert.notEqual(canonizarOrigem("https://hef.aion.eng.br"), canonizarOrigem("https://painel.exemplo.test"));
  assert.equal(canonizarOrigem("null"), null);
  assert.equal(canonizarOrigem("nota-url"), null);
});

test("lista vem só do env, sem host embutido", () => {
  delete process.env[ORIGENS_PERMITIDAS_ENV];
  assert.equal(origensPermitidas().size, 0);
  process.env[ORIGENS_PERMITIDAS_ENV] = "https://painel.exemplo.test/, https://outro.exemplo.test";
  assert.deepEqual([...origensPermitidas()], ["https://painel.exemplo.test", "https://outro.exemplo.test"]);
  const fonte = readFileSync("lib/bot/origem.ts", "utf8");
  assert.equal(fonte.includes("aion.eng.br"), false);
  assert.equal(fonte.includes("railway.app"), false);
  assert.equal(fonte.includes("console."), false);
});

test("aviso de boot conta origens aceitas e descartadas sem revelar os valores", () => {
  process.env[ORIGENS_PERMITIDAS_ENV] = "https://painel.exemplo.test, https://outro.exemplo.test";
  assert.equal(textoAvisoOrigens(), "AIONSCOPE_ORIGENS_PERMITIDAS: 2 aceitas, 0 descartadas");
  process.env[ORIGENS_PERMITIDAS_ENV] = "https://painel.exemplo.test/admin,, ,https://outro.exemplo.test";
  assert.equal(textoAvisoOrigens(), "AIONSCOPE_ORIGENS_PERMITIDAS: 2 aceitas, 0 descartadas");
  process.env[ORIGENS_PERMITIDAS_ENV] = "scope.aion.eng.br;https://outra.test, https://painel.exemplo.test, *";
  const texto = textoAvisoOrigens();
  assert.equal(texto, "AIONSCOPE_ORIGENS_PERMITIDAS: 1 aceitas, 2 descartadas");
  assert.equal(texto.includes("scope"), false);
  assert.equal(texto.includes("painel"), false);
  assert.equal(texto.includes("https"), false);
  assert.equal(texto.includes("*"), false);
  const boot = readFileSync("instrumentation.ts", "utf8");
  assert.equal(boot.includes("console.warn(textoAvisoOrigens())"), true);
});

test("sem Origin usa Referer; Origin de outro host não passa nem com Referer certo", async () => {
  process.env[ORIGENS_PERMITIDAS_ENV] = "https://painel.exemplo.test";
  assert.equal(
    origemDaRequisicao(pedido({ referer: "https://painel.exemplo.test/admin/bot-usuarios" })),
    "https://painel.exemplo.test",
  );
  assert.equal(origemDaRequisicao(pedido({})), null);
  assert.equal(
    origemDaRequisicao(pedido({ origin: "https://hef.aion.eng.br", referer: "https://painel.exemplo.test/admin" })),
    "https://hef.aion.eng.br",
  );

  const certo = exigirOrigemPermitida(pedido({ origin: "https://painel.exemplo.test" }));
  assert.equal(certo, null);
  const ausente = exigirOrigemPermitida(pedido({}));
  const outro = exigirOrigemPermitida(pedido({ origin: "https://hef.aion.eng.br" }));
  assert.equal(ausente?.status, 403);
  assert.equal(outro?.status, 403);
  const textoAusente = await ausente?.text();
  const textoOutro = await outro?.text();
  assert.equal(textoAusente, JSON.stringify({ ok: false, message: MSG_ORIGEM_NEGADA }));
  assert.equal(textoOutro, JSON.stringify({ ok: false, message: MSG_ORIGEM_NEGADA }));
  assert.equal(textoOutro?.includes("hef.aion.eng.br"), false);
});
