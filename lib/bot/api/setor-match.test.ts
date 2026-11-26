import assert from "node:assert/strict";
import { test } from "node:test";
import { decidirSetor, resolverSetor, catalogarNomes } from "./setor-match";

const nomes = ["Centro Cirúrgico", "Centro Cirúrgico Ambulatorial", "Farmácia Satélite Centro Cirúrgico", "UTI ZZ"];

test("setor casa exato, por substring e por apelido", () => {
  const catalogo = catalogarNomes(nomes);
  const apelidos = [{ apelido: "CC", nome: "Centro Cirúrgico" }];
  assert.equal(resolverSetor("centro   cirúrgico", catalogo, apelidos).tipo, "ok");
  assert.equal(resolverSetor("cc", catalogo, apelidos).tipo, "ok");
  const curto = resolverSetor("centro", catalogo, apelidos);
  assert.equal(curto.tipo, "ambiguo");
  if (curto.tipo === "ambiguo") {
    assert.deepEqual(
      curto.candidatos.map((item) => item.setor),
      ["CENTRO CIRÚRGICO", "CENTRO CIRÚRGICO AMBULATORIAL", "FARMÁCIA SATÉLITE CENTRO CIRÚRGICO"],
    );
  }
  const ambulatorio = resolverSetor("Centro Cirúrgico Ambulatorial", catalogo, apelidos);
  assert.equal(ambulatorio.tipo, "ok");
  if (ambulatorio.tipo === "ok") assert.equal(ambulatorio.nome, "CENTRO CIRÚRGICO AMBULATORIAL");
});

test("CC casa o sufixo do Effort quando o nome curto não existe", () => {
  const catalogo = catalogarNomes(["CENTRO CIRÚRGICO - 10A", "CENTRO CIRÚRGICO AMBULATORIAL - 97", "UTI ZZ"]);
  const apelidos = [{ apelido: "CC", nome: "Centro Cirúrgico" }];
  for (const consulta of ["Centro Cirúrgico", "cc", "CC"]) {
    const resolvido = resolverSetor(consulta, catalogo, apelidos);
    assert.equal(resolvido.tipo, "ambiguo", consulta);
    if (resolvido.tipo === "ambiguo") {
      assert.deepEqual(
        resolvido.candidatos.map((item) => item.setor),
        ["CENTRO CIRÚRGICO - 10A", "CENTRO CIRÚRGICO AMBULATORIAL - 97"],
      );
    }
  }
  const exato = resolverSetor("CENTRO CIRÚRGICO - 10A", catalogo, apelidos);
  assert.equal(exato.tipo, "ok");
  if (exato.tipo === "ok") assert.equal(exato.nome, "CENTRO CIRÚRGICO - 10A");
});

test("apelido com dois nomes devolve candidatos", () => {
  const catalogo = catalogarNomes(nomes);
  const resolvido = resolverSetor("zz", catalogo, [
    { apelido: "ZZ", nome: "Centro Cirúrgico" },
    { apelido: "ZZ", nome: "UTI ZZ" },
  ]);
  assert.equal(resolvido.tipo, "ambiguo");
  if (resolvido.tipo === "ambiguo") {
    assert.deepEqual(
      resolvido.candidatos.map((item) => item.setor),
      ["CENTRO CIRÚRGICO", "UTI ZZ"],
    );
  }
});

test("assistência ignora o parâmetro; gestão filtra qualquer setor", () => {
  const travado = decidirSetor({
    assistencial: true,
    gestao: false,
    vinculos: ["Centro Cirúrgico"],
    consulta: "UTI ZZ",
    nomesNaCopia: nomes,
    modo: "lista",
    apelidos: [],
  });
  assert.equal(travado.tipo, "chaves");
  if (travado.tipo === "chaves") assert.deepEqual([...travado.chaves], ["CENTRO CIRURGICO"]);

  const vazio = decidirSetor({
    assistencial: true,
    gestao: false,
    vinculos: [],
    consulta: "UTI ZZ",
    nomesNaCopia: nomes,
    modo: "lista",
    apelidos: [],
  });
  assert.equal(vazio.tipo, "nao_cadastrado");

  const gestao = decidirSetor({
    assistencial: false,
    gestao: true,
    vinculos: ["Centro Cirúrgico"],
    consulta: "UTI ZZ",
    nomesNaCopia: nomes,
    modo: "lista",
    apelidos: [],
  });
  assert.equal(gestao.tipo, "chaves");
  if (gestao.tipo === "chaves") assert.deepEqual([...gestao.chaves], ["UTI ZZ"]);
});
