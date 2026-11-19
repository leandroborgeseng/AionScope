import { consultarEquipamento } from "@/lib/bot/api/equipamento";
import { atenderGet, metodosFechados } from "@/lib/bot/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ tag: string }> };

export async function GET(request: Request, context: Ctx) {
  const { tag } = await context.params;
  return atenderGet(request, () => consultarEquipamento(tag));
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
