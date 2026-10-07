import { padronizarSetor } from "./setores";
import type {
  AnoAgg,
  FaixaReciclagem,
  PainelTreinamentos,
  ParticipanteTreinamento,
  ResumoSetor,
} from "./types";

export const META_RECICLAGEM_PCT = 60;
export const CARGA_PADRAO_MIN = 20;
export const TREINAMENTO_NOME = "Bombas de infusão B. Braun";
export const NOTA_SETOR =
  "Setor de 2026 obtido por cruzamento com 2025; 87 participantes sem setor identificado.";

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave de pessoa única: matrícula (+ nome se houver colisão de matrícula) ou nome. */
export function chavePessoa(p: ParticipanteTreinamento): string {
  const mat = p.matricula?.trim() ?? "";
  const nome = normalizarNome(p.nome);
  if (mat) return `m:${mat}|${nome}`;
  return `n:${nome}`;
}

export function cargaMinutos(p: ParticipanteTreinamento): number {
  return p.carga_min == null ? CARGA_PADRAO_MIN : p.carga_min;
}

export function faixaReciclagem(taxaPct: number): FaixaReciclagem {
  if (taxaPct >= 60) return "ok";
  if (taxaPct >= 40) return "atencao";
  return "critico";
}

function pessoasUnicas(lista: ParticipanteTreinamento[]): Map<string, ParticipanteTreinamento> {
  const mapa = new Map<string, ParticipanteTreinamento>();
  for (const p of lista) {
    const chave = chavePessoa(p);
    if (!mapa.has(chave)) mapa.set(chave, p);
  }
  return mapa;
}

function indexesAnterior(pessoas: Map<string, ParticipanteTreinamento>) {
  const porMatricula = new Map<string, ParticipanteTreinamento>();
  const porNome = new Map<string, ParticipanteTreinamento>();
  for (const p of pessoas.values()) {
    const mat = p.matricula?.trim();
    if (mat && !porMatricula.has(mat)) porMatricula.set(mat, p);
    const nome = normalizarNome(p.nome);
    if (nome && !porNome.has(nome)) porNome.set(nome, p);
  }
  return { porMatricula, porNome };
}

function vincularAnterior(
  atual: ParticipanteTreinamento,
  idx: ReturnType<typeof indexesAnterior>,
): ParticipanteTreinamento | "curado" | null {
  const mat = atual.matricula?.trim();
  if (mat) {
    const hit = idx.porMatricula.get(mat);
    if (hit) return hit;
  }
  const porNome = idx.porNome.get(normalizarNome(atual.nome));
  if (porNome) return porNome;
  // Vínculos manuais já gravados na base (abreviações de nome nas listas manuscritas).
  if (atual.reciclagem === true) return "curado";
  return null;
}

function horasHomem(lista: ParticipanteTreinamento[]): { horas: number; estimado: boolean } {
  let minutos = 0;
  let estimado = false;
  for (const p of lista) {
    minutos += cargaMinutos(p);
    if (p.carga_min == null || p.carga_estimada) estimado = true;
  }
  const horas = minutos / 60;
  // Referência do pacote usa horas inteiras quando estimado (≈181 h em 2025).
  const arred = estimado ? Math.round(horas) : Math.round(horas * 10) / 10;
  return { horas: arred, estimado };
}

function arred1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Agrega KPIs e resumo por setor a partir das linhas de `treinamentos.json`.
 * Reciclagem: matrícula → nome normalizado → flag curada `reciclagem`.
 * Setor do ano atual para reciclados vem do ano anterior (quando há vínculo).
 */
export function calcularPainel(
  participantes: ParticipanteTreinamento[],
  opts?: { atualizadoEm?: string },
): PainelTreinamentos {
  const anosPresentes = [...new Set(participantes.map((p) => p.ano))].sort((a, b) => a - b);
  const anoAtual = anosPresentes[anosPresentes.length - 1] ?? new Date().getFullYear();
  const anoAnterior = anosPresentes.includes(anoAtual - 1)
    ? anoAtual - 1
    : anosPresentes[anosPresentes.length - 2] ?? anoAtual - 1;

  const porAno = new Map<number, ParticipanteTreinamento[]>();
  for (const p of participantes) {
    const lista = porAno.get(p.ano) ?? [];
    lista.push(p);
    porAno.set(p.ano, lista);
  }

  const anos: AnoAgg[] = anosPresentes.map((ano) => {
    const lista = porAno.get(ano) ?? [];
    const unicos = pessoasUnicas(lista);
    const hh = horasHomem([...unicos.values()]);
    return {
      ano,
      treinados: unicos.size,
      horas_homem: hh.horas,
      horas_homem_estimado: hh.estimado,
    };
  });

  const unicosAnt = pessoasUnicas(porAno.get(anoAnterior) ?? []);
  const unicosAtual = pessoasUnicas(porAno.get(anoAtual) ?? []);
  const idxAnt = indexesAnterior(unicosAnt);

  let reciclados = 0;
  let novos = 0;
  const recicladosPorSetor = new Map<string, number>();
  const novosPorSetor = new Map<string, number>();

  for (const p of unicosAtual.values()) {
    const vinculo = vincularAnterior(p, idxAnt);
    if (vinculo == null) {
      novos += 1;
      const setorNovo = padronizarSetor(p.setor) ?? "Não informado";
      novosPorSetor.set(setorNovo, (novosPorSetor.get(setorNovo) ?? 0) + 1);
      continue;
    }
    reciclados += 1;
    const setorAnt =
      vinculo === "curado"
        ? padronizarSetor(p.setor) ?? "Não informado"
        : padronizarSetor(vinculo.setor) ?? "Não informado";
    recicladosPorSetor.set(setorAnt, (recicladosPorSetor.get(setorAnt) ?? 0) + 1);
  }

  const treinadosAnt = unicosAnt.size;
  const treinadosAtual = unicosAtual.size;
  const taxaGeral = treinadosAnt ? arred1((100 * reciclados) / treinadosAnt) : 0;
  const taxaNovos = treinadosAtual ? arred1((100 * novos) / treinadosAtual) : 0;
  const variacao = treinadosAnt ? arred1((100 * (treinadosAtual - treinadosAnt)) / treinadosAnt) : 0;

  const contagemSetorAnt = new Map<string, number>();
  for (const p of unicosAnt.values()) {
    const setor = padronizarSetor(p.setor) ?? "Não informado";
    contagemSetorAnt.set(setor, (contagemSetorAnt.get(setor) ?? 0) + 1);
  }

  const setoresChaves = new Set<string>([
    ...contagemSetorAnt.keys(),
    ...recicladosPorSetor.keys(),
    ...novosPorSetor.keys(),
  ]);

  const setores: ResumoSetor[] = [...setoresChaves]
    .map((setor) => {
      const treinados_anterior = contagemSetorAnt.get(setor) ?? 0;
      const reciclados_atual = recicladosPorSetor.get(setor) ?? 0;
      const novos_atual = novosPorSetor.get(setor) ?? 0;
      const taxa_reciclagem_pct = treinados_anterior
        ? arred1((100 * reciclados_atual) / treinados_anterior)
        : 0;
      return {
        setor,
        treinados_anterior,
        reciclados_atual,
        novos_atual,
        taxa_reciclagem_pct,
        faixa: faixaReciclagem(taxa_reciclagem_pct),
      };
    })
    .sort(
      (a, b) =>
        b.treinados_anterior - a.treinados_anterior ||
        b.reciclados_atual + b.novos_atual - (a.reciclados_atual + a.novos_atual) ||
        a.setor.localeCompare(b.setor, "pt-BR"),
    );

  return {
    treinamento: TREINAMENTO_NOME,
    atualizado_em: opts?.atualizadoEm ?? new Date().toISOString().slice(0, 10),
    anos,
    ano_anterior: anoAnterior,
    ano_atual: anoAtual,
    variacao_treinados_pct: variacao,
    reciclados_atual: reciclados,
    taxa_reciclagem_geral_pct: taxaGeral,
    novos_atual: novos,
    taxa_novos_pct: taxaNovos,
    setores,
    sem_setor_novos: novos,
    meta_reciclagem_pct: META_RECICLAGEM_PCT,
    nota_setor: NOTA_SETOR,
    cobertura_disponivel: false,
  };
}

/** Participantes enriquecidos com setor padronizado (para tabela). */
export function participantesParaTabela(lista: ParticipanteTreinamento[]): ParticipanteTreinamento[] {
  return lista.map((p) => ({
    ...p,
    setor: padronizarSetor(p.setor),
  }));
}
