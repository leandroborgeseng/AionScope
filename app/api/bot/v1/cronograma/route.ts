import { consultarCronograma } from "@/lib/bot/api/cronograma";
import { atenderGet, metodosFechados } from "@/lib/bot/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return atenderGet(request, (usuarioId) => consultarCronograma(request, usuarioId));
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
