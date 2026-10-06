import type { SalaSnapshot } from "./snapshot-tipos";

/** Números de OS abertas/em demanda visíveis no snapshot (fila + detalhes + osDetalhes). */
export function idsOsAbertas(snapshot: SalaSnapshot): string[] {
  const ids = new Set<string>();
  for (const item of snapshot.agora.fila) {
    if (item.os) ids.add(item.os);
  }
  const detalhes = snapshot.detalhes;
  if (detalhes) {
    for (const linhas of Object.values(detalhes)) {
      if (!linhas) continue;
      for (const linha of linhas) {
        if ("os" in linha && linha.os) ids.add(linha.os);
      }
    }
  }
  if (snapshot.osDetalhes) {
    for (const [os, detalhe] of Object.entries(snapshot.osDetalhes)) {
      if (detalhe.aberto !== false) ids.add(os);
    }
  }
  return [...ids];
}

/** Só deltas depois do primeiro snapshot (anterior === null → vazio). */
export function novasOsDesde(anterior: Iterable<string> | null, atual: Iterable<string>): string[] {
  if (anterior == null) return [];
  const prev = new Set(anterior);
  const vistas = new Set<string>();
  const novas: string[] = [];
  for (const id of atual) {
    if (!id || prev.has(id) || vistas.has(id)) continue;
    vistas.add(id);
    novas.push(id);
  }
  return novas;
}
