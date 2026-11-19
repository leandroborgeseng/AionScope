import { atenderGet, metodosFechados } from "@/lib/bot/api/http";
import { consultarOsAbertas } from "@/lib/bot/api/os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return atenderGet(request, (usuarioId) => consultarOsAbertas(request, usuarioId));
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
