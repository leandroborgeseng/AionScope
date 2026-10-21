/**
 * Importa os 16 contratos do CSV de 20/10/2026 no SQLite do AionScope. NUNCA roda na subida.
 *
 * Na imagem (compilado, sem tsx):
 *   DATABASE_PATH=/data/aionscope.sqlite node scripts/importar-contratos.js --csv /tmp/contratos-20-10.csv --dry-run
 *   DATABASE_PATH=/data/aionscope.sqlite node scripts/importar-contratos.js --csv /tmp/contratos-20-10.csv --confirmar
 *
 * Regras: exige DATABASE_PATH (arquivo existente); recusa CSV com sha256 diferente; falha se os totais
 * do CSV não fecharem; idempotente pela chave csv-20-10:<n>. Faça .backup do banco antes do --confirmar.
 */
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import {
  CSV_20_10_SHA256,
  ESPERADO,
  formatCentavos,
  importarContratos,
  parseCsvContratos,
  sha256,
  totaisConferem,
  totaisImportadosNoBanco,
  totaisLinhas,
} from "../lib/cadastros/importar-contratos";

function arg(nome: string) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function imprimirTotais(titulo: string, t: ReturnType<typeof totaisLinhas>) {
  console.log(titulo);
  console.log(`  Manutenção: ${t.MANUTENCAO.qtde} contratos, ${formatCentavos(t.MANUTENCAO.centavos)}`);
  console.log(`  Locação:    ${t.LOCACAO.qtde} contratos, ${formatCentavos(t.LOCACAO.centavos)}`);
  console.log(`  Total:      ${t.TOTAL.qtde} contratos, ${formatCentavos(t.TOTAL.centavos)}`);
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirmar = process.argv.includes("--confirmar");
  if (dryRun === confirmar) throw new Error("Use exatamente um: --dry-run ou --confirmar.");

  const dbPath = process.env.DATABASE_PATH?.trim();
  if (!dbPath) throw new Error("DATABASE_PATH é obrigatório.");
  if (!existsSync(dbPath)) throw new Error(`Banco não encontrado em ${dbPath} (o script não cria banco novo).`);

  const csvPath = arg("--csv") ?? "contratos-20-10.csv";
  if (!existsSync(csvPath)) throw new Error(`CSV não encontrado: ${csvPath}`);
  const bruto = readFileSync(csvPath);
  const hash = sha256(bruto);
  if (hash !== CSV_20_10_SHA256) {
    throw new Error(`CSV diferente do aprovado (sha256 ${hash}). Importação recusada.`);
  }

  const linhas = parseCsvContratos(bruto.toString("utf8"));
  const tCsv = totaisLinhas(linhas);
  imprimirTotais("CSV (sha256 conferido):", tCsv);
  if (!totaisConferem(tCsv)) throw new Error("Totais do CSV não fecham com o esperado. Importação recusada.");

  const db = new Database(dbPath, { readonly: dryRun, fileMustExist: true });
  try {
    const res = importarContratos(db, linhas, { dryRun });
    console.log(`${dryRun ? "[dry-run] " : ""}Banco: ${dbPath}`);
    console.log(`${dryRun ? "Inseriria" : "Inseridos"}: ${res.inseridos.length} · já existentes (mantidos): ${res.existentes.length}`);
    if (!dryRun) {
      const tDb = totaisImportadosNoBanco(db);
      imprimirTotais("Banco (contratos csv-20-10):", tDb);
      if (tDb.TOTAL.qtde !== ESPERADO.TOTAL.qtde) throw new Error("Contagem no banco diferente de 16.");
      if (!totaisConferem(tDb)) console.warn("Aviso: valores no banco diferem do CSV (contratos editados na tela?).");
    }
  } finally {
    db.close();
  }
  console.log("OK");
}

try {
  main();
} catch (e) {
  console.error(`ERRO: ${(e as Error).message}`);
  process.exit(1);
}
