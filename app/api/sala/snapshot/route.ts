import { NextResponse } from "next/server";
import { carregarSnapshot } from "@/lib/ec/montar-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await carregarSnapshot();
  return NextResponse.json(snapshot);
}
