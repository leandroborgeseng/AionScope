import { timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const TREINAMENTOS_EVIDENCIAS_TOKEN_ENV = "TREINAMENTOS_EVIDENCIAS_TOKEN";

const ARQUIVOS: Record<string, string> = {
  "2025": "2025_lista_presenca_bomba_infusao.pdf",
  "2026": "2026_lista_presenca_bomba_infusao.pdf",
};

function tokenConfigurado() {
  return process.env[TREINAMENTOS_EVIDENCIAS_TOKEN_ENV]?.trim() ?? "";
}

function iguais(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Candidatos de pasta (volume Coolify/Railway + fallback do app). */
export function candidatosDiretorioEvidencias() {
  const out: string[] = [];
  const env = process.env.TREINAMENTOS_EVIDENCIAS_PATH?.trim();
  if (env) out.push(env);
  out.push("/data/treinamentos-evidencias");
  const database = process.env.DATABASE_PATH?.trim();
  if (database) {
    out.push(path.join(/* turbopackIgnore: true */ path.dirname(database), "treinamentos-evidencias"));
  }
  out.push(path.join(/* turbopackIgnore: true */ process.cwd(), "data", "treinamentos-evidencias"));
  return [...new Set(out)];
}

/** Diretório preferido para gravar uploads. */
export function diretorioEvidencias() {
  const candidatos = candidatosDiretorioEvidencias();
  for (const dir of candidatos) {
    if (existsSync(/* turbopackIgnore: true */ dir)) return dir;
  }
  return candidatos[0] ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data", "treinamentos-evidencias");
}

export function nomeArquivoEvidencia(ano: string) {
  return ARQUIVOS[ano] ?? null;
}

export function caminhoEvidencia(ano: string) {
  const arquivo = nomeArquivoEvidencia(ano);
  if (!arquivo) return null;
  for (const dir of candidatosDiretorioEvidencias()) {
    const full = path.join(/* turbopackIgnore: true */ dir, arquivo);
    if (existsSync(/* turbopackIgnore: true */ full)) return full;
  }
  return path.join(/* turbopackIgnore: true */ diretorioEvidencias(), arquivo);
}

export function evidenciaExiste(ano: string) {
  const arquivo = nomeArquivoEvidencia(ano);
  if (!arquivo) return false;
  return candidatosDiretorioEvidencias().some((dir) =>
    existsSync(/* turbopackIgnore: true */ path.join(dir, arquivo)),
  );
}

export function anosEvidenciaDisponiveis() {
  return Object.keys(ARQUIVOS).filter((ano) => evidenciaExiste(ano));
}

export function anosEvidenciaConhecidos() {
  return Object.keys(ARQUIVOS);
}

/** Grava PDF no volume persistente. */
export function salvarEvidenciaPdf(ano: string, bytes: Buffer) {
  const arquivo = nomeArquivoEvidencia(ano);
  if (!arquivo) throw new Error("ano inválido");
  if (bytes.length < 100) throw new Error("arquivo muito pequeno");
  if (bytes.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("arquivo não é PDF");
  }
  const dir = diretorioEvidencias();
  mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  const destino = path.join(/* turbopackIgnore: true */ dir, arquivo);
  writeFileSync(/* turbopackIgnore: true */ destino, bytes);
  return destino;
}

export function tokenEvidenciaValido(request: Request) {
  const esperado = tokenConfigurado();
  // Sem token no ambiente = painel privado: liberar PDFs se existirem no volume.
  if (!esperado) return true;

  const header = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)/i.exec(header);
  if (bearer && iguais(bearer[1], esperado)) return true;

  const url = new URL(request.url);
  const q = url.searchParams.get("token")?.trim() ?? "";
  if (q && iguais(q, esperado)) return true;

  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)treinamentos_evidencias=([^;]+)/.exec(cookie);
  if (match) {
    try {
      const valor = decodeURIComponent(match[1]);
      if (iguais(valor, esperado)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function evidenciasTokenConfigurado() {
  return Boolean(tokenConfigurado());
}

/** Status para a UI: quais PDFs existem e se o token é obrigatório. */
export function statusEvidencias(request?: Request) {
  const anos = anosEvidenciaDisponiveis();
  const tokenObrigatorio = evidenciasTokenConfigurado();
  const liberado = tokenObrigatorio
    ? Boolean(request && tokenEvidenciaValido(request))
    : true;
  return {
    tokenObrigatorio,
    anos,
    liberado,
    diretorio: diretorioEvidencias(),
  };
}

export function recusarEvidencia() {
  if (!tokenConfigurado()) {
    return NextResponse.json(
      {
        erro: "evidências não encontradas",
        detalhe: `Envie os PDFs pelo painel ou coloque em ${diretorioEvidencias()}.`,
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
}
