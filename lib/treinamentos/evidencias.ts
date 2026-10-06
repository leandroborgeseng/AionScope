import { timingSafeEqual } from "crypto";
import { existsSync } from "fs";
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

/** Diretório fora do git (volume Coolify/local). Preferir path estático sob data/. */
export function diretorioEvidencias() {
  const env = process.env.TREINAMENTOS_EVIDENCIAS_PATH?.trim();
  if (env) return env;
  // Escopo estático para o bundler; em Coolify use TREINAMENTOS_EVIDENCIAS_PATH=/data/...
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "treinamentos-evidencias");
}

export function caminhoEvidencia(ano: string) {
  const arquivo = ARQUIVOS[ano];
  if (!arquivo) return null;
  return path.join(/* turbopackIgnore: true */ diretorioEvidencias(), arquivo);
}

export function evidenciaExiste(ano: string) {
  const caminho = caminhoEvidencia(ano);
  return caminho ? existsSync(/* turbopackIgnore: true */ caminho) : false;
}

export function anosEvidenciaDisponiveis() {
  return Object.keys(ARQUIVOS).filter((ano) => evidenciaExiste(ano));
}

export function tokenEvidenciaValido(request: Request) {
  const esperado = tokenConfigurado();
  if (!esperado) return false;

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

export function recusarEvidencia() {
  if (!tokenConfigurado()) {
    return NextResponse.json(
      {
        erro: "evidências não configuradas",
        detalhe: `Defina ${TREINAMENTOS_EVIDENCIAS_TOKEN_ENV} e coloque os PDFs em ${diretorioEvidencias()}.`,
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
}
