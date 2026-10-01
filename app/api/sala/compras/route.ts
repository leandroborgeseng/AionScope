import { NextResponse } from "next/server";
import { m365Configurado } from "@/lib/compras/parse-email";
import { listarCompras, emailsDaCompra } from "@/lib/compras/store";
import { sincronizarCompras } from "@/lib/compras/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sync = url.searchParams.get("sync") === "1";
  let syncResult = null;
  if (sync) {
    syncResult = await sincronizarCompras({ forcar: true });
  }
  const compras = listarCompras();
  return NextResponse.json({
    configurado: m365Configurado(),
    sync: syncResult,
    compras: compras.map((c) => ({
      ...c,
      emails: emailsDaCompra(c.id),
    })),
  });
}

export async function POST() {
  const sync = await sincronizarCompras({ forcar: true });
  return NextResponse.json(sync);
}
