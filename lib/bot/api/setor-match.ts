/**
 * Setor por igualdade normalizada, mais apelidos. Sem substring.
 * Vários alvos devolvem candidatos (até cinco) ou pedem um nome mais longo.
 */
import { json } from "./http";
import { normalizarChave } from "./chave";
import type { ApelidoSetor } from "./apelidos";

export const MSG_SETOR_NAO_ENCONTRADO = "setor não encontrado";
export const MSG_REFINAR = "Informe o nome do setor com mais detalhe.";
export const MSG_SETOR_CADASTRO = "Cadastre o setor deste usuário para consultar.";

export type CatalogoSetor = Map<string, Map<string, number>>;

export function catalogarNomes(nomes: Array<string | null | undefined>): CatalogoSetor {
  const vistos: CatalogoSetor = new Map();
  for (const bruto of nomes) {
    const nome = (bruto ?? "").trim();
    const chave = normalizarChave(nome);
    if (!chave) continue;
    const grupo = vistos.get(chave) ?? new Map<string, number>();
    grupo.set(nome, (grupo.get(nome) ?? 0) + 1);
    vistos.set(chave, grupo);
  }
  return vistos;
}

export function nomeExibicao(originais: Map<string, number>) {
  let escolhido = "";
  let vezes = -1;
  for (const [nome, n] of originais) {
    if (n > vezes || (n === vezes && nome.localeCompare(escolhido, "pt-BR") < 0)) {
      escolhido = nome;
      vezes = n;
    }
  }
  return escolhido.toLocaleUpperCase("pt-BR");
}

export type ResolvidoSetor =
  | { tipo: "ok"; chave: string; nome: string }
  | { tipo: "ambiguo"; candidatos: Array<{ ordem: number; setor: string }> }
  | { tipo: "refinar" }
  | { tipo: "nao_encontrado" };

export function resolverSetor(consulta: string, catalogo: CatalogoSetor, apelidos: ApelidoSetor[]): ResolvidoSetor {
  const q = normalizarChave(consulta);
  if (!q) return { tipo: "nao_encontrado" };
  const hits = new Set<string>();
  if (catalogo.has(q)) hits.add(q);
  for (const apelido of apelidos) {
    if (normalizarChave(apelido.apelido) !== q) continue;
    const alvo = normalizarChave(apelido.nome);
    if (alvo && catalogo.has(alvo)) hits.add(alvo);
  }
  if (hits.size === 0) return { tipo: "nao_encontrado" };
  if (hits.size > 5) return { tipo: "refinar" };
  if (hits.size === 1) {
    const chave = [...hits][0]!;
    return { tipo: "ok", chave, nome: nomeExibicao(catalogo.get(chave)!) };
  }
  const candidatos = [...hits]
    .map((chave) => ({ setor: nomeExibicao(catalogo.get(chave)!) }))
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"))
    .map((item, indice) => ({ ordem: indice + 1, setor: item.setor }));
  return { tipo: "ambiguo", candidatos };
}

export type DecisaoSetor =
  | { tipo: "todos" }
  | { tipo: "chaves"; chaves: Set<string> }
  | { tipo: "nao_cadastrado" }
  | { tipo: "informe" }
  | { tipo: "nao_encontrado" }
  | { tipo: "ambiguo"; candidatos: Array<{ ordem: number; setor: string }> }
  | { tipo: "refinar" };

/**
 * Assistência: o parâmetro é ignorado; vale o vínculo pessoa-setor.
 * Gestão e manutenção: qualquer setor da cópia.
 * Outros papéis com vínculo: só esses setores. Sem vínculo: o parâmetro escolhe.
 */
export function decidirSetor(opts: {
  assistencial: boolean;
  gestao: boolean;
  vinculos: string[];
  consulta: string;
  nomesNaCopia: Array<string | null | undefined>;
  modo: "lista" | "unico";
  apelidos: ApelidoSetor[];
}): DecisaoSetor {
  const catalogo = catalogarNomes(opts.nomesNaCopia);
  const vinculos = [...new Set(opts.vinculos.map((nome) => normalizarChave(nome)).filter(Boolean))];

  if (opts.assistencial) {
    if (vinculos.length === 0) return { tipo: "nao_cadastrado" };
    if (opts.modo === "unico" && vinculos.length > 1) {
      if (vinculos.length > 5) return { tipo: "refinar" };
      const candidatos = vinculos
        .map((chave) => (catalogo.has(chave) ? nomeExibicao(catalogo.get(chave)!) : chave))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((setor, indice) => ({ ordem: indice + 1, setor }));
      return { tipo: "ambiguo", candidatos };
    }
    return { tipo: "chaves", chaves: new Set(vinculos) };
  }

  const restringir = !opts.gestao && vinculos.length > 0;
  const efetivo: CatalogoSetor = new Map();
  if (restringir) {
    for (const chave of vinculos) {
      const item = catalogo.get(chave);
      if (item) efetivo.set(chave, item);
    }
  } else {
    for (const [chave, item] of catalogo) efetivo.set(chave, item);
  }

  const consulta = opts.consulta.trim();
  if (!consulta) {
    if (opts.modo === "unico") return { tipo: "informe" };
    if (restringir) return { tipo: "chaves", chaves: new Set(vinculos) };
    return { tipo: "todos" };
  }

  const resolvido = resolverSetor(consulta, efetivo, opts.apelidos);
  if (resolvido.tipo === "ok") return { tipo: "chaves", chaves: new Set([resolvido.chave]) };
  if (resolvido.tipo === "ambiguo") return resolvido;
  if (resolvido.tipo === "refinar") return { tipo: "refinar" };
  return { tipo: "nao_encontrado" };
}

export function nomeDaChave(chave: string, nomes: Array<string | null | undefined>) {
  const catalogo = catalogarNomes(nomes);
  if (catalogo.has(chave)) return nomeExibicao(catalogo.get(chave)!);
  return chave;
}

/** Resposta pronta quando a decisão não é uma lista de chaves. `null` segue o fluxo. */
export function respostaDecisaoSetor(decisao: DecisaoSetor, base: Record<string, unknown> = {}) {
  if (decisao.tipo === "todos" || decisao.tipo === "chaves") return null;
  if (decisao.tipo === "nao_cadastrado") {
    return json(200, { ok: false, status: "setor_nao_cadastrado", message: MSG_SETOR_CADASTRO });
  }
  if (decisao.tipo === "informe") return json(400, { ok: false, message: "Informe o setor." });
  if (decisao.tipo === "nao_encontrado") {
    return json(404, { ok: false, status: "nao_encontrado", message: MSG_SETOR_NAO_ENCONTRADO, ...base });
  }
  if (decisao.tipo === "refinar") {
    return json(200, { ok: true, status: "refinar", message: MSG_REFINAR, ...base });
  }
  return json(200, { ok: true, status: "ambiguo", candidatos: decisao.candidatos, ...base });
}
