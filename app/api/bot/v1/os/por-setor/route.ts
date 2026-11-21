import { consultarOsPorSetor } from "@/lib/bot/api/os";
import { atenderGet, metodosFechados } from "@/lib/bot/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return atenderGet(request, (usuarioId) => consultarOsPorSetor(request, usuarioId));
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
