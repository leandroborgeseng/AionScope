import { NextResponse } from "next/server";
import type { ErroValidacao } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: JSON_HEADERS });
}

export function jsonErroValidacao(error: ErroValidacao) {
  return NextResponse.json(
    { erro: error.erro, detalhes: error.detalhes },
    { status: error.status, headers: JSON_HEADERS },
  );
}

export function jsonErro(erro: string, status: number) {
  return NextResponse.json({ erro }, { status, headers: JSON_HEADERS });
}

export async function lerJson(request: Request): Promise<unknown | { _invalido: true }> {
  try {
    return await request.json();
  } catch {
    return { _invalido: true };
  }
}

export function jsonInvalido() {
  return jsonErroValidacao({
    status: 400,
    erro: "validação falhou",
    detalhes: [{ campo: "corpo", mensagem: "JSON inválido." }],
  });
}
