import { atenderSaude, metodosFechados } from "@/lib/bot/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return atenderSaude(request);
}

export const { POST, PUT, PATCH, DELETE } = metodosFechados();
