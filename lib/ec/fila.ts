import type { SituacaoOs } from "./situacao";

export type ItemFila = {
  id: string;
  tipo: "os" | "plano";
  situacao: SituacaoOs | "PLANO";
  criticidadeOrdem: number;
  parado: boolean;
  aberturaMs: number;
};

const ORDEM: Record<string, number> = {
  GRAVE: 0,
  ATRASADA: 1,
  PLANO: 2,
  "VENCE LOGO": 3,
  "NO PRAZO": 4,
  "SEM META": 5,
  ATENDIDA: 6,
};

export function ordenarFila<T extends ItemFila>(itens: T[]) {
  return [...itens].sort((a, b) => {
    const situacao = (ORDEM[a.situacao] ?? 9) - (ORDEM[b.situacao] ?? 9);
    if (situacao) return situacao;
    if (a.criticidadeOrdem !== b.criticidadeOrdem) return a.criticidadeOrdem - b.criticidadeOrdem;
    if (a.parado !== b.parado) return a.parado ? -1 : 1;
    return a.aberturaMs - b.aberturaMs;
  });
}
