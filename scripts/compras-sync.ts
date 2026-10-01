#!/usr/bin/env npx tsx
import { sincronizarCompras } from "../lib/compras/sync";
import { listarCompras } from "../lib/compras/store";

async function main() {
  const resultado = await sincronizarCompras({ forcar: true });
  console.log(JSON.stringify(resultado, null, 2));
  const compras = listarCompras();
  console.log(`Compras no SQLite: ${compras.length}`);
  for (const c of compras.slice(0, 20)) {
    console.log(
      `- ${c.situacao.padEnd(20)} OS ${c.os ?? "—"} SC ${c.sc_numero ?? "—"} | ${c.item ?? c.equipamento ?? ""}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
