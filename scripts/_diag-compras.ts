import { readFileSync } from "fs";
import { fetchPbi } from "../lib/pbi/client";
import { parsePbiDate } from "../lib/pbi/dates";
import { isOsAberta } from "../lib/pbi/sala";
import type { OsAnaliticoItem, TipoManutencaoItem } from "../lib/pbi/types";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

function norm(v: string | null | undefined) {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

function countMap(items: string[]) {
  const m = new Map<string, number>();
  for (const v of items) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function matchesCompraText(v: string) {
  return (
    v.includes("COMPRA") ||
    v.includes("SOLICITACAO DE COMPRA") ||
    v.includes("SOLICITACAO COMPRA") ||
    v.includes("AQUISI") ||
    v.includes("REQUISICAO DE COMPRA") ||
    v.includes("PEDIDO DE COMPRA") ||
    v.includes("AGUARDANDO COMPRA") ||
    v.includes("AG. COMPRA") ||
    v.includes("AG COMPRA")
  );
}

async function main() {
  loadEnv();
  const params = new URLSearchParams({
    periodo: "DoisAnosAtuais",
    qtdPorPagina: "100000",
    tipoManutencao: "Todos",
  });

  console.log("fetching os-analitico + tipo-manutencao...");
  const [osR, tipoR] = await Promise.all([
    fetchPbi<OsAnaliticoItem[]>("os-analitico", params),
    fetchPbi<TipoManutencaoItem[]>("tipo-manutencao", new URLSearchParams()),
  ]);

  if (!osR.ok) {
    console.log("OS_FAIL", osR);
    process.exit(1);
  }
  if (!tipoR.ok) {
    console.log("TIPO_FAIL", tipoR);
  }

  const os = osR.data;
  console.log("total_os", os.length);

  if (tipoR.ok) {
    const tiposCompra = (tipoR.data as TipoManutencaoItem[]).filter((t) =>
      matchesCompraText(norm(t.Descricao)),
    );
    console.log(
      "tipos_manutencao_compra",
      tiposCompra.map((t) => ({ id: t.Id, desc: t.Descricao, ativo: t.Ativo })),
    );
  }

  // Contagens por campo
  const fields = [
    "TipoDeManutencao",
    "Tipo",
    "Ocorrencia",
    "Causa",
    "Pendencia",
    "PendenciaAberta",
    "Status",
    "SituacaoDaOS",
    "Servico",
    "ObservacaoDaOS",
    "ObservacaoDaRequisicao",
    "JustificativaEncerramento",
  ] as const;

  for (const field of fields) {
    const hits = os.filter((item) => matchesCompraText(norm(String(item[field] ?? ""))));
    if (hits.length === 0) continue;
    const vals = countMap(hits.map((i) => String(i[field] ?? "").trim() || "(vazio)"));
    console.log(`\n=== ${field}: ${hits.length} hits ===`);
    console.log(vals.slice(0, 25));
  }

  // TipoDeManutencao containing COMPRA specifically
  const byTipo = countMap(
    os
      .filter((i) => norm(i.TipoDeManutencao).includes("COMPRA"))
      .map((i) => i.TipoDeManutencao.trim() || "(vazio)"),
  );
  console.log("\n=== TipoDeManutencao contains COMPRA ===");
  console.log(byTipo);

  const byTipoSolic = countMap(
    os
      .filter((i) => {
        const t = norm(i.TipoDeManutencao);
        return t.includes("SOLICIT") && (t.includes("COMPRA") || t.includes("AQUISI"));
      })
      .map((i) => i.TipoDeManutencao.trim() || "(vazio)"),
  );
  console.log("\n=== TipoDeManutencao SOLICIT+COMPRA/AQUISI ===");
  console.log(byTipoSolic);

  // Candidates: TipoDeManutencao with COMPRA
  function isCompraCandidate(item: OsAnaliticoItem) {
    return matchesCompraText(norm(item.TipoDeManutencao));
  }

  const compras = os.filter(isCompraCandidate);
  const abertas = compras.filter(isOsAberta);
  console.log("\n=== RESUMO TipoDeManutencao compra ===");
  console.log({
    total: compras.length,
    abertas: abertas.length,
    fechadas: compras.length - abertas.length,
  });

  const sorted = [...abertas].sort((a, b) => {
    const da = parsePbiDate(a.Abertura)?.getTime() ?? 0;
    const db = parsePbiDate(b.Abertura)?.getTime() ?? 0;
    return da - db;
  });

  console.log("\n=== 10 abertas mais antigas (TipoDeManutencao compra) ===");
  for (const i of sorted.slice(0, 10)) {
    console.log({
      OS: i.OS,
      tipo: i.TipoDeManutencao,
      tag: i.Tag,
      setor: i.Setor,
      oficina: i.Oficina,
      abertura: i.Abertura,
      situacao: i.SituacaoDaOS,
      status: i.Status,
      ocorrencia: (i.Ocorrencia || "").slice(0, 80),
      pendencia: i.Pendencia,
      pendenciaAberta: i.PendenciaAberta,
    });
  }

  // Also check Pendencia / Status for compra among open OS
  const abertasAll = os.filter(isOsAberta);
  console.log("\ntotal_abertas_all", abertasAll.length);

  const abertasPendenciaCompra = abertasAll.filter(
    (i) =>
      matchesCompraText(norm(i.Pendencia)) ||
      matchesCompraText(norm(i.PendenciaAberta)) ||
      matchesCompraText(norm(i.Status)),
  );
  console.log("abertas_pendencia_status_compra", abertasPendenciaCompra.length);
  console.log(
    "sample_pendencia",
    countMap(
      abertasPendenciaCompra.map(
        (i) =>
          `P=${(i.Pendencia || "").slice(0, 40)}|PA=${(i.PendenciaAberta || "").slice(0, 40)}|S=${(i.Status || "").slice(0, 40)}`,
      ),
    ).slice(0, 20),
  );

  // Cross: tipo compra vs pendencia compra
  const tipoOnly = abertas.filter(
    (i) =>
      !matchesCompraText(norm(i.Pendencia)) &&
      !matchesCompraText(norm(i.PendenciaAberta)) &&
      !matchesCompraText(norm(i.Status)),
  );
  console.log("abertas_tipo_compra_sem_pendencia_texto", tipoOnly.length);

  // EC vs predial split among compra abertas
  const ec = abertas.filter((i) => {
    const t = norm(i.TipoDeManutencao);
    return t.startsWith("A -") || t.includes("ENGENHARIA CLINICA") || t.includes("CLINICA");
  });
  const predial = abertas.filter((i) => {
    const t = norm(i.TipoDeManutencao);
    return t.startsWith("M -") || t.startsWith("O -") || t.includes("PREDIAL");
  });
  console.log("\n=== recorte tipos compra abertas ===");
  console.log({
    ecish: ec.length,
    predialish: predial.length,
    outros: abertas.length - ec.length - predial.length,
    tipos: countMap(abertas.map((i) => i.TipoDeManutencao.trim() || "(vazio)")),
    oficinas: countMap(abertas.map((i) => i.Oficina.trim() || "(vazio)")),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
