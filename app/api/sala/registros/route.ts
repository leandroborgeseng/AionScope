import { NextResponse } from "next/server";
import {
  criarAlerta,
  criarAquisicao,
  criarFeriado,
  criarImpedimento,
  criarObra,
  criarTreinamento,
  listarRegistrosSala,
  salvarMelhoria,
} from "@/lib/db/sala-registros";
import { invalidarCacheSnapshot } from "@/lib/ec/montar-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listarRegistrosSala());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const tipo = String(body.tipo ?? "");

  try {
    let id: string | null = null;
    if (tipo === "impedimento") {
      id = criarImpedimento({
        tag: String(body.tag ?? ""),
        equipamento: body.equipamento ? String(body.equipamento) : undefined,
        motivo: String(body.motivo ?? ""),
        nova_data: body.nova_data ? String(body.nova_data) : undefined,
        registrado_por: body.registrado_por ? String(body.registrado_por) : undefined,
      });
    } else if (tipo === "aquisicao") {
      id = criarAquisicao({
        descricao: String(body.descricao ?? ""),
        status: body.status ? String(body.status) : undefined,
        previsao: body.previsao ? String(body.previsao) : undefined,
        observacao: body.observacao ? String(body.observacao) : undefined,
      });
    } else if (tipo === "obra") {
      id = criarObra({
        descricao: String(body.descricao ?? ""),
        status: body.status ? String(body.status) : undefined,
        previsao: body.previsao ? String(body.previsao) : undefined,
        observacao: body.observacao ? String(body.observacao) : undefined,
      });
    } else if (tipo === "treinamento") {
      id = criarTreinamento({
        data: String(body.data ?? ""),
        tema: String(body.tema ?? ""),
        participantes: Number(body.participantes ?? 0),
        evidencia: Boolean(body.evidencia),
        observacao: body.observacao ? String(body.observacao) : undefined,
      });
    } else if (tipo === "alerta") {
      id = criarAlerta({
        titulo: String(body.titulo ?? ""),
        equipamentos: body.equipamentos ? String(body.equipamentos) : undefined,
        segregados: Boolean(body.segregados),
        status: body.status ? String(body.status) : undefined,
        observacao: body.observacao ? String(body.observacao) : undefined,
      });
    } else if (tipo === "melhoria") {
      id = salvarMelhoria({
        id: body.id ? String(body.id) : undefined,
        item: String(body.item ?? ""),
        status: body.status ? String(body.status) : undefined,
        observacao: body.observacao ? String(body.observacao) : undefined,
      });
    } else if (tipo === "feriado") {
      id = criarFeriado({
        data: String(body.data ?? ""),
        nome: String(body.nome ?? ""),
      });
    } else {
      return NextResponse.json({ ok: false, message: "Tipo inválido." }, { status: 400 });
    }
    invalidarCacheSnapshot();
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha ao gravar." },
      { status: 400 },
    );
  }
}
