/**
 * Cronograma do bot por setor e por TAG. Lê a cópia (cronograma + parque).
 * Datas: última (`DataDaUltima`) e próxima (`ProximaRealizacao`) de preventiva,
 * TSE e calibração. A listagem junta o parque ao cronograma, não só OS aberta.
 */
import { texto } from "@/lib/ec/texto";
import { datasPorTipo, datasPublicas, chaveTag } from "@/lib/pbi/cronograma-datas";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { contextoBot, papelAssistencial, papelGestao } from "./acesso";
import { listarApelidos } from "./apelidos";
import { normalizarChave } from "./chave";
import { lerLista } from "./copia";
import { cronogramaNoEscopoBot, oficinaNoEscopoBot } from "./escopo";
import { copiaIndisponivel, json } from "./http";
import { decidirSetor, nomeDaChave, respostaDecisaoSetor, type DecisaoSetor } from "./setor-match";
import { casaRegistroComVinculo } from "./setor-usuario";

const LIMITE_EQUIPAMENTOS = 500;

type CopiaOk = { ok: true; itens: unknown[]; fetchedAt: string; idadeSegundos: number };

function maisVelha(a: { fetchedAt: string; idadeSegundos: number }, b: { fetchedAt: string; idadeSegundos: number } | null) {
  if (!b) return a;
  return {
    fetchedAt: a.fetchedAt < b.fetchedAt ? a.fetchedAt : b.fetchedAt,
    idadeSegundos: Math.max(a.idadeSegundos, b.idadeSegundos),
  };
}

function nomesSetor(os: CopiaOk | null, parque: CopiaOk | null, cronograma: CopiaOk | null) {
  const nomes: Array<string | null | undefined> = [];
  if (os) {
    for (const item of os.itens as OsAnaliticoItem[]) {
      if (oficinaNoEscopoBot(item.Oficina)) nomes.push(item.Setor);
    }
  }
  if (parque) for (const item of parque.itens as EquipamentoItem[]) nomes.push(item.Setor);
  if (cronograma) {
    for (const item of cronograma.itens as CronogramaItem[]) {
      if (cronogramaNoEscopoBot(item)) nomes.push(item.Setor);
    }
  }
  return nomes;
}

type Acum = {
  tag: string;
  equipamento: string;
  setor: string;
  chaveSetor: string;
  planos: CronogramaItem[];
};

function chaveLinha(tag: string, equipamento: string, setor: string) {
  const tagChave = chaveTag(tag);
  if (tagChave) return `tag:${tagChave}`;
  return `eq:${normalizarChave(equipamento)}|${normalizarChave(setor)}`;
}

function garantir(mapa: Map<string, Acum>, chave: string, base: Omit<Acum, "planos">) {
  const atual = mapa.get(chave);
  if (!atual) {
    mapa.set(chave, { ...base, planos: [] });
    return mapa.get(chave)!;
  }
  if (!atual.tag && base.tag) atual.tag = base.tag;
  if (!atual.equipamento && base.equipamento) atual.equipamento = base.equipamento;
  if (!atual.setor && base.setor) atual.setor = base.setor;
  return atual;
}

function listar(
  aceita: (item: { Setor?: string | null }) => boolean,
  tagFiltro: string,
  parque: EquipamentoItem[],
  planos: CronogramaItem[],
  agora: Date,
) {
  const mapa = new Map<string, Acum>();
  const tagChave = chaveTag(tagFiltro);
  const naTag = (tag: string | null | undefined) => (tagChave ? chaveTag(tag) === tagChave : true);

  for (const item of parque) {
    if (!aceita(item) || !naTag(item.Tag)) continue;
    const tag = texto(item.Tag);
    const equipamento = texto(item.Equipamento);
    const setor = texto(item.Setor);
    garantir(mapa, chaveLinha(tag, equipamento, setor), {
      tag,
      equipamento,
      setor,
      chaveSetor: normalizarChave(setor),
    });
  }
  for (const item of planos) {
    if (!cronogramaNoEscopoBot(item) || !aceita(item) || !naTag(item.Tag)) continue;
    const tag = texto(item.Tag);
    const equipamento = texto(item.Equipamento);
    const setor = texto(item.Setor);
    const linha = garantir(mapa, chaveLinha(tag, equipamento, setor), {
      tag,
      equipamento,
      setor,
      chaveSetor: normalizarChave(setor),
    });
    linha.planos.push(item);
  }

  const equipamentos = [...mapa.values()]
    .map((linha) => {
      const datas = datasPorTipo(linha.planos, agora);
      return {
        tag: linha.tag,
        equipamento: linha.equipamento,
        setor: linha.setor,
        preventiva: datasPublicas(datas.preventiva),
        tse: datasPublicas(datas.tse),
        calibracao: datasPublicas(datas.calibracao),
      };
    })
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR") ||
        a.equipamento.localeCompare(b.equipamento, "pt-BR") ||
        a.tag.localeCompare(b.tag, "pt-BR"),
    );
  return equipamentos;
}

function naoEncontrei() {
  return json(404, { ok: false, message: "Não encontrei." });
}

export function consultarCronograma(request: Request, usuarioId: string, agora = new Date()) {
  const params = new URL(request.url).searchParams;
  const consulta = params.get("setor")?.trim() ?? "";
  const tag = params.get("tag")?.trim() ?? "";
  const ctx = contextoBot(usuarioId);
  const assistencial = papelAssistencial(ctx.papel);
  if (assistencial && ctx.vinculos.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }

  const cronograma = lerLista("cronograma", agora.getTime());
  if (!cronograma.ok) return copiaIndisponivel(cronograma.motivo, cronograma.motivo === "expirada" ? cronograma : undefined);
  const parque = lerLista("equipamentos", agora.getTime());
  if (!parque.ok && parque.motivo === "expirada") return copiaIndisponivel(parque.motivo, parque);
  const os = lerLista("os-analitico", agora.getTime());
  const parqueOk = parque.ok ? parque : null;
  const osOk = os.ok ? os : null;
  const nomes = nomesSetor(osOk, parqueOk, cronograma);
  const meta = maisVelha(cronograma, parqueOk);
  const gestao = papelGestao(ctx.papel);
  const apelidos = listarApelidos();

  if (!tag && !consulta && !assistencial) return json(400, { ok: false, message: "Informe o setor ou a tag." });

  let aceita: (item: { Setor?: string | null }) => boolean = () => true;
  let setorNome: string | null = null;
  if (assistencial) {
    aceita = (item) => casaRegistroComVinculo(item, ctx.vinculos);
    if (ctx.vinculos.length === 1) {
      const unico = ctx.vinculos[0]!;
      setorNome = (unico.nome || unico.codigo).toLocaleUpperCase("pt-BR");
    }
  } else if (consulta) {
    const decisao: DecisaoSetor = decidirSetor({
      assistencial: false,
      gestao,
      vinculos: ctx.setores,
      consulta,
      nomesNaCopia: nomes,
      modo: "unico",
      apelidos,
    });
    const especial = respostaDecisaoSetor(decisao, meta);
    if (especial) return especial;
    if (decisao.tipo === "chaves") {
      aceita = (item) => decisao.chaves.has(normalizarChave(item.Setor));
      if (decisao.chaves.size === 1) setorNome = nomeDaChave([...decisao.chaves][0]!, nomes);
    }
  } else if (!gestao && ctx.setores.length > 0) {
    const decisao = decidirSetor({
      assistencial: false,
      gestao: false,
      vinculos: ctx.setores,
      consulta: "",
      nomesNaCopia: nomes,
      modo: "lista",
      apelidos,
    });
    if (decisao.tipo === "chaves") {
      aceita = (item) => decisao.chaves.has(normalizarChave(item.Setor));
    }
  }

  const equipamentos = listar(aceita, tag, parqueOk ? (parqueOk.itens as EquipamentoItem[]) : [], cronograma.itens as CronogramaItem[], agora);
  if (tag && equipamentos.length === 0) return naoEncontrei();
  const fatia = equipamentos.slice(0, LIMITE_EQUIPAMENTOS);
  return json(200, {
    ok: true,
    status: "ok",
    setor: setorNome,
    total: equipamentos.length,
    equipamentos: fatia,
    ...meta,
  });
}
