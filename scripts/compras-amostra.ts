#!/usr/bin/env npx tsx
import { caixasM365, destinosCompras, m365Configurado } from "../lib/compras/parse-email";
import { enderecoDe, enderecosPara, listarRecentes, trechoMensagem } from "../lib/compras/graph";

async function main() {
  if (!m365Configurado()) {
    console.error("Configure M365_TENANT_ID, M365_CLIENT_ID e M365_CLIENT_SECRET.");
    console.error("Passo a passo: docs/sala/m365-setup.md");
    process.exit(1);
  }
  const destinos = new Set(destinosCompras());
  const caixas = caixasM365();
  console.log(`Caixas: ${caixas.join(", ")}`);
  console.log(`Destinos: ${[...destinos].join(", ")}\n`);

  for (const caixa of caixas) {
    console.log(`=== Enviados · ${caixa} ===`);
    const enviados = await listarRecentes(caixa, "sentitems", 30);
    let n = 0;
    for (const msg of enviados) {
      const para = enderecosPara(msg);
      if (!para.some((a) => destinos.has(a))) continue;
      n += 1;
      const trecho = trechoMensagem(msg, 300);
      console.log(`- ${msg.sentDateTime ?? "?"} | ${para.join(", ")}`);
      console.log(`  ${msg.subject ?? "(sem assunto)"}`);
      console.log(`  ${trecho}\n`);
    }
    console.log(`(${n} filtrados de ${enviados.length})\n`);

    console.log(`=== Inbox · ${caixa} (só @hsj.com.br) ===`);
    const inbox = await listarRecentes(caixa, "inbox", 30);
    let r = 0;
    for (const msg of inbox) {
      const de = enderecoDe(msg);
      if (!de.endsWith("@hsj.com.br")) continue;
      r += 1;
      console.log(`- ${msg.receivedDateTime ?? "?"} | de ${de}`);
      console.log(`  ${msg.subject ?? "(sem assunto)"}`);
      console.log(`  ${trechoMensagem(msg, 300)}\n`);
    }
    console.log(`(${r} filtrados de ${inbox.length})\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
