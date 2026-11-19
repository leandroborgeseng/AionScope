import { consultarFreshness } from "@/lib/bot/api/freshness";
import { atenderGet, metodosFechados } from "@/lib/bot/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return atenderGet(request, () => consultarFreshness());
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
