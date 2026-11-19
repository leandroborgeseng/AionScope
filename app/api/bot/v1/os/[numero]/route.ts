import { atenderGet, metodosFechados } from "@/lib/bot/api/http";
import { consultarOsNumero } from "@/lib/bot/api/os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ numero: string }> };

export async function GET(request: Request, context: Ctx) {
  const { numero } = await context.params;
  return atenderGet(request, () => consultarOsNumero(numero));
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
