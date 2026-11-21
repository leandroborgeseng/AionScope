/**
 * OS abertas, detalhe e corretivas da EC por setor. Só a cópia de os-analitico.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { parsePbiDate } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { isOsCancelada, osFechamentoDate } from "@/lib/pbi/volume-ec";
import { contextoBot, papelAssistencial, papelGestao } from "./acesso";
import { listarApelidos } from "./apelidos";
import { camposEtapa, indiceEtapa } from "./andamento";
import { normalizarChave } from "./chave";
import { lerLista } from "./copia";
import { oficinaEngenhariaClinicaExata, oficinaNoEscopoBot } from "./escopo";
import { copiaIndisponivel, json } from "./http";
import { cursorDaPagina, lerPaginacao } from "./paginacao";
import { historicoOs, projetarOs } from "./projecao";
import { catalogarNomes, decidirSetor, nomeExibicao, respostaDecisaoSetor } from "./setor-match";

function aberta(item: OsAnaliticoItem) {
  if (isOsCancelada(item)) return false;
  if (semAcento(item.SituacaoDaOS) === "FECHADA") return false;
  return osFechamentoDate(item) == null;
}

function instante(valor: string | null | undefined) {
  return parsePbiDate(valor)?.getTime() ?? 0;
}

function instanteResumo(valor: string | null | undefined) {
  const data = parsePbiDate(valor);
  return data ? data.getTime() : Number.POSITIVE_INFINITY;
}

function inclui(campo: string | null | undefined, filtro: string) {
  if (!filtro) return true;
  return semAcento(campo).includes(semAcento(filtro));
}

function resumoOs(itens: OsAnaliticoItem[]) {
  const porPrioridade: Record<string, number> = {};
  let semTecnico = 0;
  let maisAntiga: OsAnaliticoItem | null = null;
  for (const item of itens) {
    const prioridade = texto(item.Prioridade) || "Sem prioridade";
    porPrioridade[prioridade] = (porPrioridade[prioridade] ?? 0) + 1;
    if (!texto(item.TecnicoResolvedor)) semTecnico += 1;
    if (!maisAntiga) {
      maisAntiga = item;
      continue;
    }
    const atual = instanteResumo(item.Abertura);
    const melhor = instanteResumo(maisAntiga.Abertura);
    if (atual < melhor || (atual === melhor && texto(item.OS).localeCompare(texto(maisAntiga.OS), "pt-BR") < 0)) {
      maisAntiga = item;
    }
  }
  const ordenado: Record<string, number> = {};
  for (const chave of Object.keys(porPrioridade).sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    ordenado[chave] = porPrioridade[chave]!;
  }
  return {
    total: itens.length,
    porPrioridade: ordenado,
    maisAntiga: maisAntiga ? { numero: texto(maisAntiga.OS), abertura: texto(maisAntiga.Abertura) } : null,
    semTecnico,
  };
}

function foraDoSetorAssistencial(setores: string[], setor: string | null | undefined) {
  const permitidos = new Set(setores.map((nome) => normalizarChave(nome)));
  return !permitidos.has(normalizarChave(setor));
}

function naoEncontrei() {
  return json(404, { ok: false, message: "Não encontrei." });
}

export function consultarOsAbertas(request: Request, usuarioId: string, agora = new Date()) {
  const params = new URL(request.url).searchParams;
  if (params.get("abertas") !== "1") return json(400, { ok: false, message: "Use abertas=1." });
  const paginacao = lerPaginacao(params);
  if (!paginacao.ok) return json(400, { ok: false, message: paginacao.message });
  const ctx = contextoBot(usuarioId);
  if (papelAssistencial(ctx.papel) && ctx.setores.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }
  const copia = lerLista("os-analitico", agora.getTime());
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const noEscopo = (copia.itens as OsAnaliticoItem[]).filter((item) => oficinaNoEscopoBot(item.Oficina));
  const decisao = decidirSetor({
    assistencial: papelAssistencial(ctx.papel),
    gestao: papelGestao(ctx.papel),
    vinculos: ctx.setores,
    consulta: params.get("setor")?.trim() ?? "",
    nomesNaCopia: noEscopo.map((item) => item.Setor),
    modo: "lista",
    apelidos: listarApelidos(),
  });
  const meta = { fetchedAt: copia.fetchedAt, idadeSegundos: copia.idadeSegundos };
  const especial = respostaDecisaoSetor(decisao, meta);
  if (especial) return especial;
  const chaves = decisao.tipo === "chaves" ? decisao.chaves : null;
  const filtroTag = params.get("tag")?.trim() ?? "";
  const filtroEquipamento = params.get("equipamento")?.trim() ?? "";
  const itens = noEscopo
    .filter((item) => aberta(item))
    .filter((item) => (filtroTag ? semAcento(item.Tag) === semAcento(filtroTag) : true))
    .filter((item) => inclui(item.Equipamento, filtroEquipamento))
    .filter((item) => (chaves ? chaves.has(normalizarChave(item.Setor)) : true))
    .sort((a, b) => instante(b.Abertura) - instante(a.Abertura) || texto(a.OS).localeCompare(texto(b.OS), "pt-BR"));
  const fatia = itens.slice(paginacao.offset, paginacao.offset + paginacao.limit);
  const proximo = paginacao.offset + paginacao.limit < itens.length ? paginacao.offset + paginacao.limit : null;
  const matriculas = papelGestao(ctx.papel);
  return json(200, {
    ok: true,
    itens: fatia.map((item) => projetarOs(item, { matriculas })),
    resumo: resumoOs(itens),
    limit: paginacao.limit,
    offset: paginacao.offset,
    proximoCursor: proximo == null ? null : cursorDaPagina(proximo),
    ...meta,
  });
}

export function consultarOsNumero(numero: string, usuarioId: string, agora = new Date()) {
  const ctx = contextoBot(usuarioId);
  if (papelAssistencial(ctx.papel) && ctx.setores.length === 0) {
    return respostaDecisaoSetor({ tipo: "nao_cadastrado" })!;
  }
  const copia = lerLista("os-analitico", agora.getTime());
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const chave = semAcento(numero);
  const item = (copia.itens as OsAnaliticoItem[]).find(
    (os) => semAcento(os.OS) === chave || semAcento(String(os.CodigoSerialOS ?? "")) === chave,
  );
  if (!item || !oficinaNoEscopoBot(item.Oficina)) return naoEncontrei();
  if (papelAssistencial(ctx.papel) && foraDoSetorAssistencial(ctx.setores, item.Setor)) return naoEncontrei();
  const gestao = papelGestao(ctx.papel);
  return json(200, {
    ok: true,
    os: {
      ...projetarOs(item, { matriculas: gestao }),
      ...camposEtapa(item, agora, { solicitacao: gestao }),
    },
    historico: historicoOs(item),
    fetchedAt: copia.fetchedAt,
    idadeSegundos: copia.idadeSegundos,
  });
}

function corretivaEc(item: OsAnaliticoItem) {
  return aberta(item) && oficinaEngenhariaClinicaExata(item.Oficina) && normalizarChave(item.TipoDeManutencao).includes("CORRETIVA");
}

type LinhaPorSetor = {
  setorNome: string;
  numero: string;
  equipamento: string;
  tag: string;
  etapa: string;
  manutencaoExterna: boolean;
  pendenciaCompra: boolean;
  abertura: string;
  dataAtendimento: string | null;
  tempoAteAtendimento: { horas: number; dias: number } | null;
  diasNaEtapa: number;
  diasNaEtapaOrigem: string;
  textoEtapa: string;
  solicitacao?: string;
};

function nomeDoSetor(item: OsAnaliticoItem, nomes: ReturnType<typeof catalogarNomes>) {
  const chave = normalizarChave(item.Setor);
  if (!chave) return "SEM SETOR";
  return nomes.has(chave) ? nomeExibicao(nomes.get(chave)!) : "SEM SETOR";
}

function agruparPagina(linhas: LinhaPorSetor[]) {
  const setores: Array<{
    setor: string;
    quantidade: number;
    porEtapa: Array<{ etapa: string; quantidade: number; os: Array<Omit<LinhaPorSetor, "setorNome">> }>;
  }> = [];
  for (const linha of linhas) {
    let setor = setores[setores.length - 1];
    if (!setor || setor.setor !== linha.setorNome) {
      setor = { setor: linha.setorNome, quantidade: 0, porEtapa: [] };
      setores.push(setor);
    }
    const { setorNome: _setorNome, ...os } = linha;
    let etapa = setor.porEtapa[setor.porEtapa.length - 1];
    if (!etapa || etapa.etapa !== os.etapa) {
      etapa = { etapa: os.etapa, quantidade: 0, os: [] };
      setor.porEtapa.push(etapa);
    }
    etapa.os.push(os);
    etapa.quantidade += 1;
    setor.quantidade += 1;
  }
  return setores;
}

export function consultarOsPorSetor(request: Request, usuarioId: string, agora = new Date()) {
  const ctx = contextoBot(usuarioId);
  if (!papelGestao(ctx.papel)) return json(403, { ok: false });
  const params = new URL(request.url).searchParams;
  if (params.get("abertas") !== "1") return json(400, { ok: false, message: "Use abertas=1." });
  if (normalizarChave(params.get("tipo")) !== "CORRETIVA") return json(400, { ok: false, message: "Use tipo=corretiva." });
  const paginacao = lerPaginacao(params);
  if (!paginacao.ok) return json(400, { ok: false, message: paginacao.message });
  const copia = lerLista("os-analitico", agora.getTime());
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const noEscopo = (copia.itens as OsAnaliticoItem[]).filter((item) => oficinaNoEscopoBot(item.Oficina));
  const decisao = decidirSetor({
    assistencial: false,
    gestao: true,
    vinculos: ctx.setores,
    consulta: params.get("setor")?.trim() ?? "",
    nomesNaCopia: noEscopo.map((item) => item.Setor),
    modo: "lista",
    apelidos: listarApelidos(),
  });
  const meta = { fetchedAt: copia.fetchedAt, idadeSegundos: copia.idadeSegundos };
  const especial = respostaDecisaoSetor(decisao, meta);
  if (especial) return especial;
  const chaves = decisao.tipo === "chaves" ? decisao.chaves : null;
  const filtrados = noEscopo.filter(corretivaEc).filter((item) => (chaves ? chaves.has(normalizarChave(item.Setor)) : true));
  const nomes = catalogarNomes(filtrados.map((item) => item.Setor));
  const linhas = filtrados
    .map((item) => {
      const campos = camposEtapa(item, agora, { solicitacao: true });
      const linha: LinhaPorSetor = {
        setorNome: nomeDoSetor(item, nomes),
        numero: texto(item.OS),
        equipamento: texto(item.Equipamento),
        tag: texto(item.Tag),
        etapa: campos.etapa,
        manutencaoExterna: campos.manutencaoExterna,
        pendenciaCompra: campos.pendenciaCompra,
        abertura: campos.abertura,
        dataAtendimento: campos.dataAtendimento,
        tempoAteAtendimento: campos.tempoAteAtendimento,
        diasNaEtapa: campos.diasNaEtapa,
        diasNaEtapaOrigem: campos.diasNaEtapaOrigem,
        textoEtapa: campos.textoEtapa,
        solicitacao: campos.solicitacao,
      };
      return linha;
    })
    .sort(
      (a, b) =>
        a.setorNome.localeCompare(b.setorNome, "pt-BR") ||
        indiceEtapa(a.etapa) - indiceEtapa(b.etapa) ||
        a.etapa.localeCompare(b.etapa, "pt-BR") ||
        a.numero.localeCompare(b.numero, "pt-BR"),
    );
  const fatia = linhas.slice(paginacao.offset, paginacao.offset + paginacao.limit);
  const proximo = paginacao.offset + paginacao.limit < linhas.length ? paginacao.offset + paginacao.limit : null;
  return json(200, {
    ok: true,
    tipo: "corretiva",
    total: linhas.length,
    setores: agruparPagina(fatia),
    limit: paginacao.limit,
    offset: paginacao.offset,
    proximoCursor: proximo == null ? null : cursorDaPagina(proximo),
    ...meta,
  });
}
