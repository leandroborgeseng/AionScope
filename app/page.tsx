import { redirect } from "next/navigation";
import { INDICADORES_HUB_HREF } from "@/lib/indicadores/catalog";

export default function HomePage() {
  redirect(INDICADORES_HUB_HREF);
}
