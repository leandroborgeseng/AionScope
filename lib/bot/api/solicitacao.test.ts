import assert from "node:assert/strict";
import { test } from "node:test";
import { prepararSolicitacao, rotuloOnzeDigitos } from "./solicitacao";

/** Os 21 textos das OS 3340–3360 do seed de QA. O vazamento é o mesmo critério da matriz. */
const FORMATOS: Array<[string, string, "[cpf]" | "[telefone]" | "[e-mail]"]> = [
  ["CPF pontuado", "123.456.789-09", "[cpf]"],
  ["CPF solto", "12345678909", "[cpf]"],
  ["CPF hífen", "123456789-09", "[cpf]"],
  ["CPF espaços", "123 456 789 09", "[cpf]"],
  ["CPF pontos", "123.456.789.09", "[cpf]"],
  ["tel +55 (DD)", "+55 (16) 99000-1111", "[telefone]"],
  ["tel (DD)", "(16) 99000-1111", "[telefone]"],
  ["tel DD NNNNN-NNNN", "16 99000-1111", "[telefone]"],
  ["celular 11", "16990001111", "[telefone]"],
  ["tel +55DD", "+5516990001111", "[telefone]"],
  ["tel 55DD", "5516990001111", "[telefone]"],
  ["tel sem DDD", "99000-1111", "[telefone]"],
  ["tel DD-NNNNN-NNNN", "16-99000-1111", "[telefone]"],
  ["tel fixo", "(16) 3333-4444", "[telefone]"],
  ["tel 0DD", "016 99000-1111", "[telefone]"],
  ["tel DD 9 NNNN-NNNN", "16 9 9000-1111", "[telefone]"],
  ["email caixa", "Fulano.QA33@Exemplo.COM.br", "[e-mail]"],
  ["email tag", "fulano_qa33+tag@sub.exemplo.org", "[e-mail]"],
  ["email sem TLD", "fulano@intranet", "[e-mail]"],
  ["tel (DD) colado", "(16)99000-1111", "[telefone]"],
  ["tel +55 DD solto", "+55 16 990001111", "[telefone]"],
];

const VAZA = /\d{4}|@|\d{3}[ .]\d{3}/;

test("solicitação mascara os 21 formatos da matriz", () => {
  assert.equal(FORMATOS.length, 21);
  for (const [nome, bruto, rotulo] of FORMATOS) {
    const saida = prepararSolicitacao(`QA33PII ${nome} ${bruto} fim`);
    assert.equal(VAZA.test(saida), false, `${nome}: ${saida}`);
    assert.equal(saida.includes(rotulo), true, `${nome}: ${saida}`);
    assert.equal(saida.includes(bruto), false, nome);
  }
});

test("celular de 11 dígitos é telefone; CPF válido sem esse formato continua cpf", () => {
  assert.equal(prepararSolicitacao("16990001111"), "[telefone]");
  assert.equal(rotuloOnzeDigitos("16990001111"), "[telefone]");
  assert.equal(prepararSolicitacao("12345678909"), "[cpf]");
  assert.equal(rotuloOnzeDigitos("12345678909"), "[cpf]");

  const base = [1, 1, 9, 8, 7, 6, 5, 4, 3];
  const dv = (len: number, n: number[]) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += n[i]! * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const completo = [...base, dv(9, base)];
  completo.push(dv(10, completo));
  const ambos = completo.join("");
  assert.equal(ambos.length, 11);
  assert.equal(rotuloOnzeDigitos(ambos), "[telefone]");
  assert.equal(prepararSolicitacao(`doc ${ambos}`), "doc [telefone]");
});

test("fixo de 10 dígitos, CPF com ponto e telefone sem DDD", () => {
  assert.equal(prepararSolicitacao("tel 1633334444"), "tel [telefone]");
  assert.equal(prepararSolicitacao("cpf 123456789.09 fim"), "cpf [cpf] fim");
  assert.equal(prepararSolicitacao("OS 3301-3302"), "OS [telefone]");
  assert.equal(prepararSolicitacao("os 3301-3302"), "os [telefone]");
  assert.equal(prepararSolicitacao("tel 3333-4444"), "tel [telefone]");
  assert.equal(prepararSolicitacao("tel 99000-1111"), "tel [telefone]");
  assert.equal(prepararSolicitacao("tel 5516990001111"), "tel [telefone]");
  assert.equal(prepararSolicitacao("tel +5516990001111"), "tel [telefone]");
  assert.equal(prepararSolicitacao("nota 2033334444"), "nota 2033334444");
});

test("telefone sem DDD não vaza nos 66 contextos do ciclo 3", () => {
  const contextos = (n: string) => [
    `OS ${n}`,
    `os ${n}`,
    `Os ${n}`,
    `O.S. ${n}`,
    `OS: ${n}`,
    `OS nº ${n}`,
    `OS-${n}`,
    `NS ${n}`,
    `patrimônio ${n}`,
    `tel ${n}`,
    `ramal ${n}`,
    `contato ${n}`,
    `ligar ${n}`,
    `ligar para os ${n}`,
    `anotar os ${n} e ${n}`,
    `${n} início`,
    `fim ${n}`,
    `(${n})`,
    `( ${n} )`,
    `OS 3301 contato ${n}`,
    `OS 3301-3302 tel ${n}`,
    `OS 3301-3302 ${n}`,
    `tel ${n} OS 3301-3302`,
    `abrir OS, ligar ${n}`,
    `chamar a OS ${n} do ramal`,
    `OS\t${n}`,
    `OS  ${n}`,
    `pos ${n}`,
    `nos ${n}`,
    `dos ${n}`,
    `os números ${n} / ${n}`,
    `OS ${n}.`,
    `OS ${n},tel`,
  ];
  const numeros = ["3333-4444", "99000-1111"];
  const frases = numeros.flatMap(contextos);
  assert.equal(frases.length, 66);
  const vaza = /3333.?4444|99000.?1111|33334444|990001111/;
  const vazados = frases.filter((frase) => vaza.test(prepararSolicitacao(frase)));
  assert.deepEqual(vazados, []);
});

test("máscara vem antes do corte e não parte marcador nem dígito", () => {
  const cruzando = prepararSolicitacao(`${"x".repeat(270)} 12345678909`);
  assert.equal(cruzando.endsWith("[cpf]"), true);
  assert.ok(cruzando.length <= 280);

  const partido = prepararSolicitacao(`${"z".repeat(274)} 16990001111`);
  assert.ok(partido.length <= 280);
  assert.equal(/\[[^\]]*$/.test(partido), false, partido);
  assert.equal(partido.includes("1699"), false);
  assert.equal(partido.includes("[t"), false);

  const digitos = prepararSolicitacao(`${"y".repeat(278)}987654`);
  assert.ok(digitos.length <= 280);
  assert.equal(digitos.includes("987654"), false);
  assert.equal(digitos.includes("98"), false);
  assert.equal(/\d$/.test(digitos), false);

  const longo = prepararSolicitacao(
    `QA33LONGO ${"x".repeat(260)} 123.456.789-09 (16) 99000-1111 a@b.com fim`,
  );
  assert.ok(longo.length <= 280);
  assert.equal(/\[[^\]]*$/.test(longo), false, longo);
  assert.equal(VAZA.test(longo), false, longo);

  const folgado = prepararSolicitacao(
    "Paciente   Exemplo ZZ  123.456.789-09  12345678909  zz@exemplo.invalid  +55 11 98888-7777  (11) 97777-6666",
  );
  assert.equal(folgado.includes("  "), false);
  assert.equal(folgado.includes("Paciente Exemplo ZZ"), true);
  assert.equal(VAZA.test(folgado), false, folgado);
  assert.equal(folgado.includes("[cpf]"), true);
  assert.equal(folgado.includes("[e-mail]"), true);
  assert.equal(folgado.includes("[telefone]"), true);
});
