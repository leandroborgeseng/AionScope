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

function pagina(params: URLSearchParams): { ok: true; limit: number; offset: number } | { ok: false; message: string } {
  const temLimit = params.has("limit");
  const temPage = params.has("pageSize");
  if (temLimit && temPage && params.get("limit") !== params.get("pageSize")) {
    return { ok: false, message: "Parâmetros de página inválidos." };
  }
  const bruto = temLimit ? params.get("limit") : temPage ? params.get("pageSize") : null;
  let limit = 20;
  if (bruto != null) {
    if (!/^\d+$/.test(bruto)) return { ok: false, message: "Parâmetros de página inválidos." };
    limit = Number(bruto);
    if (limit < 1 || limit > 100) return { ok: false, message: "Limite máximo é 100." };
  }
  if (params.has("offset") && params.has("cursor")) return { ok: false, message: "Parâmetros de página inválidos." };
  let offset = 0;
  if (params.has("cursor")) {
    const textoCursor = Buffer.from(params.get("cursor") ?? "", "base64url").toString("utf8");
    if (!/^\d+$/.test(textoCursor)) return { ok: false, message: "Parâmetros de página inválidos." };
    offset = Number(textoCursor);
  } else if (params.has("offset")) {
    const brutoOffset = params.get("offset") ?? "";
    if (!/^\d+$/.test(brutoOffset)) return { ok: false, message: "Parâmetros de página inválidos." };
    offset = Number(brutoOffset);
  }
  if (!Number.isSafeInteger(offset)) return { ok: false, message: "Parâmetros de página inválidos." };
  return { ok: true, limit, offset };
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
  const paginacao = pagina(params);
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
    proximoCursor: proximo == null ? null : Buffer.from(String(proximo), "utf8").toString("base64url"),
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

const LIMITE_POR_SETOR = 20;
const LIMITE_POR_SETOR_MAX = 100;

function paginarPorSetor(params: URLSearchParams): { ok: true; limite: number; offset: number } | { ok: false; message: string } {
  const bruto = params.get("limite");
  let limite = LIMITE_POR_SETOR;
  if (bruto != null) {
    if (!/^\d+$/.test(bruto)) return { ok: false, message: "Parâmetros de página inválidos." };
    limite = Number(bruto);
    if (limite < 1 || limite > LIMITE_POR_SETOR_MAX) return { ok: false, message: "Limite máximo é 100." };
  }
  if (params.has("cursor") && params.has("pagina")) return { ok: false, message: "Parâmetros de página inválidos." };
  let offset = 0;
  if (params.has("cursor")) {
    const cru = params.get("cursor") ?? "";
    if (!/^[A-Za-z0-9_-]+$/.test(cru)) return { ok: false, message: "Parâmetros de página inválidos." };
    const textoCursor = Buffer.from(cru, "base64url").toString("utf8");
    if (!/^\d+$/.test(textoCursor)) return { ok: false, message: "Parâmetros de página inválidos." };
    offset = Number(textoCursor);
  } else if (params.has("pagina")) {
    const brutoPagina = params.get("pagina") ?? "";
    if (!/^\d+$/.test(brutoPagina)) return { ok: false, message: "Parâmetros de página inválidos." };
    const pagina = Number(brutoPagina);
    if (!Number.isSafeInteger(pagina) || pagina < 1) return { ok: false, message: "Parâmetros de página inválidos." };
    offset = (pagina - 1) * limite;
  }
  if (!Number.isSafeInteger(offset)) return { ok: false, message: "Parâmetros de página inválidos." };
  return { ok: true, limite, offset };
}

function agruparPorSetor(linhas: OsAnaliticoItem[], agora: Date) {
  const grupos = new Map<string, OsAnaliticoItem[]>();
  for (const item of linhas) {
    const chave = normalizarChave(item.Setor) || "SEM SETOR";
    const lista = grupos.get(chave) ?? [];
    lista.push(item);
    grupos.set(chave, lista);
  }
  return [...grupos.entries()]
    .map(([, grupo]) => {
      const nomes = catalogarNomes(grupo.map((item) => item.Setor));
      const chave = normalizarChave(grupo[0]?.Setor) || "SEM SETOR";
      const os = grupo
        .map((item) => ({
          numero: texto(item.OS),
          equipamento: texto(item.Equipamento),
          tag: texto(item.Tag),
          ...camposEtapa(item, agora, { solicitacao: true }),
        }))
        .sort((a, b) => String(a.numero).localeCompare(String(b.numero), "pt-BR"));
      const porEtapaMap = new Map<string, typeof os>();
      for (const linha of os) {
        const etapa = String(linha.etapa);
        const fatia = porEtapaMap.get(etapa) ?? [];
        fatia.push(linha);
        porEtapaMap.set(etapa, fatia);
      }
      const porEtapa = [...porEtapaMap.entries()]
        .sort((a, b) => indiceEtapa(a[0]) - indiceEtapa(b[0]) || a[0].localeCompare(b[0], "pt-BR"))
        .map(([etapa, linhasEtapa]) => ({ etapa, quantidade: linhasEtapa.length, os: linhasEtapa }));
      return {
        setor: nomes.has(chave) ? nomeExibicao(nomes.get(chave)!) : "SEM SETOR",
        quantidade: os.length,
        porEtapa,
      };
    })
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
}

export function consultarOsPorSetor(request: Request, usuarioId: string, agora = new Date()) {
  const ctx = contextoBot(usuarioId);
  if (!papelGestao(ctx.papel)) return json(403, { ok: false });
  const params = new URL(request.url).searchParams;
  if (params.get("abertas") !== "1") return json(400, { ok: false, message: "Use abertas=1." });
  if (normalizarChave(params.get("tipo")) !== "CORRETIVA") return json(400, { ok: false, message: "Use tipo=corretiva." });
  const paginacao = paginarPorSetor(params);
  if (!paginacao.ok) return json(400, { ok: false, message: paginacao.message });
  const copia = lerLista("os-analitico", agora.getTime());
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const itens = (copia.itens as OsAnaliticoItem[]).filter(corretivaEc);
  const decisao = decidirSetor({
    assistencial: papelAssistencial(ctx.papel),
    gestao: papelGestao(ctx.papel),
    vinculos: ctx.setores,
    consulta: params.get("setor")?.trim() ?? "",
    nomesNaCopia: itens.map((item) => item.Setor),
    modo: "lista",
    apelidos: listarApelidos(),
  });
  const meta = { fetchedAt: copia.fetchedAt, idadeSegundos: copia.idadeSegundos };
  const especial = respostaDecisaoSetor(decisao, meta);
  if (especial) return especial;
  const chaves = decisao.tipo === "chaves" ? decisao.chaves : null;
  const filtrados = itens
    .filter((item) => (chaves ? chaves.has(normalizarChave(item.Setor)) : true))
    .sort(
      (a, b) =>
        (normalizarChave(a.Setor) || "SEM SETOR").localeCompare(normalizarChave(b.Setor) || "SEM SETOR", "pt-BR") ||
        texto(a.OS).localeCompare(texto(b.OS), "pt-BR"),
    );
  const fatia = filtrados.slice(paginacao.offset, paginacao.offset + paginacao.limite);
  const proximo = paginacao.offset + paginacao.limite < filtrados.length ? paginacao.offset + paginacao.limite : null;
  return json(200, {
    ok: true,
    tipo: "corretiva",
    setores: agruparPorSetor(fatia, agora),
    total: filtrados.length,
    limite: paginacao.limite,
    proximoCursor: proximo == null ? null : Buffer.from(String(proximo), "utf8").toString("base64url"),
    ...meta,
  });
}
