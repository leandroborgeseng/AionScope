/**
 * Correção em lote de contratos pela API do app (nunca acessa o banco direto).
 *
 *   tsx scripts/corrigir-contratos.ts --entrada /caminho/fora/do/repo/entrada.json [--dry-run]
 *   tsx scripts/corrigir-contratos.ts --entrada ... --confirmar
 *
 * Padrão = dry-run: mostra antes/depois de cada operação e os totais mensais atuais × resultantes.
 * Regras: suspensão conta por mês inteiro — um mês sai do custo só se estiver todo dentro de [suspensoDe, suspensoAte]
 * (suspensão no meio do mês não tira o mês). "criar" é ignorado (com aviso) se já houver contrato com mesmo fornecedor, valor e início.
 * --confirmar (alias --apply) só com a flag explícita, após OK do Leandro e backup do volume; exige sessão de escrita:
 *   AIONSCOPE_URL               (ex.: https://<host>; obrigatório, sem padrão)
 *   AIONSCOPE_SESSAO_COOKIE     (valor do cookie aion_contratos_sessao) OU
 *   CONTRATOS_ADMIN_PASSWORD    (faz login em /api/cadastros/contratos/sessao; nunca é impresso)
 * --contratos <arquivo.json> usa uma lista local em vez do GET (só dry-run; útil para teste).
 */
import { readFileSync } from "node:fs";
import { apiSuportaCorrecao, planejar, totaisMensais, validarEntrada, type Passo } from "../lib/cadastros/correcao-contratos";
import type { Contrato } from "../lib/cadastros/types";

const COOKIE = "aion_contratos_sessao";

function arg(nome: string) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const resumo = (c: Contrato | null) =>
  c
    ? `${c.nome} | ${brl(c.valorMensal)} | ${c.tipo ?? "sem tipo"} | ${c.inicio ?? "—"}→${c.fim ?? "—"} | ${c.ativo ? "ativo" : `inativo (conta até ${c.inativadoEm ?? "nunca"})`}${c.suspensoDe ? ` | suspenso ${c.suspensoDe}→${c.suspensoAte}` : ""}`
    : "(não existe)";

async function lerContratos(base: string | undefined, arquivo: string | undefined): Promise<Contrato[]> {
  if (arquivo) {
    const j = JSON.parse(readFileSync(arquivo, "utf8"));
    return Array.isArray(j) ? j : j.data;
  }
  if (!base) throw new Error("Defina AIONSCOPE_URL ou use --contratos <arquivo>.");
  const r = await fetch(`${base}/api/cadastros/contratos`, { cache: "no-store" });
  if (!r.ok) throw new Error(`GET contratos: HTTP ${r.status}`);
  return ((await r.json()) as { data: Contrato[] }).data;
}

async function cookieSessao(base: string) {
  if (process.env.AIONSCOPE_SESSAO_COOKIE) return `${COOKIE}=${process.env.AIONSCOPE_SESSAO_COOKIE}`;
  const senha = process.env.CONTRATOS_ADMIN_PASSWORD;
  if (!senha) throw new Error("Para --confirmar defina AIONSCOPE_SESSAO_COOKIE ou CONTRATOS_ADMIN_PASSWORD.");
  const r = await fetch(`${base}/api/cadastros/contratos/sessao`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ senha }),
  });
  const set = r.headers.get("set-cookie") ?? "";
  const m = new RegExp(`${COOKIE}=([^;]+)`).exec(set);
  if (!r.ok || !m) throw new Error(`Login recusado (HTTP ${r.status}).`);
  return `${COOKIE}=${m[1]}`;
}

function imprimirTotais(antes: Contrato[], depois: Contrato[], de: string, ate: string) {
  const a = totaisMensais(antes, de, ate);
  const d = totaisMensais(depois, de, ate);
  console.log("\nTotais mensais do indicador (só contratos de Manutenção):");
  console.log("mês      | atual                  | resultante             | diferença");
  a.forEach((x, i) => {
    const y = d[i];
    console.log(`${x.mes}  | ${String(x.qtde).padStart(2)} · ${brl(x.valor).padEnd(17)} | ${String(y.qtde).padStart(2)} · ${brl(y.valor).padEnd(17)} | ${brl(y.valor - x.valor)}`);
  });
}

async function main() {
  const apply = process.argv.includes("--apply") || process.argv.includes("--confirmar");
  const caminho = arg("--entrada");
  if (!caminho) throw new Error("Informe --entrada <arquivo.json> (fora do repositório).");
  const base = process.env.AIONSCOPE_URL?.replace(/\/+$/, "");
  const arquivoContratos = arg("--contratos");
  if (apply && arquivoContratos) throw new Error("--confirmar não aceita --contratos: aplica sempre sobre a lista real da API.");

  const v = validarEntrada(JSON.parse(readFileSync(caminho, "utf8")));
  if (!v.ok) {
    console.error("Entrada inválida:\n- " + v.erros.join("\n- "));
    process.exit(2);
  }
  const atuais = await lerContratos(base, arquivoContratos);
  const plano = planejar(atuais, v.entrada);
  if (!plano.ok) {
    console.error("Plano recusado:\n- " + plano.erros.join("\n- "));
    process.exit(3);
  }

  let cookie = "";
  // A API publicada precisa suportar suspensão/data efetiva (013); senão o PATCH ignoraria os campos.
  if (apply) {
    if (!apiSuportaCorrecao(atuais)) throw new Error("A API não expõe suspensoDe: publique a versão com a migração 013 antes do --confirmar.");
    if (!base) throw new Error("Para --confirmar defina AIONSCOPE_URL.");
    cookie = await cookieSessao(base);
  }
  console.log(`${apply ? "CONFIRMAR (grava)" : "DRY-RUN"} — ${plano.passos.length} operação(ões) sobre ${atuais.length} contrato(s)\n`);
  for (const a of plano.avisos) console.log(`ℹ ${a}`);
  for (const p of plano.passos) imprimirPasso(p);
  imprimirTotais(atuais, plano.final, v.entrada.meses.de, v.entrada.meses.ate);

  if (!apply) {
    console.log("\nNada foi alterado (dry-run). Para aplicar: --confirmar.");
    return;
  }
  for (const p of plano.passos) {
    const r = await fetch(`${base}${p.chamada.caminho}`, {
      method: p.chamada.metodo,
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(p.chamada.body),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!r.ok || !j.ok) throw new Error(`Falhou em operacoes[${p.indice}] (${p.op} ${p.id}): HTTP ${r.status} ${j.message ?? ""}. Passos anteriores já aplicados.`);
    console.log(`✔ operacoes[${p.indice}] ${p.op} ${p.id}`);
  }
  const conferido = await lerContratos(base, undefined);
  imprimirTotais(atuais, conferido, v.entrada.meses.de, v.entrada.meses.ate);
}

function imprimirPasso(p: Passo) {
  console.log(`[${p.indice}] ${p.op} ${p.id}`);
  console.log(`   antes : ${resumo(p.antes)}`);
  console.log(`   depois: ${resumo(p.depois)}`);
  console.log(`   chamada: ${p.chamada.metodo} ${p.chamada.caminho} ${JSON.stringify(p.chamada.body)}`);
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
