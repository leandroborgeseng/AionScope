import { readFileSync } from "fs";
import { fetchPbi } from "../lib/pbi/client";
import { buildComprasSnapshot } from "../lib/pbi/compras";
import { nowInSaoPaulo } from "../lib/pbi/dates";
import type { OsAnaliticoItem } from "../lib/pbi/types";

for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

async function main() {
  const params = new URLSearchParams({
    periodo: "DoisAnosAtuais",
    qtdPorPagina: "100000",
    tipoManutencao: "Todos",
  });
  const osR = await fetchPbi<OsAnaliticoItem[]>("os-analitico", params);
  if (!osR.ok) {
    console.log(osR);
    process.exit(1);
  }
  const now = nowInSaoPaulo();
  const snap = buildComprasSnapshot(osR.data, now);
  console.log(
    JSON.stringify(
      {
        now: now.toISOString(),
        abertas: snap.kpisAbertas,
        fechadas90d: snap.kpisFechadas.quantidade,
        top3: snap.abertas.slice(0, 3).map((r) => ({
          OS: r.OS,
          tag: r.Tag,
          setor: r.Setor,
          abertura: r.Abertura,
          dias: r.diasEspera,
          label: r.abertaHaLabel,
        })),
      },
      null,
      2,
    ),
  );
}

main();
