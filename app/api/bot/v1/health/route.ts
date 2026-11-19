import { atenderGet, json, metodosFechados } from "@/lib/bot/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return atenderGet(request, () => json(200, { ok: true }));
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
