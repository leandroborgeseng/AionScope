import { readFileSync } from "fs";
import { carregarSnapshot } from "../lib/ec/montar-snapshot";

for (const file of [".env.local", ".env"]) {
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).replace(/^"|"$/g, "");
  }
}

async function main() {
  const snapshot = await carregarSnapshot();
  console.log(
    JSON.stringify(
      {
        atualizadoEm: snapshot.atualizadoEm,
        plantao: snapshot.plantao,
        agora: {
          grave: snapshot.agora.grave,
          foraDoPrazo: snapshot.agora.foraDoPrazo,
          semPrimeiro: snapshot.agora.semPrimeiro,
          parados: snapshot.agora.parados,
          parque: snapshot.agora.parque,
          gravePct: snapshot.agora.gravePct,
          foraDoPrazoPct: snapshot.agora.foraDoPrazoPct,
          semPrimeiroPct: snapshot.agora.semPrimeiroPct,
          paradosPct: snapshot.agora.paradosPct,
          fila: snapshot.agora.fila.length,
          ocultas: snapshot.agora.filaOcultas,
          disp: snapshot.agora.disponibilidadeCriticos,
          prazo30: snapshot.agora.primeiroNoPrazo30d,
        },
        fluxo: snapshot.fluxo.etapas.map((etapa) => [etapa.etapa, etapa.quantidade]),
        envelhecimento: snapshot.envelhecimento.faixas.map((faixa) => [faixa.label, faixa.total]),
        ciclo: {
          trilha: snapshot.ciclo.trilha,
          fim: snapshot.ciclo.fimDeVida.length,
          histograma: snapshot.ciclo.histograma,
        },
        indicadores: snapshot.indicadores.cartoes.map((cartao) => [cartao.titulo, cartao.valor]),
        blocos: snapshot.blocos.filter((bloco) => bloco.fonte !== "api").map((bloco) => [bloco.id, bloco.erro]),
        erros: snapshot.blocos.filter((bloco) => bloco.erro && bloco.id !== "tpm" && bloco.id !== "plano" && bloco.id !== "compras" && bloco.id !== "mao-de-obra" && bloco.id !== "manuais"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "falha");
  process.exit(1);
});
