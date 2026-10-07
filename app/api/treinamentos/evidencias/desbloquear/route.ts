import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  evidenciasTokenConfigurado,
  TREINAMENTOS_EVIDENCIAS_TOKEN_ENV,
} from "@/lib/treinamentos/evidencias";

export const runtime = "nodejs";

function iguais(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Grava cookie HttpOnly com o token para abrir os PDFs na mesma sessão. */
export async function POST(request: Request) {
  if (!evidenciasTokenConfigurado()) {
    // Ambiente sem token: PDFs liberados se existirem no volume.
    return NextResponse.json({ ok: true, liberado: true, tokenObrigatorio: false });
  }

  let body: { token?: string } = {};
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const esperado = process.env[TREINAMENTOS_EVIDENCIAS_TOKEN_ENV]?.trim() ?? "";
  if (!token || !iguais(token, esperado)) {
    return NextResponse.json({ erro: "token inválido" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("treinamentos_evidencias", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("treinamentos_evidencias", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
