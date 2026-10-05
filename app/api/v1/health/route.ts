import { jsonOk } from "@/lib/ordens-compra/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return jsonOk({ status: "ok" });
}
