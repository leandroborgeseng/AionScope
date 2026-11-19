import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { PAINEL_ORIGENS_ENV, origemPainelPermitida } from "./painel-origem";

const envAntes = process.env[PAINEL_ORIGENS_ENV];

afterEach(() => {
  if (envAntes === undefined) delete process.env[PAINEL_ORIGENS_ENV];
  else process.env[PAINEL_ORIGENS_ENV] = envAntes;
});

function pedido(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

const INTERNO = "http://aionscope:3000/api/v1/painel/login";

test("X-Forwarded-Host e X-Forwarded-Proto corretos aceitam a origem", () => {
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    true,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://SCOPE.AION.ENG.BR:443/login",
        "x-forwarded-host": " Scope.Aion.Eng.Br:443 ",
        "x-forwarded-proto": " HTTPS ",
      }),
    ),
    true,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "http://scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br:80",
        "x-forwarded-proto": "http",
      }),
    ),
    true,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        referer: "https://scope.aion.eng.br/login",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    true,
  );
});

test("X-Forwarded-Host com lista a, b usa o primeiro", () => {
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br, outro.exemplo.test",
        "x-forwarded-proto": "https, http",
      }),
    ),
    true,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://outro.exemplo.test",
        "x-forwarded-host": "scope.aion.eng.br, outro.exemplo.test",
        "x-forwarded-proto": "https",
      }),
    ),
    false,
  );
});

test("origem diferente continua rejeitada, inclusive sem Origin e sem Referer", () => {
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://evil.example",
        host: "scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    false,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    false,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "null",
        referer: "https://scope.aion.eng.br/login",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    false,
  );
});

test("Host interno com X-Forwarded-Host público é aceito", () => {
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://scope.aion.eng.br",
        host: "aionscope:3000",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    true,
  );
  assert.equal(
    origemPainelPermitida(
      pedido("http://0.0.0.0:3000/api/v1/painel/login", {
        origin: "https://scope.aion.eng.br",
        host: "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    true,
  );
});

test("lista AIONSCOPE_PAINEL_ORIGENS aceita a origem mesmo com host interno", () => {
  process.env[PAINEL_ORIGENS_ENV] = "https://outra.exemplo.test, https://scope.aion.eng.br/";
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://scope.aion.eng.br",
        host: "aionscope:3000",
      }),
    ),
    true,
  );
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://evil.example",
        host: "aionscope:3000",
      }),
    ),
    false,
  );
});

test("http e https divergentes são rejeitados", () => {
  assert.equal(
    origemPainelPermitida(
      pedido(INTERNO, {
        origin: "https://scope.aion.eng.br",
        host: "scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "http",
      }),
    ),
    false,
  );
  assert.equal(
    origemPainelPermitida(
      pedido("https://scope.aion.eng.br/api/v1/painel/login", {
        origin: "http://scope.aion.eng.br",
        host: "scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br",
        "x-forwarded-proto": "https",
      }),
    ),
    false,
  );
  assert.equal(
    origemPainelPermitida(
      pedido("https://scope.aion.eng.br:8443/api/v1/painel/login", {
        origin: "https://scope.aion.eng.br",
        "x-forwarded-host": "scope.aion.eng.br:8443",
        "x-forwarded-proto": "https",
      }),
    ),
    false,
  );
});
