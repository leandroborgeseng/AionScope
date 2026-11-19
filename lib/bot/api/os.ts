/**
 * OS abertas e detalhe, só da cópia de os-analitico.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { parsePbiDate } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { isOsCancelada, osFechamentoDate } from "@/lib/pbi/volume-ec";
import { lerLista } from "./copia";
import { copiaIndisponivel, json } from "./http";
import { historicoOs, projetarOs } from "./projecao";

function aberta(item: OsAnaliticoItem) {
  if (isOsCancelada(item)) return false;
  if (semAcento(item.SituacaoDaOS) === "FECHADA") return false;
  return osFechamentoDate(item) == null;
}

function instante(valor: string | null | undefined) {
  return parsePbiDate(valor)?.getTime() ?? 0;
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

export function consultarOsAbertas(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("abertas") !== "1") return json(400, { ok: false, message: "Use abertas=1." });
  const paginacao = pagina(params);
  if (!paginacao.ok) return json(400, { ok: false, message: paginacao.message });
  const copia = lerLista("os-analitico");
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const filtroTag = params.get("tag")?.trim() ?? "";
  const filtroSetor = params.get("setor")?.trim() ?? "";
  const filtroEquipamento = params.get("equipamento")?.trim() ?? "";
  const itens = (copia.itens as OsAnaliticoItem[])
    .filter((item) => aberta(item))
    .filter((item) => (filtroTag ? semAcento(item.Tag) === semAcento(filtroTag) : true))
    .filter((item) => inclui(item.Setor, filtroSetor) && inclui(item.Equipamento, filtroEquipamento))
    .sort((a, b) => instante(b.Abertura) - instante(a.Abertura) || texto(a.OS).localeCompare(texto(b.OS), "pt-BR"));
  const fatia = itens.slice(paginacao.offset, paginacao.offset + paginacao.limit);
  const proximo = paginacao.offset + paginacao.limit < itens.length ? paginacao.offset + paginacao.limit : null;
  return json(200, {
    ok: true,
    itens: fatia.map(projetarOs),
    limit: paginacao.limit,
    offset: paginacao.offset,
    proximoCursor: proximo == null ? null : Buffer.from(String(proximo), "utf8").toString("base64url"),
    fetchedAt: copia.fetchedAt,
    idadeSegundos: copia.idadeSegundos,
  });
}

export function consultarOsNumero(numero: string) {
  const copia = lerLista("os-analitico");
  if (!copia.ok) return copiaIndisponivel(copia.motivo, copia.motivo === "expirada" ? copia : undefined);
  const chave = semAcento(numero);
  const item = (copia.itens as OsAnaliticoItem[]).find((os) => semAcento(os.OS) === chave || semAcento(String(os.CodigoSerialOS ?? "")) === chave);
  if (!item) return json(404, { ok: false, message: "Não encontrei." });
  return json(200, {
    ok: true,
    os: projetarOs(item),
    historico: historicoOs(item),
    fetchedAt: copia.fetchedAt,
    idadeSegundos: copia.idadeSegundos,
  });
}
