import { NextResponse, type NextRequest } from "next/server";
import { carregarSnapshot } from "@/lib/ec/montar-snapshot";
import { snapshotDemoAgora } from "@/lib/ec/snapshot-demo-agora";
import { isDemoDrill, snapshotDemoDrill } from "@/lib/ec/sala-recorte-servico";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("demo") === "1") {
    return NextResponse.json(snapshotDemoAgora());
  }
  if (isDemoDrill(request.nextUrl.searchParams.get("demo"))) {
    return NextResponse.json(snapshotDemoDrill());
  }
  const snapshot = await carregarSnapshot();
  return NextResponse.json(snapshot);
}
