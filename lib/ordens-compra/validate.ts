import {
  CATEGORIA_ORDEM,
  CONFIANCA_ORDEM,
  ORIGEM_ORDEM,
  STATUS_ORDEM,
  type DetalheErro,
  type ErroValidacao,
  type ItemOrdem,
  type ListaFiltros,
  type ParsedOrdem,
  type PatchSalaOrdem,
} from "./types";

const MONEY_RE = /^-?\d+(\.\d+)?$/;
const MES_RE = /^\d{4}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textoOpcional(value: unknown, campo: string, detalhes: DetalheErro[]): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") {
    detalhes.push({ campo, mensagem: "deve ser texto, número ou null." });
    return undefined;
  }
  const texto = String(value).trim();
  return texto.length ? texto : null;
}

function enumOpcional<T extends string>(
  value: unknown,
  campo: string,
  permitidos: readonly T[],
  detalhes: DetalheErro[],
): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    detalhes.push({ campo, mensagem: "deve ser texto ou null." });
    return undefined;
  }
  const texto = value.trim();
  if (!texto) return null;
  if (!(permitidos as readonly string[]).includes(texto)) {
    detalhes.push({
      campo,
      mensagem: `valor desconhecido; use: ${permitidos.join(", ")}.`,
    });
    return undefined;
  }
  return texto as T;
}

function dinheiroOpcional(value: unknown, campo: string, detalhes: DetalheErro[]): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      detalhes.push({ campo, mensagem: "número inválido." });
      return undefined;
    }
    return String(value);
  }
  if (typeof value === "string") {
    const texto = value.trim();
    if (!texto) return null;
    if (!MONEY_RE.test(texto)) {
      detalhes.push({
        campo,
        mensagem: "use decimal com ponto (ex.: 1234.56).",
      });
      return undefined;
    }
    return texto;
  }
  detalhes.push({ campo, mensagem: "deve ser decimal ou null." });
  return undefined;
}

function dataOpcional(value: unknown, campo: string, detalhes: DetalheErro[]): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    detalhes.push({ campo, mensagem: "data deve ser texto ISO 8601 ou null." });
    return undefined;
  }
  const texto = value.trim();
  if (!texto) return null;
  const ms = Date.parse(texto);
  if (Number.isNaN(ms)) {
    detalhes.push({ campo, mensagem: "data ISO 8601 inválida." });
    return undefined;
  }
  return texto;
}

function stringsRelacionadas(value: unknown, detalhes: DetalheErro[]): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    detalhes.push({ campo: "ordens_relacionadas", mensagem: "deve ser um array de textos ou null." });
    return undefined;
  }
  const saida: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "string" && typeof item !== "number") {
      detalhes.push({
        campo: `ordens_relacionadas[${i}]`,
        mensagem: "deve ser texto.",
      });
      continue;
    }
    const texto = String(item).trim();
    if (texto) saida.push(texto);
  }
  return saida;
}

function parseItem(raw: unknown, indice: number, detalhes: DetalheErro[]): ItemOrdem | null {
  if (!isRecord(raw)) {
    detalhes.push({ campo: `itens[${indice}]`, mensagem: "cada item deve ser um objeto." });
    return null;
  }
  const descricao = textoOpcional(raw.descricao, `itens[${indice}].descricao`, detalhes);
  const quantidade = dinheiroOpcional(raw.quantidade, `itens[${indice}].quantidade`, detalhes);
  const unidade = textoOpcional(raw.unidade, `itens[${indice}].unidade`, detalhes);
  const valor_unitario = dinheiroOpcional(raw.valor_unitario, `itens[${indice}].valor_unitario`, detalhes);
  const valor_total = dinheiroOpcional(raw.valor_total, `itens[${indice}].valor_total`, detalhes);
  const codigo = textoOpcional(raw.codigo, `itens[${indice}].codigo`, detalhes);
  return {
    descricao: descricao === undefined ? null : descricao,
    quantidade: quantidade === undefined ? null : quantidade,
    unidade: unidade === undefined ? null : unidade,
    valor_unitario: valor_unitario === undefined ? null : valor_unitario,
    valor_total: valor_total === undefined ? null : valor_total,
    codigo: codigo === undefined ? null : codigo,
  };
}

function erroDe(detalhes: DetalheErro[]): ErroValidacao {
  const enumUnknown = detalhes.some((d) => d.mensagem.startsWith("valor desconhecido"));
  return {
    status: enumUnknown ? 422 : 400,
    erro: enumUnknown ? "valor de enumeração desconhecido" : "validação falhou",
    detalhes,
  };
}

export function parseOrdemCompra(
  raw: unknown,
  numeroOrdemPath?: string,
): { ok: true; data: ParsedOrdem } | { ok: false; error: ErroValidacao } {
  const detalhes: DetalheErro[] = [];
  if (!isRecord(raw)) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "corpo", mensagem: "JSON deve ser um objeto." }],
      },
    };
  }

  const numeroCorpo = textoOpcional(raw.numero_ordem, "numero_ordem", detalhes);
  const numeroPath = numeroOrdemPath?.trim() ? decodeURIComponent(numeroOrdemPath.trim()) : undefined;
  let numero_ordem = numeroPath || numeroCorpo || "";
  if (numeroPath && numeroCorpo && numeroPath !== numeroCorpo) {
    detalhes.push({
      campo: "numero_ordem",
      mensagem: "o número da URL e o do corpo devem coincidir.",
    });
  }
  if (!numero_ordem) {
    detalhes.push({ campo: "numero_ordem", mensagem: "obrigatório." });
  }

  const campos: ParsedOrdem["campos"] = {};
  if ("status" in raw) campos.status = enumOpcional(raw.status, "status", STATUS_ORDEM, detalhes) ?? null;
  if ("categoria" in raw) {
    campos.categoria = enumOpcional(raw.categoria, "categoria", CATEGORIA_ORDEM, detalhes) ?? null;
  }
  if ("data_pedido" in raw) campos.data_pedido = dataOpcional(raw.data_pedido, "data_pedido", detalhes) ?? null;
  if ("data_ordem" in raw) campos.data_ordem = dataOpcional(raw.data_ordem, "data_ordem", detalhes) ?? null;
  if ("valor_total" in raw) campos.valor_total = dinheiroOpcional(raw.valor_total, "valor_total", detalhes) ?? null;
  if ("fornecedor" in raw) campos.fornecedor = textoOpcional(raw.fornecedor, "fornecedor", detalhes) ?? null;
  if ("numero_orcamento" in raw) {
    campos.numero_orcamento = textoOpcional(raw.numero_orcamento, "numero_orcamento", detalhes) ?? null;
  }
  if ("numero_os" in raw) campos.numero_os = textoOpcional(raw.numero_os, "numero_os", detalhes) ?? null;
  if ("setor_equipamento" in raw) {
    campos.setor_equipamento = textoOpcional(raw.setor_equipamento, "setor_equipamento", detalhes) ?? null;
  }
  if ("origem" in raw) campos.origem = enumOpcional(raw.origem, "origem", ORIGEM_ORDEM, detalhes) ?? null;
  if ("solicitante" in raw) campos.solicitante = textoOpcional(raw.solicitante, "solicitante", detalhes) ?? null;
  if ("assunto_email" in raw) {
    campos.assunto_email = textoOpcional(raw.assunto_email, "assunto_email", detalhes) ?? null;
  }
  if ("email_message_id" in raw) {
    campos.email_message_id = textoOpcional(raw.email_message_id, "email_message_id", detalhes) ?? null;
  }
  if ("anexo_origem" in raw) campos.anexo_origem = textoOpcional(raw.anexo_origem, "anexo_origem", detalhes) ?? null;
  if ("confianca" in raw) {
    campos.confianca = enumOpcional(raw.confianca, "confianca", CONFIANCA_ORDEM, detalhes) ?? null;
  }
  if ("observacoes" in raw) campos.observacoes = textoOpcional(raw.observacoes, "observacoes", detalhes) ?? null;
  if ("ordens_relacionadas" in raw) {
    campos.ordens_relacionadas = stringsRelacionadas(raw.ordens_relacionadas, detalhes) ?? null;
  }

  let itens: ItemOrdem[] | undefined;
  if ("itens" in raw) {
    if (raw.itens === null) {
      itens = [];
    } else if (!Array.isArray(raw.itens)) {
      detalhes.push({ campo: "itens", mensagem: "deve ser um array." });
    } else {
      itens = [];
      for (let i = 0; i < raw.itens.length; i++) {
        const item = parseItem(raw.itens[i], i, detalhes);
        if (item) itens.push(item);
      }
    }
  }

  if (detalhes.length) return { ok: false, error: erroDe(detalhes) };

  const parsed: ParsedOrdem = { numero_ordem, campos };
  if (itens) parsed.itens = itens;
  return { ok: true, data: parsed };
}

export function parseLote(raw: unknown): { ok: true; ordens: unknown[] } | { ok: false; error: ErroValidacao } {
  if (!isRecord(raw) || !("ordens" in raw)) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "ordens", mensagem: "corpo deve ser { \"ordens\": [...] }." }],
      },
    };
  }
  if (!Array.isArray(raw.ordens)) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "ordens", mensagem: "deve ser um array." }],
      },
    };
  }
  if (raw.ordens.length > 500) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "ordens", mensagem: "máximo de 500 ordens por lote." }],
      },
    };
  }
  return { ok: true, ordens: raw.ordens };
}

export function parseListaQuery(url: URL): { ok: true; filtros: ListaFiltros } | { ok: false; error: ErroValidacao } {
  const detalhes: DetalheErro[] = [];
  const pageRaw = url.searchParams.get("page");
  const sizeRaw = url.searchParams.get("page_size");
  const page = pageRaw ? Number(pageRaw) : 1;
  const page_size = sizeRaw ? Number(sizeRaw) : 50;
  if (!Number.isInteger(page) || page < 1) {
    detalhes.push({ campo: "page", mensagem: "deve ser inteiro ≥ 1." });
  }
  if (!Number.isInteger(page_size) || page_size < 1 || page_size > 500) {
    detalhes.push({ campo: "page_size", mensagem: "deve ser inteiro entre 1 e 500." });
  }

  const desde = url.searchParams.get("desde")?.trim() || undefined;
  if (desde && Number.isNaN(Date.parse(desde))) {
    detalhes.push({ campo: "desde", mensagem: "data ISO 8601 inválida." });
  }

  const mes = url.searchParams.get("mes")?.trim() || undefined;
  if (mes && !MES_RE.test(mes)) {
    detalhes.push({ campo: "mes", mensagem: "use YYYY-MM." });
  }

  const categoria = url.searchParams.get("categoria")?.trim() || undefined;
  if (categoria && !(CATEGORIA_ORDEM as readonly string[]).includes(categoria)) {
    detalhes.push({
      campo: "categoria",
      mensagem: `valor desconhecido; use: ${CATEGORIA_ORDEM.join(", ")}.`,
    });
  }

  const semValorRaw = url.searchParams.get("sem_valor");
  const sem_valor = semValorRaw === "1" || semValorRaw === "true";
  const abertasRaw = url.searchParams.get("abertas");
  const abertas = abertasRaw === "1" || abertasRaw === "true";

  if (detalhes.length) return { ok: false, error: erroDe(detalhes) };

  return {
    ok: true,
    filtros: {
      desde,
      categoria,
      fornecedor: url.searchParams.get("fornecedor")?.trim() || undefined,
      mes,
      os: url.searchParams.get("os")?.trim() || url.searchParams.get("numero_os")?.trim() || undefined,
      sem_valor,
      abertas: abertas || undefined,
      page,
      page_size,
    },
  };
}

export function parseCategoriaPatch(
  raw: unknown,
): { ok: true; categoria: (typeof CATEGORIA_ORDEM)[number] } | { ok: false; error: ErroValidacao } {
  if (!isRecord(raw) || !("categoria" in raw)) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "categoria", mensagem: "obrigatório." }],
      },
    };
  }
  const detalhes: DetalheErro[] = [];
  const categoria = enumOpcional(raw.categoria, "categoria", CATEGORIA_ORDEM, detalhes);
  if (detalhes.length) return { ok: false, error: erroDe(detalhes) };
  if (!categoria) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "categoria", mensagem: "obrigatório." }],
      },
    };
  }
  return { ok: true, categoria };
}

/** PATCH da Sala: categoria, numero_os, data_entrega, itens_entregues (pelo menos um). */
export function parseSalaPatch(
  raw: unknown,
): { ok: true; patch: PatchSalaOrdem } | { ok: false; error: ErroValidacao } {
  if (!isRecord(raw)) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "corpo", mensagem: "JSON deve ser um objeto." }],
      },
    };
  }

  const detalhes: DetalheErro[] = [];
  const patch: PatchSalaOrdem = {};

  if ("categoria" in raw) {
    const categoria = enumOpcional(raw.categoria, "categoria", CATEGORIA_ORDEM, detalhes);
    if (categoria) patch.categoria = categoria;
    else if (!detalhes.some((d) => d.campo === "categoria")) {
      detalhes.push({ campo: "categoria", mensagem: "obrigatório quando enviado." });
    }
  }

  if ("numero_os" in raw) {
    const os = textoOpcional(raw.numero_os, "numero_os", detalhes);
    if (os !== undefined) patch.numero_os = os;
  }

  if ("data_entrega" in raw) {
    const data = dataOpcional(raw.data_entrega, "data_entrega", detalhes);
    if (data !== undefined) patch.data_entrega = data;
  }

  if ("itens_entregues" in raw) {
    const texto = textoOpcional(raw.itens_entregues, "itens_entregues", detalhes);
    if (texto !== undefined) patch.itens_entregues = texto;
  }

  if ("marcar_entregue" in raw && raw.marcar_entregue) {
    if (patch.data_entrega === undefined) {
      patch.data_entrega = new Date().toISOString().slice(0, 10);
    }
  }

  if (detalhes.length) return { ok: false, error: erroDe(detalhes) };
  if (
    patch.categoria === undefined &&
    patch.numero_os === undefined &&
    patch.data_entrega === undefined &&
    patch.itens_entregues === undefined
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [
          {
            campo: "corpo",
            mensagem: "informe categoria, numero_os, data_entrega, itens_entregues e/ou marcar_entregue.",
          },
        ],
      },
    };
  }

  return { ok: true, patch };
}
