import { createHash, randomUUID } from "crypto";
import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import { getDb } from "@/lib/db/client";
import { resolveDatabasePath } from "@/lib/db/path";
import type { ErroValidacao, FonteAnexo, OrdemAnexo } from "./types";

/** Limite por arquivo (bytes). Multipart pode ter overhead — Next body ≥ 15 MB. */
export const ANEXO_TAMANHO_MAX = 12 * 1024 * 1024;

export const MIME_ANEXOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type MimeAnexo = (typeof MIME_ANEXOS_PERMITIDOS)[number];

const EXT_POR_MIME: Record<MimeAnexo, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

type AnexoRow = {
  id: number;
  numero_ordem: string;
  nome_original: string;
  content_type: string;
  tamanho: number;
  caminho_relativo: string;
  fonte: string;
  email_message_id: string | null;
  descricao: string | null;
  created_at: string;
};

function canWriteDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Raiz dos anexos: ORDENS_COMPRA_ANEXOS_PATH ou pasta ao lado do SQLite. */
export function resolveAnexosRoot(): string {
  const fromEnv =
    process.env.ORDENS_COMPRA_ANEXOS_PATH?.trim() ||
    process.env.ORDENS_COMPRA_ANEXOS_DIR?.trim();
  if (fromEnv && canWriteDir(fromEnv)) return fromEnv;

  const root = path.join(path.dirname(resolveDatabasePath()), "ordens-compra-anexos");
  canWriteDir(root);
  return root;
}

function nowIso() {
  return new Date().toISOString();
}

function sanearNumeroOrdem(numero: string): string {
  return numero.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "ordem";
}

function sanearNomeArquivo(nome: string): string {
  const base = path.basename(nome).replace(/[^\w.\- ()\[\]]+/g, "_").trim();
  return (base || "anexo").slice(0, 180);
}

function normalizarMime(raw: string | null | undefined): MimeAnexo | null {
  if (!raw) return null;
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if ((MIME_ANEXOS_PERMITIDOS as readonly string[]).includes(base)) {
    return base as MimeAnexo;
  }
  if (base === "image/jpg") return "image/jpeg";
  return null;
}

function mimePorExtensao(nome: string): MimeAnexo | null {
  const ext = path.extname(nome).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  if (ext === ".heif") return "image/heif";
  return null;
}

function mimePorMagic(buf: Buffer): MimeAnexo | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12).toLowerCase();
    if (brand.startsWith("hei") || brand === "mif1" || brand === "msf1") {
      return brand.startsWith("heif") ? "image/heif" : "image/heic";
    }
  }
  return null;
}

function urlAnexo(numero: string, id: number): string {
  return `/api/sala/ordens-compra/${encodeURIComponent(numero)}/anexos/${id}`;
}

function rowParaAnexo(row: AnexoRow): OrdemAnexo {
  return {
    id: row.id,
    numero_ordem: row.numero_ordem,
    nome_original: row.nome_original,
    content_type: row.content_type,
    tamanho: row.tamanho,
    caminho_relativo: row.caminho_relativo,
    fonte: row.fonte as FonteAnexo,
    email_message_id: row.email_message_id,
    descricao: row.descricao,
    created_at: row.created_at,
    url: urlAnexo(row.numero_ordem, row.id),
  };
}

export function listarAnexosOrdem(numero: string): OrdemAnexo[] {
  const rows = getDb()
    .prepare(
      `SELECT id, numero_ordem, nome_original, content_type, tamanho, caminho_relativo,
              fonte, email_message_id, descricao, created_at
       FROM ordem_anexos WHERE numero_ordem = ? ORDER BY id ASC`,
    )
    .all(numero) as AnexoRow[];
  return rows.map(rowParaAnexo);
}

export function obterAnexo(numero: string, id: number): OrdemAnexo | undefined {
  const row = getDb()
    .prepare(
      `SELECT id, numero_ordem, nome_original, content_type, tamanho, caminho_relativo,
              fonte, email_message_id, descricao, created_at
       FROM ordem_anexos WHERE numero_ordem = ? AND id = ?`,
    )
    .get(numero, id) as AnexoRow | undefined;
  return row ? rowParaAnexo(row) : undefined;
}

export function caminhoAbsolutoAnexo(caminhoRelativo: string): string {
  const root = resolveAnexosRoot();
  const abs = path.resolve(root, caminhoRelativo);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    throw new Error("caminho de anexo inválido");
  }
  return abs;
}

export function lerBytesAnexo(anexo: OrdemAnexo): Buffer {
  return readFileSync(caminhoAbsolutoAnexo(anexo.caminho_relativo));
}

export type ResultadoValidacaoAnexo =
  | { ok: true; mime: MimeAnexo; nome: string; bytes: Buffer }
  | { ok: false; error: ErroValidacao };

export function validarArquivoAnexo(input: {
  nome: string;
  contentType?: string | null;
  bytes: Buffer;
}): ResultadoValidacaoAnexo {
  const nome = sanearNomeArquivo(input.nome);
  if (!input.bytes.length) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "arquivo", mensagem: "arquivo vazio." }],
      },
    };
  }
  if (input.bytes.length > ANEXO_TAMANHO_MAX) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [
          {
            campo: "arquivo",
            mensagem: `tamanho máximo ${Math.floor(ANEXO_TAMANHO_MAX / (1024 * 1024))} MB.`,
          },
        ],
      },
    };
  }

  const magic = mimePorMagic(input.bytes);
  const declarado = normalizarMime(input.contentType) ?? mimePorExtensao(nome);
  const mime = magic ?? declarado;
  if (!mime) {
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [
          {
            campo: "arquivo",
            mensagem: "tipo não permitido (PDF, JPEG, PNG, WebP ou HEIC).",
          },
        ],
      },
    };
  }
  if (magic && declarado && magic !== declarado) {
    const mesmaFamilia =
      (magic.startsWith("image/") && declarado.startsWith("image/")) ||
      (magic === "application/pdf" && declarado === "application/pdf");
    if (!mesmaFamilia) {
      return {
        ok: false,
        error: {
          status: 400,
          erro: "validação falhou",
          detalhes: [{ campo: "arquivo", mensagem: "conteúdo não corresponde ao tipo declarado." }],
        },
      };
    }
  }

  return { ok: true, mime: magic ?? mime, nome, bytes: input.bytes };
}

export type GravarAnexoInput = {
  numero_ordem: string;
  nome: string;
  contentType?: string | null;
  bytes: Buffer;
  fonte: FonteAnexo;
  email_message_id?: string | null;
  descricao?: string | null;
};

export function gravarAnexoOrdem(
  input: GravarAnexoInput,
): { ok: true; anexo: OrdemAnexo } | { ok: false; error: ErroValidacao } {
  const validado = validarArquivoAnexo({
    nome: input.nome,
    contentType: input.contentType,
    bytes: input.bytes,
  });
  if (!validado.ok) return validado;

  const pastaOrdem = sanearNumeroOrdem(input.numero_ordem);
  const ext = EXT_POR_MIME[validado.mime];
  const hashCurto = createHash("sha256").update(validado.bytes).digest("hex").slice(0, 10);
  const arquivo = `${randomUUID()}-${hashCurto}${ext}`;
  const relativo = path.join(pastaOrdem, arquivo).split(path.sep).join("/");
  const abs = caminhoAbsolutoAnexo(relativo);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, validado.bytes);

  const created_at = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO ordem_anexos (
        numero_ordem, nome_original, content_type, tamanho, caminho_relativo,
        fonte, email_message_id, descricao, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.numero_ordem,
      validado.nome,
      validado.mime,
      validado.bytes.length,
      relativo,
      input.fonte,
      input.email_message_id ?? null,
      input.descricao?.trim() || null,
      created_at,
    );

  const anexo = obterAnexo(input.numero_ordem, Number(result.lastInsertRowid));
  if (!anexo) {
    try {
      unlinkSync(abs);
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: {
        status: 400,
        erro: "validação falhou",
        detalhes: [{ campo: "arquivo", mensagem: "falha ao registrar anexo." }],
      },
    };
  }
  return { ok: true, anexo };
}

export function removerAnexoOrdem(
  numero: string,
  id: number,
): { ok: true } | { ok: false; motivo: "nao_encontrado" } {
  const anexo = obterAnexo(numero, id);
  if (!anexo) return { ok: false, motivo: "nao_encontrado" };

  getDb().prepare("DELETE FROM ordem_anexos WHERE numero_ordem = ? AND id = ?").run(numero, id);
  try {
    unlinkSync(caminhoAbsolutoAnexo(anexo.caminho_relativo));
  } catch {
    /* arquivo já ausente */
  }
  return { ok: true };
}

export function ehImagemAnexo(contentType: string): boolean {
  return contentType.startsWith("image/");
}
